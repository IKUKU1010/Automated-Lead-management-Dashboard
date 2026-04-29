import { Hono } from "hono";
import { nanoid } from "nanoid";
import db, { getSetting } from "../db.js";
import { generateResponse } from "../services/ai.js";
import { getArboStarPayloadPreview } from "../services/arbostar.js";

const leads = new Hono();

// ─── SERVICE AREA — reads from settings table at runtime ──────────────────────

function isInServiceArea(zip: string): boolean {
  if (!zip) return false;
  const prefixes = getSetting("service_area.zip_prefixes",
    "440,441,442,443,444,445,446,447,448,449,430,431,432,433,434,435,436,437,438,439"
  ).split(",").map(p => p.trim());
  return prefixes.some(p => zip.startsWith(p));
}

// ─── PARSE HELPERS ───────────────────────────────────────────────────────────

function parseAnswerForceEmail(body: string) {
  const name  = body.match(/Name:\s*([^,\n]+?)(?:\s*,?\s*(?:Phone|Email|Zip):|$)/i)?.[1]?.trim() ?? "";
  const phone = body.match(/Phone:\s*([\d\-\(\) +]+)/i)?.[1]?.trim() ?? "";
  const zip   = body.match(/Zip:\s*(\d{5})/i)?.[1]?.trim() ?? "";
  const city  = body.match(/(?:Located in|City)[:\s]+([A-Za-z ]+?)(?:,|OH|\d|$)/i)?.[1]?.trim() ?? "";
  const msg   = body.match(/Details?:\s*(.+)/i)?.[1]?.trim() ?? body;
  return { name, phone, email: "", zip, city, message: msg };
}

function parseLSAEmail(body: string) {
  const name  = (body.match(/Name:\s*([^,\n]+?)(?:\s*,?\s*(?:Phone|Email|Zip):|$)/i) ?? body.match(/From:\s*([^,\n]+?)(?:\s*,?\s*(?:Phone|Email|Zip):|$)/i))?.[1]?.trim() ?? "";
  const phone = body.match(/Phone:\s*([\d\-\(\) +]+)/i)?.[1]?.trim() ?? "";
  const email = body.match(/Email:\s*(\S+@\S+)/i)?.[1]?.trim() ?? "";
  const zip   = body.match(/Zip:\s*(\d{5})/i)?.[1]?.trim() ?? "";
  const city  = body.match(/(?:City|Located in)[:\s]+([A-Za-z ]+?)(?:,|OH|\d|$)/i)?.[1]?.trim() ?? "";
  return { name, phone, email, zip, city, message: body };
}

function detectServiceType(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("stump"))                            return "Stump Grinding";
  if (t.includes("emergency") || t.includes("storm") || t.includes("fallen")) return "Emergency Service";
  if (t.includes("health") || t.includes("disease") || t.includes("sick"))    return "Plant Health Care";
  if (t.includes("consult") || t.includes("assess"))  return "Arborist Consultation";
  if (t.includes("remov"))                            return "Tree Removal";
  if (t.includes("trim") || t.includes("prun"))       return "Tree Trimming";
  return "Tree Service";
}

function detectUrgency(text: string): string {
  const urgent = ["emergency", "asap", "urgent", "right away", "today", "tonight", "storm", "fallen", "leaning", "roof"];
  return urgent.some(w => text.toLowerCase().includes(w)) ? "urgent" : "standard";
}

// ─── GET ALL LEADS ────────────────────────────────────────────────────────────

leads.get("/", (c) => {
  const status = c.req.query("status");
  const rows = status
    ? db.prepare("SELECT * FROM leads WHERE status = ? ORDER BY received_at DESC").all(status)
    : db.prepare("SELECT * FROM leads ORDER BY received_at DESC").all();
  return c.json(rows);
});

// ─── GET SINGLE LEAD ─────────────────────────────────────────────────────────

leads.get("/:id", (c) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(c.req.param("id"));
  if (!lead) return c.json({ error: "Not found" }, 404);
  const arbostarPreview = getArboStarPayloadPreview(c.req.param("id"));
  const logs = db.prepare("SELECT * FROM audit_log WHERE lead_id = ? ORDER BY created_at ASC").all(c.req.param("id"));
  return c.json({ lead, arbostarPreview, logs });
});

// ─── INGEST — WEBSITE FORM ────────────────────────────────────────────────────

