import db, { getSetting } from "../db.js";

interface LeadData {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  scope: string;
  serviceType: string;
  urgency: string;
  inServiceArea: boolean;
  source: string;
}

interface AIResult {
  response: string;
  confidence: number;
  confidenceReason: string;
}

// ─── FAQ CONTEXT ──────────────────────────────────────────────────────────────

function getFaqContext(): string {
  const rows = db.prepare("SELECT category, question, answer FROM faq").all() as {
    category: string; question: string; answer: string;
  }[];
  return rows.map(r => `[${r.category}]\nQ: ${r.question}\nA: ${r.answer}`).join("\n\n");
}

// ─── CONFIDENCE SCORING ───────────────────────────────────────────────────────

function scoreConfidence(lead: LeadData, rawMessage: string): { score: number; reason: string } {
  const msg = rawMessage.toLowerCase();
  const faqRows = db.prepare("SELECT keywords FROM faq").all() as { keywords: string }[];

  // Emergency escalation — always force review regardless of confidence
  const emergencyWords = getSetting("rules.emergency_keywords", "emergency,fallen,house,lawsuit,complaint,dangerous,collapse,on my roof").split(",").map(k => k.trim());
  if (emergencyWords.some(w => msg.includes(w))) {
    return { score: 58, reason: "Flagged keyword detected (emergency/risk). Routed to human review." };
  }

  // Out of service area — flag
  if (!lead.inServiceArea) {
    return { score: 22, reason: `Out of service area: zip ${lead.zip}. Manual handling required.` };
  }

  // Missing phone — cannot do dual-channel outreach
  if (!lead.phone) {
    return { score: 35, reason: "Missing phone number — cannot complete dual-channel outreach without review." };
  }

  // FAQ keyword match — search across raw message, serviceType, and scope
  const searchText = [msg, lead.serviceType?.toLowerCase(), lead.scope?.toLowerCase()].filter(Boolean).join(" ");
  let matchCount = 0;
  for (const row of faqRows) {
    const keywords = (row.keywords || "").split(",").map(k => k.trim());
    if (keywords.some(k => k && searchText.includes(k))) matchCount++;
  }

  // Service type bonus — clearly identified service is a strong signal
  const knownServices = ["stump grinding", "plant health", "tree trimming", "tree removal", "arborist", "emergency service"];
  const serviceBonus  = knownServices.some(s => searchText.includes(s)) ? 1 : 0;
  const effectiveMatchCount = matchCount + serviceBonus;

  const fieldPts   = parseInt(getSetting("scoring.field_score_per_item", "5"), 10);
  const faqPts     = parseInt(getSetting("scoring.faq_score_per_match", "30"), 10);
  const fieldScore = [lead.name, lead.phone, lead.email, lead.city || lead.zip].filter(Boolean).length * fieldPts;
  const faqScore   = Math.min(effectiveMatchCount * faqPts, 90);
  const score      = Math.min(Math.max(fieldScore + faqScore, 30), 97);

  const reason =
    score >= 80
      ? `Strong FAQ match (${matchCount} categories). All key fields present. Auto-send threshold met.`
      : score >= 60
      ? `Partial FAQ match (${matchCount} categories). Some fields missing or inquiry is complex — review recommended.`
      : `Low FAQ match. Unusual or unclear inquiry. Full manual handling recommended.`;

  return { score, reason };
}

// ─── OPENROUTER AI RESPONSE ───────────────────────────────────────────────────

