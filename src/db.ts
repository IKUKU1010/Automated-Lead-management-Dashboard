import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "leads.db");

// Only create the directory when it doesn't exist AND we're not being asked to
// create a system-level path (like /data) on a machine where we lack permission.
// On Railway the /data volume is pre-created by Railway itself, so mkdirSync is
// only needed for nested subdirectories. Locally the DB lives in cwd which always exists.
const DB_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DB_DIR)) {
  try {
    fs.mkdirSync(DB_DIR, { recursive: true });
  } catch (err: any) {
    if (err.code === "EACCES") {
      console.warn(`⚠️  Cannot create database directory at ${DB_DIR} (permission denied).`);
      console.warn(`   Set DATABASE_PATH in your .env to a writable path, e.g. DATABASE_PATH=./leads.db`);
      console.warn(`   Falling back to: ${path.join(process.cwd(), "leads.db")}`);
      // Re-assign to local fallback — can't mutate const so we handle below
    } else {
      throw err;
    }
  }
}

// Use writable path — if DB_DIR wasn't creatable, fall back to cwd
const RESOLVED_DB_PATH = fs.existsSync(DB_DIR) ? DB_PATH : path.join(process.cwd(), "leads.db");

const db = new Database(RESOLVED_DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id          TEXT PRIMARY KEY,
    source      TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    confidence  INTEGER,
    received_at TEXT NOT NULL,
    responded_at TEXT,
    raw_message TEXT,
    -- customer fields
    name        TEXT,
    phone       TEXT,
    email       TEXT,
    address     TEXT,
    city        TEXT,
    state       TEXT,
    zip         TEXT,
    -- extracted
    scope       TEXT,
    service_type TEXT,
    urgency     TEXT DEFAULT 'standard',
    in_service_area INTEGER DEFAULT 1,
    -- response
    generated_response TEXT,
    final_response     TEXT,
    confidence_reason  TEXT,
    -- outreach
    text_sent   INTEGER DEFAULT 0,
    email_sent  INTEGER DEFAULT 0,
    -- crm
    arbostar_synced INTEGER DEFAULT 0,
    arbostar_error  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS faq (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    question TEXT NOT NULL,
    answer   TEXT NOT NULL,
    keywords TEXT
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id    TEXT NOT NULL,
    action     TEXT NOT NULL,
    actor      TEXT DEFAULT 'system',
    note       TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Seed mock leads — INSERT OR IGNORE is safe to run every boot.
// Seeds fresh DBs and backfills any missing IDs on existing DBs.
export function seedLeads() {
  const ins = db.prepare(`
    INSERT OR IGNORE INTO leads (id, source, status, confidence, received_at, responded_at,
      raw_message, name, phone, email, address, city, state, zip,
      scope, service_type, urgency, in_service_area,
      generated_response, final_response, confidence_reason,
      text_sent, email_sent, arbostar_synced)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const seeds: (string | number | null)[][] = [
    ["L-001","Google LSA","auto-sent",92,"2026-04-25T07:14:00","2026-04-25T07:14:38",
     "Hi, I have a big oak tree in my backyard that needs trimming. It's getting close to the power lines. Can I get a quote?",
     "Brian Kowalski","216-555-0182","brian.kowalski@gmail.com","4412 Mayfield Rd","Cleveland","OH","44121",
     "Oak tree trimming - proximity to power lines","Tree Trimming","standard",1,
     "Hi Brian! Thanks for reaching out to Premier Tree Specialists! Important note: oak trimming season in Ohio is currently closed until November to prevent oak wilt disease. For trees near power lines, we always send an ISA-certified arborist to assess clearance requirements. We'll give you a call shortly to schedule a free estimate. You can also reach us at 216-245-8908.\n\nPremier Tree Specialists | Cleveland: 216-245-8908 | Columbus: 614-526-2266",
     "Hi Brian! Oak trimming season is closed until November. We'll call to schedule a fall estimate.",
     "FAQ match: oak season restriction + power line protocol. All contact fields present.",1,1,1],
    ["L-002","Website Form","auto-sent",88,"2026-04-25T08:02:00","2026-04-25T08:02:41",
     "Service: Stump Grinding | Message: We had a tree removed last fall and the stump is still there. Want it ground down before summer. Name: Sandra Mills, Phone: 614-555-0394, Zip: 43081",
     "Sandra Mills","614-555-0394","smills@outlook.com","","Westerville","OH","43081",
     "Stump grinding - post-removal, pre-summer timeline","Stump Grinding","standard",1,
     "Hi Sandra! Thanks for contacting Premier Tree Specialists in Columbus. Stump grinding is one of our most popular spring services - great timing to get that done before summer. We'll call you at 614-555-0394 to set up a free on-site estimate. You can also reach our Columbus office directly at 614-526-2266. Talk soon!\n\nPremier Tree Specialists | Cleveland: 216-245-8908 | Columbus: 614-526-2266",
     "Hi Sandra! Stump grinding is one of our most popular spring services. We'll call to schedule.",
     "FAQ match: stump grinding + Columbus location. All contact fields present.",1,1,1],
    ["L-003","AnswerForce","review",61,"2026-04-25T08:47:00",null,
     "Call at 8:47 AM, Name: James Whitfield, Phone: 216-555-0923, Details: Caller has a large dead maple in the backyard and is worried about it falling on the fence. Wants someone to look at it soon.",
     "James Whitfield","216-555-0923","","","Shaker Heights","OH","44120",
     "Large dead maple - potential hazard, fence proximity","Tree Removal","standard",1,
     "Hi James! Dead trees near structures are definitely worth having assessed - our ISA-certified arborists can evaluate the risk and recommend the safest removal approach. We'll call you at 216-555-0923 to schedule a free on-site estimate.\n\nPremier Tree Specialists | Cleveland: 216-245-8908 | Columbus: 614-526-2266",
     null,
     "Partial FAQ match. No email on file - text only. Dead tree assessment routed to review.",0,0,0],
    ["L-004","Google LSA","flagged",22,"2026-04-25T09:15:00",null,
     "From: Denise Harper, Phone: 330-555-0441, Email: denise.harper@gmail.com, Message: Hi, I need a quote for removing a large pine tree. Located in Youngstown OH 44502.",
     "Denise Harper","330-555-0441","denise.harper@gmail.com","","Youngstown","OH","44502",
     "Large pine tree removal - Youngstown, outside service area","Tree Removal","standard",0,
     "Hi Denise! Unfortunately, Youngstown (44502) falls outside our current service areas of Northeast and Central Ohio. We serve the greater Cleveland and Columbus metro areas. We'd be happy to refer you to a trusted arborist in your area if that would help.\n\nPremier Tree Specialists | Cleveland: 216-245-8908 | Columbus: 614-526-2266",
     null,
     "Out of service area: zip 44502 (Youngstown). Manual handling required.",0,0,0],
    ["L-005","AnswerForce","auto-sent",85,"2026-04-25T09:38:00","2026-04-25T09:38:52",
     "Call at 9:38 AM, Name: Rachel Kim, Phone: 614-555-0771, Details: Caller wants stump grinding for two stumps left from removals last year. Located in Dublin OH.",
     "Rachel Kim","614-555-0771","rkim@gmail.com","","Dublin","OH","43017",
     "Stump grinding - two stumps, post-removal","Stump Grinding","standard",1,
     "Hi Rachel! Great timing to get those stumps taken care of! We grind stumps to below ground level so you can re-seed or landscape over the area. Our Columbus team serves Dublin and we'll reach out to you at 614-555-0771 to schedule a free estimate.\n\nPremier Tree Specialists | Cleveland: 216-245-8908 | Columbus: 614-526-2266",
     "Hi Rachel! Great timing to get those stumps taken care of! We'll call to schedule.",
     "FAQ match: stump grinding + Columbus location. Auto-send threshold met.",1,1,1],
    ["L-006","Website Form","review",55,"2026-04-25T10:12:00",null,
     "Service: Arborist Consultation | My neighbor is claiming my tree is damaging his property. I need a certified arborist to assess the situation and provide a written report. Name: Tom Baxter, Phone: 216-555-0655, Email: tbaxter@gmail.com, Zip: 44106",
     "Tom Baxter","216-555-0655","tbaxter@gmail.com","","Cleveland","OH","44106",
     "Arborist consultation - neighbor dispute, written report needed","Arborist Consultation","standard",1,
     "Hi Tom! This is exactly the kind of situation where an ISA-certified arborist assessment is valuable. Our arborists provide written reports for property disputes and insurance purposes. We'll call you at 216-555-0655 to schedule a consultation.\n\nPremier Tree Specialists | Cleveland: 216-245-8908 | Columbus: 614-526-2266",
     null,
     "Legal/dispute context - requires human review before response. Consultation request with documentation needs.",0,0,0],
    ["L-007","Google LSA","flagged",38,"2026-04-25T10:28:00",null,
     "From: Derek Olson, Phone: 440-555-0312, Email: dolson@gmail.com, Message: I need emergency tree work - a large branch fell on my roof during last night's storm. Located in Medina OH 44256.",
     "Derek Olson","440-555-0312","dolson@gmail.com","","Medina","OH","44256",
     "Storm damage - large branch on roof, emergency response needed","Emergency Service","urgent",1,
     "Hi Derek! We received your message about the storm damage to your roof - please call us immediately at 216-245-8908 for emergency service. We provide 24/7 emergency response for dangerous tree situations. An ISA-certified arborist will call you at 440-555-0312 as soon as possible.\n\nPremier Tree Specialists | Cleveland: 216-245-8908 | Columbus: 614-526-2266",
     null,
     "Flagged keyword detected (emergency/risk). Routed to human review.",0,0,0],
    ["L-008","Website Form","auto-sent",91,"2026-04-25T10:44:00","2026-04-25T10:44:29",
     "Service: Plant Health Care | Hi, I have noticed some of my trees have discolored leaves and some branches appear to be dying. Name: Maria Gonzalez, Phone: 216-555-0556, Zip: 44116",
     "Maria Gonzalez","216-555-0556","mgonzalez@gmail.com","18 Oak Lane","Rocky River","OH","44116",
     "Plant health care - possible disease, discolored leaves, dying branches","Plant Health Care","standard",1,
     "Hi Maria! You were right to reach out - early diagnosis makes a big difference. Our ISA-certified arborists provide plant health care assessments including diagnosis of fungal disease, pest infestation, and nutrient deficiencies. We'll call you at 216-555-0556 to schedule a consultation.\n\nPremier Tree Specialists | Cleveland: 216-245-8908 | Columbus: 614-526-2266",
     "Hi Maria! You were right to reach out. Early diagnosis makes a big difference.",
     "FAQ match: plant health care + arborist consultation. All fields present.",1,1,1],
    ["L-009","Google LSA","review",35,"2026-04-25T11:08:00",null,
     "Hi, I need someone to come out and look at a large maple in my front yard. Worried it might need to come down. Can you help?",
     "Kevin Marsh","","kmarsh84@gmail.com","","Solon","OH","44139",
     "Large maple - possible removal assessment","Tree Removal","standard",1,
     "","",
     "Missing phone number - cannot complete dual-channel outreach without review. Manual follow-up required to obtain callback number.",0,0,0],
    ["L-010","Website Form","review",62,"2026-04-25T11:31:00",null,
     "Service: Tree Trimming | I want to get my oak tree trimmed and shaped before summer. It is a large red oak in the backyard. Name: Linda Ostrowski, Phone: 216-555-0714, Zip: 44118",
     "Linda Ostrowski","216-555-0714","lostrowski@gmail.com","","Cleveland","OH","44118",
     "Oak tree trimming - large red oak, pre-summer request","Tree Trimming","standard",1,
     "Hi Linda! Important heads-up: oak trimming season in Ohio is currently closed until November to prevent oak wilt disease. We would love to get you on our fall schedule! We will call you at 216-555-0714 to book an early November appointment.\n\nPremier Tree Specialists | Cleveland: 216-245-8908 | Columbus: 614-526-2266",
     null,
     "FAQ match: oak season restriction. Customer requested pre-summer timing which conflicts with oak season rules - review recommended.",0,0,0],
  ];
  for (const s of seeds) ins.run(...s);
}

// Run on every boot
seedLeads();

// Seed FAQ if empty
const faqCount = (db.prepare("SELECT COUNT(*) as c FROM faq").get() as { c: number }).c;
if (faqCount === 0) {
  const insert = db.prepare(
    "INSERT INTO faq (category, question, answer, keywords) VALUES (?, ?, ?, ?)"
  );
  const faqs = [
    ["oak_season", "Can you trim my oak tree?", "Oak trimming season in Ohio is closed from approximately April through October to prevent oak wilt disease. We schedule oak trimming between November and March. If your oak needs urgent attention, our ISA-certified arborists can assess and advise.", "oak,trim,prune,season,wilt"],
    ["service_area", "Do you serve my area?", "We serve Northeast Ohio (Cuyahoga, Geauga, Lake, Lorain, Medina, Portage, Summit counties) and Central Ohio (Delaware, Fairfield, Franklin, Licking, Madison, Pickaway, Union counties) from our Cleveland and Columbus locations.", "area,location,county,serve,northeast ohio,central ohio,do you serve"],
    ["emergency", "Do you handle emergency tree work?", "Yes — we provide 24/7 emergency response for dangerous tree situations including storm damage, trees on structures, and imminent hazards. Call 216-245-8908 (Cleveland) or 614-526-2266 (Columbus) for immediate assistance.", "emergency,storm,urgent,fallen,roof,house,danger"],
    ["credentials", "Are your arborists certified?", "Our team includes ISA-certified arborists with 80+ years of combined experience. We are fully insured and licensed for residential and commercial tree work throughout Ohio.", "certified,isa,insured,licensed,experience,qualified"],
    ["pricing", "How much does tree removal cost?", "Pricing depends on tree size, location, access, and debris disposal. We provide free on-site estimates — costs can range widely based on complexity. Contact us to schedule a no-obligation quote.", "price,cost,quote,estimate,how much,removal,charge"],
    ["scheduling", "How do I schedule a visit?", "We'll call you to schedule a free on-site estimate at a time that works for you. Our team serves both Cleveland and Columbus metro areas. We typically book estimates within 2-5 business days.", "schedule,appointment,book,visit,when,available"],
    ["stump", "Do you grind stumps?", "Yes — stump grinding is one of our most popular services. We grind stumps to below ground level, which allows you to re-seed, landscape, or pave over the area. Usually completed same day as removal or as a standalone service.", "stump,grind,grinding,leftover,old stump"],
    ["plant_health", "Can you diagnose sick trees?", "Our ISA-certified arborists provide plant health care assessments including diagnosis of fungal disease, pest infestation, nutrient deficiencies, and structural concerns. Early treatment significantly improves outcomes.", "sick,disease,health,dying,leaves,fungal,pest,discolored"],
    ["columbus", "Do you serve Columbus?", "Yes — we opened our Columbus location in October 2025, serving all of Central Ohio including Westerville, Delaware, Dublin, Grove City, and surrounding areas. Call 614-526-2266 for our Columbus team.", "columbus,central ohio,westerville,delaware,dublin,franklin county"],
  ];
  for (const faq of faqs) insert.run(...faq);
}

// ─── SEED SETTINGS ───────────────────────────────────────────────────────────
// All business rules, thresholds, and config live here.
// INSERT OR IGNORE — never overwrites values Matt has already edited.
export function seedSettings() {
  const set = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?,?)");
  const defaults: [string, string][] = [

    // ── Outreach ─────────────────────────────────────────────────────────────
    ["outreach.text_enabled",     "true"],
    ["outreach.email_enabled",    "true"],
    ["outreach.auto_send_threshold", "80"],   // confidence % required to auto-send
    ["outreach.response_delay_ms",   "0"],    // ms to wait before sending (0 = instant)
    ["outreach.from_name",        "Premier Tree Specialists"],
    ["outreach.from_email",       "customerservice@premiertreesllc.com"],
    ["outreach.cleveland_phone",  "216-245-8908"],
    ["outreach.columbus_phone",   "614-526-2266"],
    ["outreach.signature",        "Premier Tree Specialists | Cleveland: 216-245-8908 | Columbus: 614-526-2266"],

    // ── Inbound channels ─────────────────────────────────────────────────────
    ["inbound.google_lsa_enabled",    "true"],
    ["inbound.website_form_enabled",  "true"],
    ["inbound.answerforce_enabled",   "true"],
    ["inbound.google_lsa_route",      "auto"],      // auto | review | disabled
    ["inbound.website_form_route",    "auto"],
    ["inbound.answerforce_route",     "auto"],

    // ── Confidence & scoring ──────────────────────────────────────────────────
    ["scoring.auto_send_threshold",  "80"],
    ["scoring.review_threshold",     "50"],   // below this = flagged, no response
    ["scoring.field_score_per_item", "5"],    // points per present field (name/phone/email/location)
    ["scoring.faq_score_per_match",  "30"],   // points per FAQ category matched

    // ── Business rules ────────────────────────────────────────────────────────
    ["rules.emergency_keywords",
      "emergency,fallen,house,lawsuit,complaint,bad experience,dangerous,collapse,on my roof,hit the roof,through the roof"],
    ["rules.oak_season_start_month", "4"],    // April (1-indexed)
    ["rules.oak_season_end_month",   "10"],   // October
    ["rules.oak_trim_restricted",    "true"],
    ["rules.oak_season_message",
      "Important: oak trimming season in Ohio is closed April–October to prevent oak wilt disease. We schedule oak trimming November–March only."],

    // ── Service area ──────────────────────────────────────────────────────────
    ["service_area.zip_prefixes",
      "440,441,442,443,444,445,446,447,448,449,430,431,432,433,434,435,436,437,438,439"],
    ["service_area.description",
      "Northeast Ohio (Cuyahoga, Geauga, Lake, Lorain, Medina, Portage, Summit) and Central Ohio (Delaware, Fairfield, Franklin, Licking, Madison, Pickaway, Union)"],

    // ── AI / prompt settings ─────────────────────────────────────────────────
    ["ai.model",       "anthropic/claude-sonnet-4-20250514"],
    ["ai.max_tokens",  "400"],
    ["ai.temperature", "0.4"],
    ["ai.system_prompt",
      `You are a warm, knowledgeable customer service representative for Premier Tree Specialists — an Ohio tree care company with ISA-certified arborists and 80+ years of combined experience.

RULES:
1. NEVER quote specific prices — always offer a free on-site estimate
2. Oak trees cannot be trimmed April–October due to oak wilt disease risk — always mention this if oak trimming is requested
3. Always address the customer by their first name
4. Reference the correct office phone number based on their location
5. Keep responses to 3–5 sentences — warm and professional, never salesy
6. Do NOT use phrases like "Certainly!", "Absolutely!", "Great question!"
7. Do NOT make promises you cannot keep
8. Sign off every message with the company signature`],
    ["ai.extraction_prompt",
      "Extract the following fields from this customer message: name, phone, email, address, city, zip, service type (Tree Trimming / Tree Removal / Stump Grinding / Plant Health Care / Arborist Consultation / Emergency Service), urgency (standard / urgent), and a 1-sentence scope of work. Return as JSON."],
  ];
  const tx = db.transaction((items: [string,string][]) => { for (const [k,v] of items) set.run(k, v); });
  tx(defaults);
}
seedSettings();

// ── Helper: read a setting value at runtime ───────────────────────────────────
export function getSetting(key: string, fallback = ""): string {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

export default db;