leads.post("/ingest/form", async (c) => {
  const body = await c.req.json<{
    name: string; email: string; phone: string; zip: string; serviceType: string; message?: string;
  }>();

  const id  = `L-${nanoid(6).toUpperCase()}`;
  const now = new Date().toISOString();
  const rawMessage = body.message || `Service: ${body.serviceType} | Name: ${body.name}, Phone: ${body.phone}, Zip: ${body.zip}`;

  const leadData = {
    name:          body.name,
    phone:         body.phone,
    email:         body.email,
    address:       "",
    city:          "",
    state:         "OH",
    zip:           body.zip,
    scope:         body.message ? body.message.replace(/^Service:\s*[^|]+\|\s*/i, "").trim() : body.serviceType,
    serviceType:   body.serviceType,
    urgency:       detectUrgency(rawMessage),
    inServiceArea: isInServiceArea(body.zip),
    source:        "Website Form",
  };

  const ai = await generateResponse(leadData, rawMessage);
  const threshold = parseInt(getSetting('scoring.auto_send_threshold', '80'), 10);
  const autoSend = ai.confidence >= threshold && leadData.inServiceArea;

  db.prepare(`
    INSERT INTO leads (id, source, status, confidence, received_at, raw_message,
      name, phone, email, address, city, state, zip,
      scope, service_type, urgency, in_service_area,
      generated_response, final_response, confidence_reason)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, "Website Form", autoSend ? "auto-sent" : (ai.confidence < parseInt(getSetting('scoring.review_threshold','50'),10) ? "flagged" : "review"),
    ai.confidence, now, rawMessage,
    leadData.name, leadData.phone, leadData.email, "", "", "OH", body.zip,
    leadData.scope, leadData.serviceType, leadData.urgency, leadData.inServiceArea ? 1 : 0,
    ai.response, autoSend ? ai.response : null, ai.confidenceReason
  );

  db.prepare("INSERT INTO audit_log (lead_id, action, note) VALUES (?,?,?)").run(id, "ingested", "Website Form");

  if (autoSend && ai.response) {
    const { sendFollowUpEmail } = await import("../services/email.js");
    const { syncToArboStar }    = await import("../services/arbostar.js");
    await sendFollowUpEmail(id, ai.response);
    await syncToArboStar(id);
    db.prepare("UPDATE leads SET responded_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  }

  return c.json({ id, status: autoSend ? "auto-sent" : "queued", confidence: ai.confidence }, 201);
});

// ─── INGEST — EMAIL (LSA + AnswerForce) ──────────────────────────────────────

leads.post("/ingest/email", async (c) => {
  const body = await c.req.json<{
    from: string; subject: string; body: string; source: "LSA" | "AnswerForce";
  }>();

  const id  = `L-${nanoid(6).toUpperCase()}`;
  const now = new Date().toISOString();
  const source = body.source === "LSA" ? "Google LSA" : "AnswerForce";
  const parsed = body.source === "AnswerForce"
    ? parseAnswerForceEmail(body.body)
    : parseLSAEmail(body.body);

  const scopeText = parsed.message;
  const parsedZip  = (parsed as any).zip  ?? "";
  const parsedCity = (parsed as any).city ?? "";
  const leadData = {
    name:          parsed.name,
    phone:         parsed.phone,
    email:         parsed.email,
    address:       "",
    city:          parsedCity,
    state:         "OH",
    zip:           parsedZip,
    scope:         scopeText,
    serviceType:   detectServiceType(scopeText),
    urgency:       detectUrgency(scopeText),
    inServiceArea: parsedZip ? isInServiceArea(parsedZip) : true,
    source,
  };

  const ai = await generateResponse(leadData, body.body);
  const threshold = parseInt(getSetting('scoring.auto_send_threshold', '80'), 10);
  const autoSend = ai.confidence >= threshold;

  db.prepare(`
    INSERT INTO leads (id, source, status, confidence, received_at, raw_message,
      name, phone, email, address, city, state, zip,
      scope, service_type, urgency, in_service_area,
      generated_response, final_response, confidence_reason)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, source, autoSend ? "auto-sent" : (ai.confidence < parseInt(getSetting('scoring.review_threshold','50'),10) ? "flagged" : "review"),
    ai.confidence, now, body.body,
    leadData.name, leadData.phone, leadData.email, "", parsedCity, "OH", parsedZip,
    leadData.scope, leadData.serviceType, leadData.urgency, leadData.inServiceArea ? 1 : 0,
    ai.response, autoSend ? ai.response : null, ai.confidenceReason
  );

  db.prepare("INSERT INTO audit_log (lead_id, action, note) VALUES (?,?,?)").run(id, "ingested", source);

  if (autoSend && ai.response) {
    const { sendFollowUpEmail } = await import("../services/email.js");
    const { syncToArboStar }    = await import("../services/arbostar.js");
    await sendFollowUpEmail(id, ai.response);
    await syncToArboStar(id);
    db.prepare("UPDATE leads SET responded_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  }

  return c.json({ id, status: autoSend ? "auto-sent" : "queued", confidence: ai.confidence }, 201);
});

// ─── GET STATS ────────────────────────────────────────────────────────────────

leads.get("/meta/stats", (c) => {
  const total      = (db.prepare("SELECT COUNT(*) as c FROM leads").get() as { c: number }).c;
  const autoSent   = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'auto-sent'").get() as { c: number }).c;
  const review     = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'review'").get() as { c: number }).c;
  const flagged    = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'flagged'").get() as { c: number }).c;
  const approved   = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'approved'").get() as { c: number }).c;
  const avgConf    = (db.prepare("SELECT AVG(confidence) as a FROM leads").get() as { a: number | null }).a;
  const autoRate   = total > 0 ? Math.round(((autoSent + approved) / total) * 100) : 0;
  return c.json({ total, autoSent, review, flagged, approved, avgConfidence: Math.round(avgConf ?? 0), autoRate });
});

export default leads;
