import db from "../db.js";

interface ArboStarPayload {
  name: string;
  email: string | null;
  phone: string;
  address: string | null;
  city: string;
  state: string;
  postal: string;
  country: string;
  details: string;
  address_notes: string;
}

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  scope: string;
  source: string;
}

function buildPayload(lead: Lead): ArboStarPayload {
  return {
    name:         lead.name,
    email:        lead.email || null,
    phone:        lead.phone,
    address:      lead.address || null,
    city:         lead.city,
    state:        lead.state || "OH",
    postal:       lead.zip,
    country:      "US",
    details:      lead.scope,
    address_notes: `Source: ${lead.source}`,
  };
}

async function postToArboStar(payload: ArboStarPayload): Promise<{ ok: boolean; error?: string }> {
  const companyId = process.env.ARBOSTAR_COMPANY_ID;
  const apiKey    = process.env.ARBOSTAR_API_KEY;

  if (!companyId || !apiKey) {
    // Prototype mode — simulate success
    console.log("[ArboStar] Mock sync — no credentials configured:", JSON.stringify(payload, null, 2));
    return { ok: true };
  }

  const url = `https://${companyId}.arbostar.com/api/requests/create`;

  // Retry with exponential backoff (3 attempts)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) return { ok: true };

      const text = await res.text();
      console.error(`[ArboStar] Attempt ${attempt} failed (${res.status}): ${text}`);

      if (attempt < 3) await sleep(attempt * 1500); // 1.5s, 3s
    } catch (err) {
      console.error(`[ArboStar] Attempt ${attempt} network error:`, err);
      if (attempt < 3) await sleep(attempt * 1500);
    }
  }

  return { ok: false, error: "Failed after 3 attempts" };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Sync a lead to ArboStar — called after response is sent
export async function syncToArboStar(leadId: string): Promise<void> {
  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId) as Lead | undefined;
  if (!lead) {
    console.error(`[ArboStar] Lead ${leadId} not found`);
    return;
  }

  const payload = buildPayload(lead);
  const result  = await postToArboStar(payload);

  if (result.ok) {
    db.prepare("UPDATE leads SET arbostar_synced = 1, arbostar_error = NULL WHERE id = ?").run(leadId);
    db.prepare("INSERT INTO audit_log (lead_id, action, note) VALUES (?, ?, ?)").run(leadId, "arbostar_sync", "Synced successfully");
    console.log(`[ArboStar] Lead ${leadId} synced`);
  } else {
    db.prepare("UPDATE leads SET arbostar_error = ? WHERE id = ?").run(result.error, leadId);
    db.prepare("INSERT INTO audit_log (lead_id, action, note) VALUES (?, ?, ?)").run(leadId, "arbostar_sync_failed", result.error);
    console.error(`[ArboStar] Lead ${leadId} sync failed:`, result.error);
  }
}

// Preview what would be sent — used by the dashboard ArboStar tab
export function getArboStarPayloadPreview(leadId: string): ArboStarPayload | null {
  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId) as Lead | undefined;
  if (!lead) return null;
  return buildPayload(lead);
}
