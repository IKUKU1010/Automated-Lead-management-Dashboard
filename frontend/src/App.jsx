import { useState, useEffect } from "react";
import Settings from "./Settings.jsx";
import { TourLanding, TourOverlay, ReplayTourButton } from "./Tour.jsx";

// ─── MOCK DATA (fallback for local dev without backend) ───────────────────────

const MOCK_LEADS = [
  {
    id: "L-001", source: "Google LSA", status: "auto-sent", confidence: 92,
    receivedAt: "2026-04-25T07:14:00", respondedAt: "2026-04-25T07:14:38",
    customer: { name: "Brian Kowalski", phone: "216-555-0182", email: "brian.kowalski@gmail.com", address: "4412 Mayfield Rd", city: "Cleveland", state: "OH", zip: "44121" },
    rawMessage: "Hi, I have a big oak tree in my backyard that needs trimming. It's getting close to the power lines. Can I get a quote?",
    extractedData: { name: "Brian Kowalski", phone: "216-555-0182", email: "brian.kowalski@gmail.com", address: "4412 Mayfield Rd, Cleveland OH 44121", scope: "Oak tree trimming – proximity to power lines", serviceType: "Tree Trimming", urgency: "standard", inServiceArea: true },
    generatedResponse: "Hi Brian! Thanks for reaching out to Premier Tree Specialists. Important note: oak trimming season in Ohio is currently closed until November to prevent oak wilt disease. For trees near power lines, we always send an ISA-certified arborist to assess clearance requirements. We'll give you a call shortly to schedule a free estimate.\n\nPremier Tree Specialists | Cleveland: 216-245-8908 | Columbus: 614-526-2266",
    confidenceReason: "FAQ match: oak season restriction + power line protocol. All contact fields present.",
    channel: { text: true, email: true }, arbostarSynced: true,
  },
  {
    id: "L-002", source: "Website Form", status: "auto-sent", confidence: 88,
    receivedAt: "2026-04-25T08:02:00", respondedAt: "2026-04-25T08:02:41",
    customer: { name: "Sandra Mills", phone: "614-555-0394", email: "smills@outlook.com", address: "", city: "Westerville", state: "OH", zip: "43081" },
    rawMessage: "Service: Stump Grinding | We had a tree removed last fall and the stump is still there. Want it ground down before summer.",
    extractedData: { name: "Sandra Mills", phone: "614-555-0394", email: "smills@outlook.com", address: "Westerville OH 43081", scope: "Stump grinding – post-removal, pre-summer timeline", serviceType: "Stump Grinding", urgency: "standard", inServiceArea: true },
    generatedResponse: "Hi Sandra! Stump grinding is one of our most popular spring services – great timing. We'll call you at 614-555-0394 to set up a free estimate.\n\nPremier Tree Specialists | Cleveland: 216-245-8908 | Columbus: 614-526-2266",
    confidenceReason: "FAQ match: stump grinding + Columbus location. All contact fields present.",
    channel: { text: true, email: true }, arbostarSynced: true,
  },
  {
    id: "L-003", source: "AnswerForce", status: "review", confidence: 61,
    receivedAt: "2026-04-25T08:45:00", respondedAt: null,
    customer: { name: "Tom Erhardt", phone: "440-555-0271", email: "", address: "", city: "Parma Heights", state: "OH", zip: "44130" },
    rawMessage: "Call at 8:44 PM, Name: Tom Erhardt, Phone: 440-555-0271. Caller has a large tree leaning toward his house after last night's storm. Very concerned.",
    extractedData: { name: "Tom Erhardt", phone: "440-555-0271", email: "", address: "Parma Heights OH 44130", scope: "Storm-damaged tree leaning toward structure – urgent assessment", serviceType: "Emergency Service", urgency: "urgent", inServiceArea: true },
    generatedResponse: "Hi Tom – we received your message about the tree leaning toward your home. Our team is available for urgent assessments. An ISA-certified arborist will call you at 440-555-0271 as soon as possible.\n\nPremier Tree Specialists | Cleveland: 216-245-8908",
    confidenceReason: "Emergency keyword detected + no email on file. Draft ready — review before sending.",
    channel: { text: false, email: false }, arbostarSynced: false,
  },
  {
    id: "L-004", source: "Google LSA", status: "flagged", confidence: 22,
    receivedAt: "2026-04-25T09:33:00", respondedAt: null,
    customer: { name: "Derek Foss", phone: "513-555-0193", email: "dfoss@hotmail.com", address: "", city: "Cincinnati", state: "OH", zip: "45202" },
    rawMessage: "Service: Tree Removal | Need a tree removed from my backyard. Name: Derek Foss, Phone: 513-555-0193, Zip: 45202",
    extractedData: { name: "Derek Foss", phone: "513-555-0193", email: "dfoss@hotmail.com", address: "Cincinnati OH 45202", scope: "Tree removal – outside service area", serviceType: "Tree Removal", urgency: "standard", inServiceArea: false },
    generatedResponse: "",
    confidenceReason: "OUT OF SERVICE AREA: Zip 45202 (Cincinnati) is outside NE/Central Ohio coverage. No response generated.",
    channel: { text: false, email: false }, arbostarSynced: false,
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function responseTime(recv, resp) {
  if (!resp) return null;
  const s = Math.floor((new Date(resp) - new Date(recv)) / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s/60)}m ${s%60}s`;
}

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────
// Flagged = system blocked, no response generated (out of area, score < 50)
// Review  = system drafted a response, human must approve before it sends

const STATUS = {
  "auto-sent": {
    label: "Auto-Sent",
    icon: "⚡",
    pill: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    bar:  "bg-emerald-500",
    dot:  "bg-emerald-400",
    desc: "Response sent automatically",
  },
  "approved": {
    label: "Approved",
    icon: "✓",
    pill: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    bar:  "bg-emerald-500",
    dot:  "bg-emerald-400",
    desc: "Manually approved and sent",
  },
  "review": {
    label: "Needs Review",
    icon: "◐",
    pill: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    bar:  "bg-amber-500",
    dot:  "bg-amber-400",
    desc: "Draft ready — approve to send",
  },
  "flagged": {
    label: "Flagged",
    icon: "⊗",
    pill: "bg-red-500/15 text-red-300 border-red-500/30",
    bar:  "bg-red-500",
    dot:  "bg-red-400",
    desc: "Blocked — no response generated",
  },
  "rejected": {
    label: "Rejected",
    icon: "×",
    pill: "bg-slate-600/30 text-slate-400 border-slate-600/40",
    bar:  "bg-slate-600",
    dot:  "bg-slate-500",
    desc: "Manually rejected",
  },
};

const SOURCE = {
  "Google LSA":   { dot: "bg-sky-400",    text: "text-sky-300",    bg: "bg-sky-500/10",    border: "border-sky-500/25" },
  "Website Form": { dot: "bg-violet-400", text: "text-violet-300", bg: "bg-violet-500/10", border: "border-violet-500/25" },
  "AnswerForce":  { dot: "bg-amber-400",  text: "text-amber-300",  bg: "bg-amber-500/10",  border: "border-amber-500/25" },
};

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────

function SourceBadge({ source }) {
  const s = SOURCE[source] || SOURCE["Website Form"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${s.bg} ${s.text} ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {source}
    </span>
  );
}

function StatusPill({ status }) {
  const s = STATUS[status] || STATUS["flagged"];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${s.pill}`}>
      <span className="text-[10px]">{s.icon}</span> {s.label}
    </span>
  );
}

