import db from "../db.js";

interface EmailOptions {
  to: string;
  toName: string;
  subject: string;
  body: string;
  leadId: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendViaSendGrid(opts: EmailOptions): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.SENDGRID_API_KEY;

  if (!apiKey) {
    // Prototype / dev mode — log and simulate
    console.log(`[Email] Mock send to ${opts.to} — subject: "${opts.subject}"`);
    console.log(`[Email] Body preview:\n${opts.body.substring(0, 200)}...`);
    return { ok: true };
  }

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: opts.to, name: opts.toName }] }],
        from: {
          email: process.env.FROM_EMAIL || "customerservice@premiertreesllc.com",
          name:  "Premier Tree Specialists",
        },
        subject: opts.subject,
        content: [
          { type: "text/plain", value: opts.body },
          { type: "text/html",  value: bodyToHtml(opts.body) },
        ],
      }),
    });

    if (res.ok || res.status === 202) return { ok: true };
    const text = await res.text();
    return { ok: false, error: `SendGrid ${res.status}: ${text}` };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// Simple plain-text → HTML conversion with company branding
function bodyToHtml(body: string): string {
  const paragraphs = body.split("\n\n").map(p =>
    `<p style="margin:0 0 12px 0;line-height:1.6">${p.replace(/\n/g, "<br>")}</p>`
  ).join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px">
  <div style="border-bottom:3px solid #16a34a;padding-bottom:16px;margin-bottom:24px">
    <h2 style="margin:0;color:#15803d;font-size:18px">🌲 Premier Tree Specialists</h2>
    <p style="margin:4px 0 0;font-size:13px;color:#666">Cleveland: 216-245-8908 &nbsp;|&nbsp; Columbus: 614-526-2266</p>
  </div>
  ${paragraphs}
  <div style="border-top:1px solid #e5e7eb;margin-top:24px;padding-top:16px;font-size:12px;color:#888">
    Premier Tree Specialists LLC &nbsp;|&nbsp; ISA-Certified Arborists &nbsp;|&nbsp; Fully Insured<br>
    Serving Northeast &amp; Central Ohio
  </div>
</body>
</html>`;
}

function buildSubject(serviceType: string, customerName: string): string {
  const first = customerName?.split(" ")[0] || "there";
  const subjects: Record<string, string> = {
    "Emergency Service":        `Re: Your Urgent Tree Request — We're On It, ${first}`,
    "Tree Removal":             `Re: Your Tree Removal Inquiry — Free Estimate Inside`,
    "Tree Trimming":            `Re: Your Tree Trimming Request — Premier Tree Specialists`,
    "Stump Grinding":           `Re: Stump Grinding Estimate — Premier Tree Specialists`,
    "Arborist Consultation":    `Re: Your Arborist Consultation Request`,
    "Plant Health Care":        `Re: Tree Health Assessment — Premier Tree Specialists`,
  };
  return subjects[serviceType] ?? `Re: Your Tree Service Inquiry — Premier Tree Specialists`;
}

// Main export — send follow-up email for a lead
export async function sendFollowUpEmail(leadId: string, responseText: string): Promise<void> {
  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId) as {
    id: string; name: string; email: string; service_type: string;
  } | undefined;

  if (!lead) {
    console.error(`[Email] Lead ${leadId} not found`);
    return;
  }

  if (!lead.email || !isValidEmail(lead.email)) {
    console.log(`[Email] Skipping lead ${leadId} — no valid email address`);
    db.prepare("INSERT INTO audit_log (lead_id, action, note) VALUES (?, ?, ?)").run(leadId, "email_skipped", "No valid email address");
    return;
  }

  const opts: EmailOptions = {
    to:      lead.email,
    toName:  lead.name,
    subject: buildSubject(lead.service_type, lead.name),
    body:    responseText,
    leadId,
  };

  const result = await sendViaSendGrid(opts);

  if (result.ok) {
    db.prepare("UPDATE leads SET email_sent = 1 WHERE id = ?").run(leadId);
    db.prepare("INSERT INTO audit_log (lead_id, action, note) VALUES (?, ?, ?)").run(leadId, "email_sent", `To: ${lead.email}`);
    console.log(`[Email] Sent to ${lead.email} for lead ${leadId}`);
  } else {
    db.prepare("INSERT INTO audit_log (lead_id, action, note) VALUES (?, ?, ?)").run(leadId, "email_failed", result.error);
    console.error(`[Email] Failed for lead ${leadId}:`, result.error);
  }
}
