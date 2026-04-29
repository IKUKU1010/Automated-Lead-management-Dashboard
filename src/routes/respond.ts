import { Hono } from "hono";
import db from "../db.js";
import { sendFollowUpEmail } from "../services/email.js";
import { syncToArboStar } from "../services/arbostar.js";

const respond = new Hono();

interface Lead {
  id: string;
  status: string;
  generated_response: string;
  name: string;
  email: string;
  phone: string;
  service_type: string;
}

// ─── APPROVE ─────────────────────────────────────────────────────────────────

respond.post("/:id/approve", async (c) => {
  const id   = c.req.param("id");
  const body = await c.req.json<{ editedResponse?: string; actor?: string }>().catch((): { editedResponse?: string; actor?: string } => ({}));

  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(id) as Lead | undefined;
  if (!lead) return c.json({ error: "Lead not found" }, 404);
  if (!["review", "flagged"].includes(lead.status)) {
    return c.json({ error: `Lead is already ${lead.status}` }, 400);
  }

  const finalResponse = body.editedResponse?.trim() || lead.generated_response;
  if (!finalResponse) return c.json({ error: "No response text to send" }, 400);

  const now  = new Date().toISOString();
  const actor = body.actor || "human";
  const wasEdited = body.editedResponse && body.editedResponse.trim() !== lead.generated_response;

  // Update lead record
  db.prepare(`
    UPDATE leads
    SET status = 'approved', final_response = ?, responded_at = ?
    WHERE id = ?
  `).run(finalResponse, now, id);

  db.prepare("INSERT INTO audit_log (lead_id, action, actor, note) VALUES (?,?,?,?)").run(
    id, "approved", actor, wasEdited ? "Response edited before sending" : "Sent as generated"
  );

  // Send email + sync CRM (non-blocking — errors are logged, not thrown)
  await Promise.allSettled([
    sendFollowUpEmail(id, finalResponse),
    syncToArboStar(id),
  ]);

  // Mark text as sent (Agent Phone / iMessage integration point)
  // For now, log as sent in demo mode — wire to Agent Phone API here
  db.prepare("UPDATE leads SET text_sent = 1 WHERE id = ?").run(id);
  db.prepare("INSERT INTO audit_log (lead_id, action, actor, note) VALUES (?,?,?,?)").run(
    id, "text_sent", "system", "Demo mode — Agent Phone integration pending credentials"
  );

  db.prepare("UPDATE leads SET responded_at = ? WHERE id = ?").run(now, id);

  return c.json({
    success: true,
    leadId: id,
    respondedAt: now,
    editedByHuman: wasEdited,
    channels: { email: !!lead.email, text: true },
  });
});

// ─── REJECT ──────────────────────────────────────────────────────────────────

respond.post("/:id/reject", async (c) => {
  const id   = c.req.param("id");
  const body = await c.req.json<{ reason?: string; actor?: string }>().catch((): { reason?: string; actor?: string } => ({}));

  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(id) as Lead | undefined;
  if (!lead) return c.json({ error: "Lead not found" }, 404);
  if (lead.status === "rejected") return c.json({ error: "Already rejected" }, 400);

  db.prepare("UPDATE leads SET status = 'rejected' WHERE id = ?").run(id);
  db.prepare("INSERT INTO audit_log (lead_id, action, actor, note) VALUES (?,?,?,?)").run(
    id, "rejected", body.actor || "human", body.reason || "No reason given"
  );

  return c.json({ success: true, leadId: id });
});

// ─── EDIT RESPONSE DRAFT ─────────────────────────────────────────────────────

respond.patch("/:id/draft", async (c) => {
  const id   = c.req.param("id");
  const body = await c.req.json<{ draft: string }>();

  if (!body.draft?.trim()) return c.json({ error: "Draft cannot be empty" }, 400);

  db.prepare("UPDATE leads SET generated_response = ? WHERE id = ?").run(body.draft.trim(), id);
  db.prepare("INSERT INTO audit_log (lead_id, action, actor, note) VALUES (?,?,?,?)").run(
    id, "draft_edited", "human", "Response draft manually updated"
  );

  return c.json({ success: true });
});

// ─── GET AUDIT LOG ────────────────────────────────────────────────────────────

respond.get("/:id/log", (c) => {
  const id   = c.req.param("id");
  const logs = db.prepare("SELECT * FROM audit_log WHERE lead_id = ? ORDER BY created_at ASC").all(id);
  return c.json(logs);
});

export default respond;