function ConfidenceRing({ score }) {
  const r = 18, circ = 2 * Math.PI * r;
  const fill = circ * (1 - score / 100);
  const color = score >= 80 ? "#34d399" : score >= 60 ? "#fbbf24" : "#f87171";
  return (
    <div className="relative flex-shrink-0 w-12 h-12 flex items-center justify-center">
      <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#1e293b" strokeWidth="3.5" />
        <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="3.5"
          strokeDasharray={circ} strokeDashoffset={fill} strokeLinecap="round" />
      </svg>
      <span className="absolute text-xs font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

// ─── STATS BAR ────────────────────────────────────────────────────────────────

function StatsBar({ leads }) {
  const total    = leads.length;
  const autoSent = leads.filter(l => l.status === "auto-sent" || l.status === "approved").length;
  const review   = leads.filter(l => l.status === "review").length;
  const flagged  = leads.filter(l => l.status === "flagged").length;
  const autoRate = total > 0 ? Math.round((autoSent / total) * 100) : 0;
  const responded = leads.filter(l => l.respondedAt);
  const subMin   = responded.filter(l => (new Date(l.respondedAt) - new Date(l.receivedAt)) / 1000 < 60).length;
  const subMinPct = responded.length > 0 ? Math.round((subMin / responded.length) * 100) : 0;

  const stats = [
    { label: "Total Leads",       value: total,         color: "#e2e8f0", tip: "" },
    { label: "Auto-Sent",         value: autoSent,      color: "#34d399", tip: "Sent automatically without human review" },
    { label: "Needs Review",      value: review,        color: "#fbbf24", tip: "Draft ready — approve to send" },
    { label: "Flagged / Blocked", value: flagged,       color: "#f87171", tip: "Blocked by system — out of area or too low confidence" },
    { label: "Automation Rate",   value: `${autoRate}%`, color: "#38bdf8", tip: "% of leads handled without manual work" },
    { label: "< 1 Min Response",  value: `${subMinPct}%`,
      color: subMinPct >= 80 ? "#34d399" : "#fbbf24",
      tip: `${subMin} of ${responded.length} responded leads answered in under 60s — Google LSA ranking signal` },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
      {stats.map(s => (
        <div key={s.label} title={s.tip}
          className="bg-[#0d1f1a]/80 border border-[#1a3a2a]/60 rounded-2xl p-4 text-center hover:border-[#2d6a4a]/60 transition-colors cursor-default">
          <div className="text-2xl font-black tracking-tight" style={{ color: s.color }}>{s.value}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium leading-tight">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── LEAD ROW ─────────────────────────────────────────────────────────────────

function LeadRow({ lead, onClick, selected }) {
  const st  = STATUS[lead.status] || STATUS["flagged"];
  const rt  = responseTime(lead.receivedAt, lead.respondedAt);
  const isUrgent = lead.extractedData?.urgency === "urgent";

  return (
    <div onClick={() => onClick(lead)} className={`
      group relative rounded-xl border cursor-pointer transition-all duration-150 overflow-hidden
      ${selected
        ? "border-emerald-500/50 bg-emerald-500/5 shadow-lg shadow-emerald-900/20"
        : "border-[#1e3a2a]/60 bg-[#0d1f1a]/60 hover:bg-[#0d1f1a]/90 hover:border-[#2d5a3a]/60"}
    `}>
      {/* Status left border */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${st.bar}`} />

      <div className="flex items-start gap-3 px-4 py-3.5 pl-5">
        <ConfidenceRing score={lead.confidence} />

        <div className="flex-1 min-w-0">
          {/* Top row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-slate-100 text-[15px] leading-tight">{lead.customer.name}</span>
            {isUrgent && <span className="text-[10px] font-bold text-red-400 border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 rounded">URGENT</span>}
            {!lead.customer.email && <span className="text-[10px] text-amber-400/70 border border-amber-500/20 bg-amber-500/8 px-1.5 py-0.5 rounded">No email</span>}
            {!lead.extractedData?.inServiceArea && <span className="text-[10px] text-red-400/70 border border-red-500/20 bg-red-500/8 px-1.5 py-0.5 rounded">Out of area</span>}
          </div>

          {/* Source + status */}
          <div className="flex items-center gap-2 mb-2">
            <SourceBadge source={lead.source} />
            <StatusPill status={lead.status} />
          </div>

          {/* Raw message preview */}
          <div className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-1">
            {lead.rawMessage}
          </div>

          {/* Scope */}
          {lead.extractedData?.scope && (
            <div className="text-xs text-slate-500 italic truncate">
              {lead.extractedData.serviceType} · {lead.extractedData.scope}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="text-right shrink-0 flex flex-col items-end gap-1">
          <div className="text-[11px] text-slate-500">{timeAgo(lead.receivedAt)}</div>
          {rt && <div className="text-[11px] text-emerald-400 font-semibold">⚡ {rt}</div>}
        </div>
      </div>

      {/* Flagged reason strip */}
      {lead.status === "flagged" && lead.confidenceReason && (
        <div className="mx-5 mb-3 px-3 py-2 bg-red-500/8 border border-red-500/20 rounded-lg text-[11px] text-red-300/80 leading-relaxed">
          <span className="font-semibold">⊗ Blocked: </span>{lead.confidenceReason}
        </div>
      )}

      {/* Review — show condensed draft */}
      {lead.status === "review" && lead.generatedResponse && (
        <div className="mx-5 mb-3 px-3 py-2 bg-amber-500/8 border border-amber-500/20 rounded-lg text-[11px] text-amber-200/70 leading-relaxed line-clamp-2">
          <span className="font-semibold text-amber-300">Draft: </span>{lead.generatedResponse}
        </div>
      )}
    </div>
  );
}

// ─── DETAIL PANEL ─────────────────────────────────────────────────────────────

function Section({ title, accent, children }) {
  return (
    <div className="mb-5">
      <div className={`text-[11px] font-bold uppercase tracking-[0.1em] mb-2.5 ${accent || "text-slate-500"}`}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value, wide }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <div className="text-[11px] text-slate-500 font-medium mb-0.5">{label}</div>
      <div className="text-sm text-slate-200 leading-snug">{value || <span className="text-slate-600">—</span>}</div>
    </div>
  );
}

function LeadDetail({ lead, onApprove, onReject, editedResponse, setEditedResponse }) {
  const [tab, setTab] = useState("overview");
  const st = STATUS[lead.status] || STATUS["flagged"];
  const rt = responseTime(lead.receivedAt, lead.respondedAt);

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "response", label: "Response" },
    { key: "raw",      label: "Raw Message" },
    { key: "arbostar", label: "ArboStar" },
  ];

  return (
    <div className="bg-[#0d1f1a]/70 border border-[#1e3a2a]/60 rounded-2xl overflow-hidden flex flex-col h-full">

      {/* ── Header ── */}
      <div className="px-6 pt-5 pb-0 border-b border-[#1e3a2a]/60">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-black text-slate-100 leading-tight">{lead.customer.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-slate-500">{lead.id}</span>
              <span className="text-slate-700">·</span>
              <span className="text-xs text-slate-500">{new Date(lead.receivedAt).toLocaleString()}</span>
              {rt && <span className="text-xs text-emerald-400 font-semibold">⚡ {rt}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <SourceBadge source={lead.source} />
            <StatusPill status={lead.status} />
          </div>
        </div>

        {/* Status description bar */}
        <div className={`mb-4 px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-2 ${st.pill}`}>
          <span>{st.icon}</span>
          <span>{st.desc}</span>
          {lead.status === "review" && <span className="ml-auto text-amber-300/60">Action required ↓</span>}
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors
                ${tab === t.key
                  ? "bg-[#1a3a2a] text-emerald-300 border-t border-l border-r border-[#2d6a4a]/60"
                  : "text-slate-500 hover:text-slate-300"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab body ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <>
            {/* Confidence + reason */}
            <Section title="Confidence Assessment">
              <div className="flex items-start gap-4 bg-[#0a1a14]/60 rounded-xl border border-[#1e3a2a]/60 p-4">
                <ConfidenceRing score={lead.confidence} />
                <div className="flex-1">
                  <div className={`text-sm font-bold mb-1 ${lead.confidence >= 80 ? "text-emerald-400" : lead.confidence >= 60 ? "text-amber-400" : "text-red-400"}`}>
                    {lead.confidence >= 80 ? "Auto-send threshold met" : lead.confidence >= 60 ? "Below threshold — review required" : "Too low — blocked"}
                  </div>
                  <div className="text-xs text-slate-400 leading-relaxed">{lead.confidenceReason}</div>
                </div>
              </div>
            </Section>

            {/* Contact + lead data */}
            <Section title="Lead Data">
              <div className="bg-[#0a1a14]/60 rounded-xl border border-[#1e3a2a]/60 p-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-4">
                  <Field label="Name"     value={lead.extractedData.name} />
                  <Field label="Phone"    value={lead.customer.phone || <span className="text-red-400">Missing</span>} />
                  <Field label="Email"    value={lead.customer.email || <span className="text-amber-400">Missing</span>} />
                  <Field label="Location" value={[lead.customer.city, lead.customer.state, lead.customer.zip].filter(Boolean).join(", ")} />
                  <Field label="Service"  value={lead.extractedData.serviceType} />
                  <Field label="Urgency"  value={
                    <span className={lead.extractedData.urgency === "urgent" ? "text-red-400 font-semibold" : "text-slate-300"}>
                      {lead.extractedData.urgency}
                    </span>
                  } />
                  <Field label="In Service Area" value={
                    lead.extractedData.inServiceArea
                      ? <span className="text-emerald-400">✓ Yes</span>
                      : <span className="text-red-400">✗ No — outside coverage</span>
                  } />
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 font-medium mb-1.5">Scope of Work</div>
                  <div className="text-sm text-slate-200 leading-relaxed bg-[#0d2a1e]/60 rounded-lg px-3 py-2.5 border border-[#1e3a2a]/40">
                    {lead.extractedData.scope}
                  </div>
                </div>
              </div>
            </Section>

            {/* Outreach */}
            <Section title="Dual-Channel Outreach">
              <div className="bg-[#0a1a14]/60 rounded-xl border border-[#1e3a2a]/60 p-4">
                <div className="flex gap-3 mb-3">
                  {[
                    { icon: "💬", label: "Text / iMessage", active: lead.channel.text },
                    { icon: "✉️", label: "Email",           active: lead.channel.email },
                  ].map(ch => (
                    <div key={ch.label} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium flex-1 justify-center
                      ${ch.active ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-slate-800/30 border-slate-700/30 text-slate-500"}`}>
                      <span>{ch.icon}</span>
                      <span>{ch.label}</span>
                      <span className={ch.active ? "text-emerald-400" : "text-slate-600"}>{ch.active ? "✓ Sent" : "—"}</span>
                    </div>
                  ))}
                </div>
                {lead.channel.text && lead.generatedResponse && (
                  <div className="bg-[#0d2a1e]/70 rounded-lg border border-[#1e3a2a]/50 p-3">
                    <div className="text-[11px] text-slate-500 mb-2">📱 iMessage sent to {lead.customer.phone} <span className="text-slate-700">(Agent Phone — demo mode)</span></div>
                    <div className="text-xs text-slate-300 leading-relaxed">{lead.generatedResponse}</div>
                  </div>
                )}
                {!lead.channel.text && lead.status === "review" && (
                  <div className="text-xs text-amber-400/70 bg-amber-500/5 border border-amber-500/15 rounded-lg p-3">
                    Outreach will send via iMessage + email once approved below.
                  </div>
                )}
                {!lead.channel.text && lead.status === "flagged" && (
                  <div className="text-xs text-red-400/70 bg-red-500/5 border border-red-500/15 rounded-lg p-3">
                    No outreach sent — lead was blocked by the system.
                  </div>
                )}
              </div>
            </Section>
          </>
        )}

        {/* ── RESPONSE ── */}
        {tab === "response" && (
          <>
            <Section title="Generated Response" accent={lead.status === "review" ? "text-amber-400" : "text-slate-500"}>
              {lead.generatedResponse ? (
                <>
                  {lead.status === "review" ? (
                    <div className="bg-[#0a1a14]/60 rounded-xl border border-amber-500/30 p-4">
                      <div className="text-xs text-amber-300/70 mb-3 font-medium">
                        ◐ Draft ready — edit if needed, then approve to send
                      </div>
                      <textarea
                        value={editedResponse}
                        onChange={e => setEditedResponse(e.target.value)}
                        rows={8}
                        className="w-full bg-[#0d2a1e]/70 border border-[#2d5a3a]/50 rounded-xl p-4 text-sm text-slate-200 resize-none focus:outline-none focus:border-emerald-500/60 leading-relaxed font-medium"
                      />
                      <div className="flex gap-3 mt-4">
                        <button onClick={onApprove}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold py-3 rounded-xl transition-colors shadow-lg shadow-emerald-900/30">
                          ✓ Approve & Send
                        </button>
                        <button onClick={onReject}
                          className="px-6 bg-slate-700/60 hover:bg-slate-700 text-slate-300 text-sm font-semibold py-3 rounded-xl transition-colors border border-slate-600/40">
                          Reject
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-2">Edits are logged to the audit trail.</p>
                    </div>
                  ) : (
                    <div className="bg-[#0a1a14]/60 rounded-xl border border-[#1e3a2a]/60 p-4 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {lead.generatedResponse}
                    </div>
                  )}

                  <div className="mt-3 p-3 bg-[#0a1a14]/40 rounded-lg border border-[#1e3a2a]/40">
                    <div className="text-[11px] text-slate-600 font-medium mb-1">Confidence Reasoning</div>
                    <div className="text-xs text-slate-400">{lead.confidenceReason}</div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-red-300/80 bg-red-500/5 border border-red-500/20 rounded-xl p-4 leading-relaxed">
                  ⊗ No response generated — confidence score ({lead.confidence}%) was too low.<br/>
                  <span className="text-xs text-red-400/60 mt-1 block">{lead.confidenceReason}</span>
                </div>
              )}
            </Section>

            {/* Email preview */}
            {lead.generatedResponse && lead.customer.email && (
              <Section title="Email Preview — SendGrid (demo mode)">
                <div className="rounded-xl border border-[#1e3a2a]/60 overflow-hidden text-xs">
                  <div className="bg-[#0a1a14]/80 px-4 py-3 border-b border-[#1e3a2a]/50 space-y-1">
                    <div className="flex gap-3"><span className="text-slate-600 w-10">To</span><span className="text-slate-300">{lead.customer.name} &lt;{lead.customer.email}&gt;</span></div>
                    <div className="flex gap-3"><span className="text-slate-600 w-10">From</span><span className="text-slate-300">Premier Tree Specialists &lt;customerservice@premiertreesllc.com&gt;</span></div>
                    <div className="flex gap-3"><span className="text-slate-600 w-10">Subj</span><span className="text-slate-300">Re: Your {lead.extractedData.serviceType} Enquiry — Premier Tree Specialists</span></div>
                  </div>
                  <div className="bg-[#081510]/50 p-5">
                    <div className="flex items-center gap-2 pb-3 mb-4 border-b border-emerald-800/40">
                      <span className="text-emerald-400 font-black text-base">🌲</span>
                      <div>
                        <div className="text-emerald-300 font-bold text-sm">Premier Tree Specialists</div>
                        <div className="text-slate-600 text-[11px]">Cleveland: 216-245-8908 · Columbus: 614-526-2266</div>
                      </div>
                    </div>
                    <div className="text-slate-200 leading-relaxed whitespace-pre-wrap text-sm">{lead.generatedResponse}</div>
                    <div className="border-t border-[#1e3a2a]/40 mt-4 pt-3 text-slate-600 text-[11px]">
                      Premier Tree Specialists LLC · ISA-Certified Arborists · Fully Insured · Serving Northeast & Central Ohio
                    </div>
                  </div>
                </div>
              </Section>
            )}
            {lead.generatedResponse && !lead.customer.email && (
              <div className="text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                ⚠️ No email address on file — email follow-up skipped. Text reply only.
              </div>
            )}
          </>
        )}

        {/* ── RAW MESSAGE ── */}
        {tab === "raw" && (
          <Section title="Raw Incoming Message">
            <div className="bg-[#0a1a14]/80 rounded-xl border border-[#1e3a2a]/60 p-4 text-sm text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
              {lead.rawMessage}
            </div>
            <div className="mt-3 text-xs text-slate-500">
              Source: <span className="text-slate-400">{lead.source}</span>
              {" · "}
              Received: <span className="text-slate-400">{new Date(lead.receivedAt).toLocaleString()}</span>
            </div>
          </Section>
        )}

        {/* ── ARBOSTAR ── */}
        {tab === "arbostar" && (
          <Section title="ArboStar CRM Sync">
            <div className={`flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg border text-sm font-medium
              ${lead.arbostarSynced
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-slate-700/20 border-slate-600/30 text-slate-400"}`}>
              {lead.arbostarSynced ? "✓ Synced to ArboStar" : "○ Pending — syncs after response is approved"}
            </div>
            <div className="bg-[#0a1a14]/80 rounded-xl p-4 border border-[#1e3a2a]/60">
              <div className="text-[11px] text-slate-600 font-semibold mb-2">POST payload</div>
              <pre className="text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
{JSON.stringify({
  name:          lead.customer.name,
  email:         lead.customer.email || null,
  phone:         lead.customer.phone,
  address:       lead.customer.address || null,
  city:          lead.customer.city,
  state:         lead.customer.state,
  postal:        lead.customer.zip,
  country:       "US",
  details:       lead.extractedData.scope,
  address_notes: `Source: ${lead.source}`,
}, null, 2)}
              </pre>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              Endpoint: <span className="text-slate-400 font-mono">https://[COMPANY_ID].arbostar.com/api/requests/create</span>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

// ─── ROW → UI SHAPE ───────────────────────────────────────────────────────────

function rowToLead(r) {
  return {
    id:                r.id,
    source:            r.source,
    status:            r.status,
    confidence:        r.confidence,
    receivedAt:        r.received_at,
    respondedAt:       r.responded_at ?? null,
    rawMessage:        r.raw_message,
    generatedResponse: r.generated_response ?? "",
    confidenceReason:  r.confidence_reason ?? "",
    customer: {
      name:    r.name,
      phone:   r.phone   ?? "",
      email:   r.email   ?? "",
      address: r.address ?? "",
      city:    r.city    ?? "",
      state:   r.state   ?? "OH",
      zip:     r.zip     ?? "",
    },
    extractedData: {
      name:          r.name,
      phone:         r.phone        ?? "",
      email:         r.email        ?? "",
      address:       [r.address, r.city, r.state, r.zip].filter(Boolean).join(", "),
      scope:         r.scope        ?? "",
      serviceType:   r.service_type ?? "Tree Service",
      urgency:       r.urgency      ?? "standard",
      inServiceArea: !!r.in_service_area,
    },
    channel:        { text: !!r.text_sent, email: !!r.email_sent },
    arbostarSynced: !!r.arbostar_synced,
  };
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [leads, setLeads]           = useState([]);
  const [selected, setSelected]     = useState(null);
  const [filter, setFilter]         = useState("all");
  const [editedResponse, setEdited] = useState("");
  const [toast, setToast]           = useState(null);
  const [simulating, setSim]        = useState(false);
  const [loading, setLoading]       = useState(true);
  const [simIdx, setSimIdx]         = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const tourDone = localStorage.getItem("pts_tour_done") === "1";
  const [tourPhase, setTourPhase] = useState(tourDone ? "done" : "landing"); // landing | tour | done

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchLeads = async (keepId = null) => {
    try {
      const res = await fetch("/api/leads");
      if (!res.ok) throw new Error();
      const rows = await res.json();
      const mapped = rows.map(rowToLead);
      setLeads(mapped);
      if (keepId) {
        const fresh = mapped.find(l => l.id === keepId);
        if (fresh) { setSelected(fresh); setEdited(fresh.generatedResponse || ""); }
      } else if (!selected) {
        const pick = mapped.find(l => l.status === "review") ?? mapped[0] ?? null;
        setSelected(pick);
        setEdited(pick?.generatedResponse ?? "");
      }
    } catch {
      if (leads.length === 0) {
        setLeads(MOCK_LEADS);
        const pick = MOCK_LEADS.find(l => l.status === "review") ?? MOCK_LEADS[0];
        setSelected(pick);
        setEdited(pick?.generatedResponse ?? "");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeads(); }, []);

  const handleSelect = lead => { setSelected(lead); setEdited(lead.generatedResponse || ""); };

  const handleApprove = async () => {
    try {
      const res = await fetch(`/api/respond/${selected.id}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editedResponse, actor: "dashboard-user" }),
      });
      if (!res.ok) throw new Error();
      showToast(`✓ Approved and sent to ${selected.customer.name}`);
      await fetchLeads(selected.id);
    } catch {
      setLeads(ls => ls.map(l => l.id === selected.id
        ? { ...l, status: "approved", generatedResponse: editedResponse,
            respondedAt: new Date().toISOString(),
            channel: { text: true, email: !!l.customer.email }, arbostarSynced: true }
        : l));
      setSelected(s => ({ ...s, status: "approved", generatedResponse: editedResponse,
        respondedAt: new Date().toISOString(), channel: { text: true, email: !!s.customer.email }, arbostarSynced: true }));
      showToast(`✓ Approved (offline mode) — ${selected.customer.name}`);
    }
  };

  const handleReject = async () => {
    try {
      const res = await fetch(`/api/respond/${selected.id}/reject`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Rejected via dashboard", actor: "dashboard-user" }),
      });
      if (!res.ok) throw new Error();
      showToast(`Rejected — ${selected.customer.name}`, "warn");
      await fetchLeads(selected.id);
    } catch {
      setLeads(ls => ls.map(l => l.id === selected.id ? { ...l, status: "rejected" } : l));
      setSelected(s => ({ ...s, status: "rejected" }));
      showToast(`Rejected (offline mode) — ${selected.customer.name}`, "warn");
    }
  };

  // ── Simulate scenarios ────────────────────────────────────────────────────

  const SIM = [
    {
      label: "Google LSA — tree trimming",
      source: "Google LSA",
      names:  ["Deborah Stafford","Carlos Rivera","Patrice Nguyen","Owen Fletcher","Simone Brady"],
      phones: ["216-555-0831","216-555-0144","216-555-0562","216-555-0789","216-555-0213"],
      emails: ["dstafford@gmail.com","crivera@gmail.com","pnguyen@gmail.com","ofletcher@gmail.com","sbrady@gmail.com"],
      city: "Parma", zip: "44129",
      rawMsg: (n,p) => `Hi, I have two large silver maples in my backyard that need trimming. They are starting to hang over the roof. Can you give me a quote? Name: ${n}, Phone: ${p}, Zip: 44129`,
      serviceType: "Tree Trimming", urgency: "standard", autoSend: true,
    },
    {
      label: "AnswerForce — after-hours emergency",
      source: "AnswerForce",
      names:  ["Greg Tanaka","Felicia Monroe","Darnell Obi","Lucy Hartman","Mo Saleh"],
      phones: ["614-555-0247","614-555-0388","614-555-0561","614-555-0692","614-555-0724"],
      emails: ["","","","",""],
      city: "Dublin", zip: "43017",
      rawMsg: (n,p) => `Call at 9:52 PM, Name: ${n}, Phone: ${p}, Details: Caller has a tree that fell during tonight's storm and is blocking the driveway. Needs emergency removal first thing tomorrow morning.`,
      serviceType: "Emergency Service", urgency: "urgent", autoSend: false,
    },
    {
      label: "Website form — stump grinding",
      source: "Website Form",
      names:  ["Anita Kowalczyk","Marcus Webb","Irene Castillo","Theo Patel","Nadia Osei"],
      phones: ["440-555-0193","440-555-0344","440-555-0477","440-555-0512","440-555-0638"],
      emails: ["akowalczyk@outlook.com","mwebb@gmail.com","icastillo@gmail.com","tpatel@gmail.com","nosei@outlook.com"],
      city: "Westlake", zip: "44145",
      rawMsg: (n,p) => `Service: Stump Grinding | We had a tree removed last year and need the stump ground down. It is in the middle of our backyard. Name: ${n}, Phone: ${p}, Zip: 44145`,
      serviceType: "Stump Grinding", urgency: "standard", autoSend: true,
    },
    {
      label: "Website form — plant health",
      source: "Website Form",
      names:  ["Yolanda Fischer","Bernard Lam","Cleo Adkins","Ray Popescu","Gwen Mbeki"],
      phones: ["216-555-0901","216-555-0433","216-555-0755","216-555-0867","216-555-0923"],
      emails: ["yfischer@gmail.com","blam@outlook.com","cadkins@gmail.com","rpopescu@gmail.com","gmbeki@outlook.com"],
      city: "Lakewood", zip: "44107",
      rawMsg: (n,p) => `Service: Plant Health Care | Several trees in my yard have yellowing leaves and some dead branches. I am worried about disease. Name: ${n}, Phone: ${p}, Zip: 44107`,
      serviceType: "Plant Health Care", urgency: "standard", autoSend: true,
    },
  ];

  const handleSimulate = async () => {
    setSim(true);
    const tpl     = SIM[simIdx % SIM.length];
    const ni      = Math.floor(simIdx / SIM.length) % tpl.names.length;
    const name    = tpl.names[ni], phone = tpl.phones[ni], email = tpl.emails[ni];
    const rawMsg  = tpl.rawMsg(name, phone);
    setSimIdx(i => i + 1);
    try {
      const ep = tpl.source === "Website Form" ? "/api/leads/ingest/form" : "/api/leads/ingest/email";
      const pl = tpl.source === "Website Form"
        ? { name, email, phone, zip: tpl.zip, serviceType: tpl.serviceType, message: rawMsg }
        : { from: email || "noreply@googleleadservices.com", subject: `New lead: ${tpl.serviceType}`, body: rawMsg, source: tpl.source === "AnswerForce" ? "AnswerForce" : "LSA" };
      const res = await fetch(ep, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pl) });
      if (!res.ok) throw new Error();
      const afterRes  = await fetch("/api/leads");
      const afterRows = await afterRes.json();
      const afterMapped = afterRows.map(rowToLead);
      setLeads(afterMapped);
      setFilter("all");
      if (afterMapped.length > 0) { setSelected(afterMapped[0]); setEdited(afterMapped[0].generatedResponse || ""); }
      showToast(tpl.autoSend ? `⚡ Auto-sent — ${name} (${tpl.source})` : `📥 Queued for review — ${name} (${tpl.source})`, tpl.autoSend ? "success" : "warn");
    } catch {
      showToast("⚠️ Simulate failed — check backend connection", "warn");
    } finally {
      setSim(false);
    }
  };

  // ── Filters ───────────────────────────────────────────────────────────────

  const FILTERS = [
    { key: "all",       label: "All Leads",     count: leads.length,                                      tip: "" },
    { key: "review",    label: "Needs Review",   count: leads.filter(l => l.status === "review").length,   tip: "Draft ready — needs human approval before sending" },
    { key: "auto-sent", label: "Auto-Sent",      count: leads.filter(l => l.status === "auto-sent" || l.status === "approved").length, tip: "Sent automatically or manually approved" },
    { key: "flagged",   label: "Flagged",        count: leads.filter(l => l.status === "flagged").length,  tip: "Blocked — out of area or confidence too low to draft a response" },
  ];

  const filtered = filter === "all" ? leads
    : filter === "auto-sent" ? leads.filter(l => l.status === "auto-sent" || l.status === "approved")
    : leads.filter(l => l.status === filter);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#060f0a" }}>
      <div className="text-center">
        <div className="text-4xl mb-4 animate-pulse">🌲</div>
        <div className="text-slate-500 text-sm">Loading leads…</div>
      </div>
    </div>
  );

  const nextSim = SIM[simIdx % SIM.length];

  return (
    <div className="min-h-screen text-slate-100 relative" style={{ background: "#060f0a", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;0,9..40,900;1,9..40,400&display=swap" rel="stylesheet" />

      {/* ── TOUR ── */}
      {tourPhase === "landing" && (
        <TourLanding
          onStartTour={() => setTourPhase("tour")}
          onSkip={() => { localStorage.setItem("pts_tour_done","1"); setTourPhase("done"); }}
        />
      )}
      {tourPhase === "tour" && (
        <TourOverlay onFinish={() => setTourPhase("done")} />
      )}

      {/* Forest background — fixed, behind everything */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        {/* Deep canopy gradient */}
        <div className="absolute inset-0" style={{
          background: "radial-gradient(ellipse 120% 80% at 50% 0%, #0a2a16 0%, #060f0a 55%, #040a07 100%)"
        }} />
        {/* Ambient light from top — like sunlight through leaves */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px]" style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(52,211,153,0.07) 0%, transparent 70%)"
        }} />
        {/* Forest floor vignette */}
        <div className="absolute bottom-0 inset-x-0 h-64" style={{
          background: "linear-gradient(to top, rgba(2,8,5,0.8) 0%, transparent 100%)"
        }} />
        {/* SVG tree silhouettes */}
        <svg className="absolute bottom-0 left-0 right-0 w-full opacity-[0.07]"
          viewBox="0 0 1440 320" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax meet">
          {/* Far background trees — shorter */}
          <g fill="#34d399">
            <polygon points="80,280 120,160 160,280"/>
            <polygon points="100,280 120,180 140,280"/>
            <polygon points="200,280 250,140 300,280"/>
            <polygon points="220,280 250,160 280,280"/>
            <polygon points="380,280 430,155 480,280"/>
            <polygon points="560,280 600,145 640,280"/>
            <polygon points="580,280 600,165 620,280"/>
            <polygon points="700,280 755,138 810,280"/>
            <polygon points="720,280 755,158 790,280"/>
            <polygon points="880,280 930,148 980,280"/>
            <polygon points="1060,280 1110,142 1160,280"/>
            <polygon points="1080,280 1110,162 1140,280"/>
            <polygon points="1240,280 1290,150 1340,280"/>
            <polygon points="1380,280 1420,158 1460,280"/>
          </g>
          {/* Foreground trees — taller, darker */}
          <g fill="#1a5c38" opacity="0.9">
            <polygon points="0,320 60,120 120,320"/>
            <polygon points="20,320 60,150 100,320"/>
            <polygon points="160,320 230,95 300,320"/>
            <polygon points="180,320 230,125 280,320"/>
            <polygon points="320,320 390,100 460,320"/>
            <polygon points="500,320 570,88 640,320"/>
            <polygon points="520,320 570,118 620,320"/>
            <polygon points="670,320 745,92 820,320"/>
            <polygon points="690,320 745,122 800,320"/>
            <polygon points="850,320 925,85 1000,320"/>
            <polygon points="870,320 925,115 980,320"/>
            <polygon points="1030,320 1100,96 1170,320"/>
            <polygon points="1210,320 1280,90 1350,320"/>
            <polygon points="1230,320 1280,120 1330,320"/>
            <polygon points="1390,320 1440,102 1490,320"/>
          </g>
          {/* Trunks */}
          <g fill="#0d3320" opacity="0.6">
            <rect x="56" y="270" width="8" height="50"/>
            <rect x="226" y="265" width="8" height="55"/>
            <rect x="426" y="268" width="8" height="52"/>
            <rect x="566" y="262" width="8" height="58"/>
            <rect x="741" y="260" width="8" height="60"/>
            <rect x="921" y="263" width="8" height="57"/>
            <rect x="1096" y="264" width="8" height="56"/>
            <rect x="1276" y="262" width="8" height="58"/>
          </g>
        </svg>
                {/* Subtle noise/grain overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px"
        }} />
      </div>

      {/* All content sits above the background */}
      <div className="relative" style={{ zIndex: 1 }}>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl border backdrop-blur-sm transition-all
          ${toast.type === "warn" ? "bg-amber-900/90 border-amber-500/40 text-amber-100" : "bg-emerald-900/90 border-emerald-500/40 text-emerald-100"}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <header style={{ background: "#0a1a12", borderBottom: "1px solid #1a3a22" }} className="px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
            style={{ background: "linear-gradient(135deg, #1a4a2a, #0d2a18)", border: "1px solid #2d6a3a" }}>
            🌲
          </div>
          <div>
            <div className="text-sm font-black text-slate-100 tracking-tight leading-none">Premier Tree Specialists</div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-medium">Lead Intake Dashboard</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Location */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 border border-[#1a3a22] px-3 py-1.5 rounded-lg"
            style={{ background: "#0a1a12" }}>
            <span className="text-[10px]">📍</span> Cleveland · Columbus
          </div>

          {/* Simulate button — block button with hover preview tooltip */}
          <div id="tour-simulate" className="relative group/sim">
            <button onClick={handleSimulate} disabled={simulating}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all
                ${simulating
                  ? "opacity-50 cursor-not-allowed border-slate-700/40 text-slate-500 bg-transparent"
                  : "border-sky-500/50 text-sky-200 hover:border-sky-400 hover:text-white"}`}
              style={simulating ? {} : { background: "linear-gradient(135deg, #0a2030, #0d2a3a)" }}>
              {simulating
                ? <><span className="inline-block animate-spin">⟳</span><span>Simulating…</span></>
                : <><span className="text-sky-400">⚡</span><span>Simulate Lead</span></>}
            </button>
            {/* Hover tooltip */}
            {!simulating && (
              <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-sky-500/20 shadow-2xl shadow-black/60 z-50
                opacity-0 group-hover/sim:opacity-100 pointer-events-none transition-opacity duration-200"
                style={{ background: "#0a1e2e" }}>
                <div className="p-4">
                  <div className="text-xs font-bold text-sky-300 mb-1">🧪 Simulate Inbound Lead</div>
                  <div className="text-[11px] text-slate-400 leading-relaxed mb-3">
                    Fires a realistic test lead through the full ingest pipeline — parsing, AI scoring, and response generation — exactly as a real customer enquiry would behave.
                  </div>
                  <div className="border-t border-sky-500/15 pt-3">
                    <div className="text-[11px] text-slate-500 mb-1 font-medium">Next scenario:</div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-sky-300 font-semibold">{nextSim.label}</span>
                    </div>
                    <div className="text-[10px] text-slate-600 mt-1">Cycles through 4 scenarios · 5 unique contacts each</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Settings button */}
          <button id="tour-settings" onClick={() => setShowSettings(s => !s)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all
              ${showSettings
                ? "border-emerald-500/60 text-emerald-300"
                : "border-[#1a3a22]/60 text-slate-500 hover:text-slate-300 hover:border-[#2d5a3a]/60"}`}
            style={{ background: showSettings ? "#0d2a1e" : "#0a1a12" }}>
            ⚙️ Settings
          </button>

          {/* Replay tour */}
          <ReplayTourButton onClick={() => setTourPhase("landing")} />

          {/* Live indicator */}
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-500 hidden sm:block">Live</span>
          </div>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-6">
        {showSettings && (
          <Settings onBack={() => setShowSettings(false)} />
        )}
        {!showSettings && (
        <div>

        {/* Stats */}
        <div id="tour-stats"><StatsBar leads={leads} /></div>

        {/* Filter tabs + legend */}
        <div id="tour-filters" className="flex items-center gap-2 mb-5 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} title={f.tip}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2
                ${filter === f.key
                  ? "border-emerald-500/60 text-emerald-300"
                  : "border-[#1a3a22]/60 text-slate-500 hover:text-slate-300 hover:border-[#2d5a3a]/60"}`}
              style={{ background: filter === f.key ? "#0d2a1e" : "#0a1a12" }}>
              <span>{f.label}</span>
              <span className={`px-1.5 py-0.5 rounded text-[11px] font-black
                ${filter === f.key ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800/60 text-slate-500"}`}>
                {f.count}
              </span>
            </button>
          ))}

          {/* Legend */}
          <div className="ml-auto hidden lg:flex items-center gap-4 text-[11px] text-slate-600">
            {[
              { color: "bg-emerald-500", label: "Auto-sent" },
              { color: "bg-amber-500",   label: "Needs review" },
              { color: "bg-red-500",     label: "Flagged / blocked" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${l.color}`} />
                {l.label}
              </div>
            ))}
          </div>
        </div>

        {/* Main two-column layout — list grows freely, detail panel sticks to viewport */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

          {/* Lead list — no max-height, grows with content */}
          <div id="tour-leadlist" className="lg:col-span-2 flex flex-col gap-2">
            {filtered.length === 0 ? (
              <div className="text-center text-slate-600 py-16 text-sm">No leads in this category</div>
            ) : (
              filtered.map(lead => (
                <LeadRow key={lead.id} lead={lead} onClick={handleSelect} selected={selected?.id === lead.id} />
              ))
            )}
          </div>

          {/* Detail panel — sticky to viewport, scrolls internally */}
          <div id="tour-detail" className="lg:col-span-3 sticky top-[72px]" style={{ height: "calc(100vh - 96px)" }}>
            {selected
              ? <LeadDetail
                  lead={selected}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  editedResponse={editedResponse}
                  setEditedResponse={setEdited}
                />
              : (
                <div className="flex flex-col items-center justify-center h-full text-slate-600 text-sm gap-3 rounded-2xl border border-[#1a3a22]/40"
                  style={{ background: "rgba(10,26,18,0.6)" }}>
                  <div className="text-4xl opacity-20">🌲</div>
                  <div>Select a lead to view details</div>
                </div>
              )
            }
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-[#1a3a22]/30 flex items-center justify-between text-[11px] text-slate-700">
          <span>Premier Tree Specialists LLC · Lead Intake Dashboard</span>
          <span>All leads persisted · Railway + SQLite</span>
        </div>
        </div>
        )}
      </div>
      </div>
    </div>
  );
}