async function callOpenRouter(lead: LeadData, rawMessage: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const faqContext  = getFaqContext();
  const isColumbus  = lead.city?.toLowerCase().includes("columbus")
    || lead.city?.toLowerCase().includes("westerville")
    || lead.city?.toLowerCase().includes("dublin")
    || lead.city?.toLowerCase().includes("delaware")
    || (lead.zip ? ["43", "614"].some(p => lead.zip.startsWith(p)) : false);
  const officePhone = isColumbus ? "614-526-2266" : "216-245-8908";
  const officeName  = isColumbus ? "Columbus" : "Cleveland";

  // Use DB-stored prompt if set, otherwise fall back to the inline default
  const dbSystemPrompt = getSetting("ai.system_prompt", "");
  const defaultSystemPrompt = `You are a warm, knowledgeable customer service representative for Premier Tree Specialists — an Ohio tree care company with ISA-certified arborists and 80+ years of combined experience. You have two office locations:
- Cleveland office: 216-245-8908
- Columbus office: 614-526-2266

COMPANY RULES YOU MUST FOLLOW:
1. NEVER quote specific prices — always offer a free on-site estimate instead
2. Oak trees cannot be trimmed April through October due to oak wilt disease risk — always mention this if oak trimming is requested
3. Always address the customer by their first name
4. Always reference the correct office phone number based on their location
5. Keep responses to 3-5 sentences — warm and professional, never salesy
6. Do NOT use generic AI phrases like "Certainly!", "Absolutely!", "Great question!", or "I hope this helps"
7. Do NOT make promises you cannot keep (same-day service, guaranteed outcomes, specific timelines)
8. If it is an emergency (storm damage, fallen tree), emphasise calling immediately rather than waiting for a callback
9. Sign off every message with: "Premier Tree Specialists | Cleveland: 216-245-8908 | Columbus: 614-526-2266"

FAQ KNOWLEDGE BASE (use this to inform your response):
${faqContext}`;
  const systemPrompt = dbSystemPrompt || defaultSystemPrompt;

  const userPrompt = `A new customer enquiry has come in. Write a reply to send to this customer.

CUSTOMER DETAILS:
- Name: ${lead.name}
- Phone: ${lead.phone || "not provided"}
- Email: ${lead.email || "not provided"}
- Location: ${lead.city || "Ohio"}, ${lead.zip}
- Source: ${lead.source}
- Service requested: ${lead.serviceType}
- Urgency: ${lead.urgency}
- Scope of work: ${lead.scope}

RAW ENQUIRY MESSAGE:
"${rawMessage}"

RELEVANT OFFICE FOR THIS CUSTOMER: ${officeName} (${officePhone})

Write the reply now. Start with "Hi ${lead.name.split(" ")[0]}!" and end with the company sign-off. Do not include a subject line or any metadata — just the message body.`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://premiertreesllc.com",
        "X-Title": "Premier Tree Specialists Lead Dashboard",
      },
      body: JSON.stringify({
        model: getSetting("ai.model", "anthropic/claude-sonnet-4-20250514"),
        max_tokens: parseInt(getSetting("ai.max_tokens", "400"), 10),
        temperature: parseFloat(getSetting("ai.temperature", "0.4")),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt   },
        ],
      }),
    });

    if (!res.ok) {
      console.error(`OpenRouter error: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json() as {
      choices?: { message?: { content?: string } }[];
      error?: { message: string };
    };

    if (data.error) {
      console.error("OpenRouter API error:", data.error.message);
      return null;
    }

    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.error("OpenRouter fetch failed:", err);
    return null;
  }
}

// ─── RULE-BASED FALLBACK RESPONSE ─────────────────────────────────────────────
// Used when OPENROUTER_API_KEY is not set or the API call fails

function buildResponse(lead: LeadData, rawMessage: string): string {
  const msg      = rawMessage.toLowerCase();
  const faqRows  = db.prepare("SELECT category, answer FROM faq").all() as { category: string; answer: string }[];
  const faqMap: Record<string, string> = {};
  for (const r of faqRows) faqMap[r.category] = r.answer;

  const firstName  = lead.name?.split(" ")[0] || "there";
  const isColumbus = lead.city?.toLowerCase().includes("columbus")
    || lead.city?.toLowerCase().includes("westerville")
    || ["43", "614"].some(p => lead.zip?.startsWith(p));
  const phone = isColumbus ? "614-526-2266" : "216-245-8908";

  let body = "";

  if (["emergency", "storm", "fallen", "leaning"].some(w => msg.includes(w))) {
    body = `We received your urgent message and take hazard situations very seriously. ${faqMap["emergency"] ?? ""} Please call us immediately at ${phone} or an ISA-certified arborist will call you at ${lead.phone} as soon as possible.`;
  } else if (msg.includes("oak") && (msg.includes("trim") || msg.includes("prun"))) {
    body = `Thanks for reaching out about your oak tree. ${faqMap["oak_season"] ?? ""} We'll call you at ${lead.phone} to schedule a fall appointment.`;
  } else if (["stump", "grind"].some(w => msg.includes(w)) || lead.serviceType?.toLowerCase().includes("stump")) {
    body = `Great timing to get that stump taken care of! ${faqMap["stump"] ?? ""} We'll reach out to ${lead.phone} to schedule a free on-site estimate.`;
  } else if (["sick", "disease", "dying", "leaves", "discolor", "health", "pest"].some(w => msg.includes(w)) || lead.serviceType?.toLowerCase().includes("plant health")) {
    body = `You were right to reach out — early diagnosis makes a big difference. ${faqMap["plant_health"] ?? ""} We'll call you at ${lead.phone} to schedule a consultation.`;
  } else if (["cost", "price", "quote", "estimate", "how much"].some(w => msg.includes(w))) {
    body = `We'd be happy to provide a free on-site estimate. ${faqMap["pricing"] ?? ""} We'll call you at ${lead.phone} to set up a convenient time.`;
  } else {
    body = `Thanks for reaching out to Premier Tree Specialists! We'd love to help with your ${lead.serviceType?.toLowerCase() || "tree service"} needs. Our ISA-certified arborists serve your area and will call you at ${lead.phone} to schedule a free estimate.`;
  }

  if (isColumbus) {
    body += ` Our Columbus team is ready to help — you can also reach us directly at 614-526-2266.`;
  }

  return `Hi ${firstName}! ${body}\n\nPremier Tree Specialists | Cleveland: 216-245-8908 | Columbus: 614-526-2266`;
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────

export async function generateResponse(lead: LeadData, rawMessage: string): Promise<AIResult> {
  const { score, reason } = scoreConfidence(lead, rawMessage);

  // Confidence too low — don't generate a response, require full manual handling
  if (score < 50) {
    return { response: "", confidence: score, confidenceReason: reason };
  }

  // Try OpenRouter AI first, fall back to rule-based if unavailable
  const aiResponse = await callOpenRouter(lead, rawMessage);
  const response   = aiResponse ?? buildResponse(lead, rawMessage);

  // Log which mode was used
  if (process.env.OPENROUTER_API_KEY) {
    console.log(`[AI] ${aiResponse ? "OpenRouter" : "fallback"} response for ${lead.name} (${lead.serviceType})`);
  }

  return { response, confidence: score, confidenceReason: reason };
}
