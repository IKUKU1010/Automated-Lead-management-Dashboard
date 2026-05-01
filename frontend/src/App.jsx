import { useState, useEffect } from "react";
import Settings from "./Settings.jsx";
import { TourLanding, TourOverlay } from "./Tour.jsx";

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const MOCK_LEADS = [
  { id:"L-001", source:"Google LSA", status:"auto-sent", confidence:92, receivedAt:"2026-04-25T07:14:00", respondedAt:"2026-04-25T07:14:38", customer:{name:"Brian Kowalski",phone:"216-555-0182",email:"brian.kowalski@gmail.com",address:"4412 Mayfield Rd",city:"Cleveland",state:"OH",zip:"44121"}, rawMessage:"Hi, I have a big oak tree in my backyard that needs trimming. It's getting close to the power lines. Can I get a quote?", extractedData:{name:"Brian Kowalski",phone:"216-555-0182",email:"brian.kowalski@gmail.com",address:"4412 Mayfield Rd, Cleveland OH 44121",scope:"Oak tree trimming – proximity to power lines",serviceType:"Tree Trimming",urgency:"standard",inServiceArea:true}, generatedResponse:"Hi Brian! Oak trimming season in Ohio is currently closed until November to prevent oak wilt disease. For trees near power lines, we always send an ISA-certified arborist. We'll call shortly to schedule a free estimate.\n\nPremier Tree Specialists | Cleveland: 216-245-8908 | Columbus: 614-526-2266", confidenceReason:"FAQ match: oak season restriction + power line protocol. All contact fields present.", channel:{text:true,email:true}, arbostarSynced:true },
  { id:"L-002", source:"Website Form", status:"auto-sent", confidence:88, receivedAt:"2026-04-25T08:02:00", respondedAt:"2026-04-25T08:02:41", customer:{name:"Sandra Mills",phone:"614-555-0394",email:"smills@outlook.com",address:"",city:"Westerville",state:"OH",zip:"43081"}, rawMessage:"Service: Stump Grinding | We had a tree removed last fall and the stump is still there. Want it ground down before summer.", extractedData:{name:"Sandra Mills",phone:"614-555-0394",email:"smills@outlook.com",address:"Westerville OH 43081",scope:"Stump grinding – post-removal, pre-summer timeline",serviceType:"Stump Grinding",urgency:"standard",inServiceArea:true}, generatedResponse:"Hi Sandra! Stump grinding is one of our most popular spring services – great timing. We'll call you at 614-555-0394 to set up a free estimate.\n\nPremier Tree Specialists | Cleveland: 216-245-8908 | Columbus: 614-526-2266", confidenceReason:"FAQ match: stump grinding + Columbus location. All contact fields present.", channel:{text:true,email:true}, arbostarSynced:true },
  { id:"L-003", source:"AnswerForce", status:"review", confidence:61, receivedAt:"2026-04-25T08:45:00", respondedAt:null, customer:{name:"Tom Erhardt",phone:"440-555-0271",email:"",address:"",city:"Parma Heights",state:"OH",zip:"44130"}, rawMessage:"Call at 8:44 PM, Name: Tom Erhardt, Phone: 440-555-0271. Caller has a large tree leaning toward his house after last night's storm. Very concerned.", extractedData:{name:"Tom Erhardt",phone:"440-555-0271",email:"",address:"Parma Heights OH 44130",scope:"Storm-damaged tree leaning toward structure – urgent assessment",serviceType:"Emergency Service",urgency:"urgent",inServiceArea:true}, generatedResponse:"Hi Tom – we received your message about the tree leaning toward your home. An ISA-certified arborist will call you at 440-555-0271 as soon as possible.\n\nPremier Tree Specialists | Cleveland: 216-245-8908", confidenceReason:"Emergency keyword detected + no email on file. Draft ready — review before sending.", channel:{text:false,email:false}, arbostarSynced:false },
  { id:"L-004", source:"Google LSA", status:"flagged", confidence:22, receivedAt:"2026-04-25T09:33:00", respondedAt:null, customer:{name:"Derek Foss",phone:"513-555-0193",email:"dfoss@hotmail.com",address:"",city:"Cincinnati",state:"OH",zip:"45202"}, rawMessage:"Service: Tree Removal | Need a tree removed from my backyard. Name: Derek Foss, Phone: 513-555-0193, Zip: 45202", extractedData:{name:"Derek Foss",phone:"513-555-0193",email:"dfoss@hotmail.com",address:"Cincinnati OH 45202",scope:"Tree removal – outside service area",serviceType:"Tree Removal",urgency:"standard",inServiceArea:false}, generatedResponse:"", confidenceReason:"OUT OF SERVICE AREA: Zip 45202 (Cincinnati) is outside NE/Central Ohio coverage. No response generated.", channel:{text:false,email:false}, arbostarSynced:false },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}
function responseTime(recv, resp) {
  if (!resp) return null;
  const s = Math.floor((new Date(resp) - new Date(recv)) / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s/60)}m ${s%60}s`;
}

// ─── DESIGN TOKENS (light theme) ─────────────────────────────────────────────
const STATUS = {
  "auto-sent": { label:"Auto-Sent",     icon:"⚡", bar:"bg-emerald-500", pill:"bg-emerald-50 text-emerald-700 border-emerald-200",   desc:"Response sent automatically" },
  "approved":  { label:"Approved",      icon:"✓",  bar:"bg-emerald-500", pill:"bg-emerald-50 text-emerald-700 border-emerald-200",   desc:"Manually approved and sent" },
  "review":    { label:"Needs Review",  icon:"◐",  bar:"bg-amber-400",   pill:"bg-amber-50  text-amber-700  border-amber-200",      desc:"Draft ready — approve to send" },
  "flagged":   { label:"Flagged",       icon:"⊗",  bar:"bg-red-400",     pill:"bg-red-50    text-red-700    border-red-200",        desc:"Blocked — no response generated" },
  "rejected":  { label:"Rejected",      icon:"×",  bar:"bg-gray-300",    pill:"bg-gray-50   text-gray-500   border-gray-200",       desc:"Manually rejected" },
};

const SOURCE_CONFIG = {
  "Google LSA":   { dot:"bg-sky-500",    text:"text-sky-700",    bg:"bg-sky-50",    border:"border-sky-200",   desc:"Enquiries sent directly through your Google Local Service Ads listing." },
  "Website Form": { dot:"bg-violet-500", text:"text-violet-700", bg:"bg-violet-50", border:"border-violet-200", desc:"Contact form submissions from premiertreesllc.com." },
  "AnswerForce":  { dot:"bg-orange-400", text:"text-orange-700", bg:"bg-orange-50", border:"border-orange-200", desc:"After-hours call transcripts emailed by your AnswerForce answering service." },
};

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
function SourceBadge({ source }) {
  const s = SOURCE_CONFIG[source] || SOURCE_CONFIG["Website Form"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.bg} ${s.text} ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {source}
    </span>
  );
}

function StatusPill({ status }) {
  const s = STATUS[status] || STATUS["flagged"];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.pill}`}>
      {s.icon} {s.label}
    </span>
  );
}

function ConfidenceRing({ score }) {
  const r = 18, circ = 2 * Math.PI * r;
  const fill = circ * (1 - score / 100);
  const color = score >= 80 ? "#16a34a" : score >= 60 ? "#d97706" : "#dc2626";
  return (
    <div className="relative flex-shrink-0 w-11 h-11 flex items-center justify-center">
      <svg width="44" height="44" viewBox="0 0 48 48" className="-rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
        <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="3.5"
          strokeDasharray={circ} strokeDashoffset={fill} strokeLinecap="round" />
      </svg>
      <span className="absolute text-[11px] font-bold" style={{ color }}>{score}</span>
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
  const subMin    = responded.filter(l => (new Date(l.respondedAt) - new Date(l.receivedAt)) / 1000 < 60).length;
  const subMinPct = responded.length > 0 ? Math.round((subMin / responded.length) * 100) : 0;

  const stats = [
    { label:"Total Leads",      value:total,          color:"text-gray-800",   tip:"All leads received across all channels" },
    { label:"Auto-Sent",        value:autoSent,        color:"text-emerald-600", tip:"Sent automatically without human review" },
    { label:"Needs Review",     value:review,          color:"text-amber-600",   tip:"Draft ready — approve to send" },
    { label:"Flagged",          value:flagged,         color:"text-red-600",     tip:"Blocked — out of area or too low confidence" },
    { label:"Automation Rate",  value:`${autoRate}%`,  color:"text-sky-600",     tip:"% of leads handled without manual work" },
    { label:"< 1 Min Response", value:`${subMinPct}%`, color:subMinPct>=80?"text-emerald-600":"text-amber-600",
      tip:`${subMin} of ${responded.length} leads replied in under 60s — Google LSA ranking signal` },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
      {stats.map(s => (
        <div key={s.label} title={s.tip}
          className="bg-white border border-gray-200 rounded-2xl p-4 text-center shadow-sm hover:shadow-md hover:border-gray-300 transition-all cursor-default">
          <div className={`text-2xl font-black tracking-tight ${s.color}`}>{s.value}</div>
          <div className="text-[11px] text-gray-500 mt-1 font-medium leading-tight">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── LEAD ROW ─────────────────────────────────────────────────────────────────
function LeadRow({ lead, onClick, selected }) {
  const st = STATUS[lead.status] || STATUS["flagged"];
  const rt = responseTime(lead.receivedAt, lead.respondedAt);
  const isUrgent = lead.extractedData?.urgency === "urgent";

  return (
    <div onClick={() => onClick(lead)}
      className={`relative rounded-xl border cursor-pointer transition-all duration-150 overflow-hidden
        ${selected
          ? "border-emerald-400 bg-emerald-50 shadow-md"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"}`}>

      {/* Status left border */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${st.bar}`} />

      <div className="pl-4 pr-3 py-3">
        {/* Row 1: name + time */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <ConfidenceRing score={lead.confidence} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-gray-900 text-sm leading-tight">{lead.customer.name}</span>
                {isUrgent && <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">URGENT</span>}
                {!lead.customer.email && <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">No email</span>}
                {!lead.extractedData?.inServiceArea && <span className="text-[10px] text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">Out of area</span>}
              </div>
              {/* Row 2: badges */}
              <div className="flex items-center gap-1.5 mt-1">
                <SourceBadge source={lead.source} />
                <StatusPill status={lead.status} />
              </div>
            </div>
          </div>
          <div className="text-right shrink-0 ml-2">
            <div className="text-[11px] text-gray-400">{timeAgo(lead.receivedAt)}</div>
            {rt && <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">⚡ {rt}</div>}
          </div>
        </div>

        {/* Row 3: message preview */}
        <div className="text-xs text-gray-500 leading-relaxed line-clamp-2 ml-[52px]">
          {lead.rawMessage}
        </div>

        {/* Row 4: scope */}
        {lead.extractedData?.scope && (
          <div className="text-[11px] text-gray-400 italic truncate mt-0.5 ml-[52px]">
            {lead.extractedData.serviceType} · {lead.extractedData.scope}
          </div>
        )}

        {/* Flagged strip */}
        {lead.status === "flagged" && lead.confidenceReason && (
          <div className="mt-2 ml-[52px] px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700 leading-relaxed">
            <span className="font-semibold">⊗ Blocked: </span>{lead.confidenceReason}
          </div>
        )}

        {/* Review draft strip */}
        {lead.status === "review" && lead.generatedResponse && (
          <div className="mt-2 ml-[52px] px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 line-clamp-2 leading-relaxed">
            <span className="font-semibold">Draft: </span>{lead.generatedResponse}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DETAIL PANEL ─────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="mb-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-gray-400 mb-2.5">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[11px] text-gray-400 font-medium mb-0.5">{label}</div>
      <div className="text-sm text-gray-800 leading-snug">{value || <span className="text-gray-300">—</span>}</div>
    </div>
  );
}

function LeadDetail({ lead, onApprove, onReject, editedResponse, setEditedResponse }) {
  const [tab, setTab] = useState("overview");
  const st = STATUS[lead.status] || STATUS["flagged"];
  const rt = responseTime(lead.receivedAt, lead.respondedAt);

  useEffect(() => { setTab("overview"); }, [lead.id]);

  const tabs = [
    { key:"overview", label:"Overview" },
    { key:"response", label:"Response" },
    { key:"raw",      label:"Raw Message" },
    { key:"arbostar", label:"ArboStar" },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col h-full shadow-sm">

      {/* Header */}
      <div className="px-6 pt-5 pb-0 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-xl font-black text-gray-900 leading-tight">{lead.customer.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-400">
              <span>{lead.id}</span>
              <span>·</span>
              <span>{new Date(lead.receivedAt).toLocaleString()}</span>
              {rt && <span className="text-emerald-600 font-semibold">⚡ {rt}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <SourceBadge source={lead.source} />
            <StatusPill status={lead.status} />
          </div>
        </div>

        {/* Status bar */}
        <div className={`mb-3 px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-2 ${st.pill}`}>
          <span>{st.icon}</span>
          <span>{st.desc}</span>
          {lead.status === "review" && <span className="ml-auto text-amber-500">Action required ↓</span>}
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors
                ${tab === t.key
                  ? "bg-gray-50 text-emerald-700 border-t border-l border-r border-gray-200"
                  : "text-gray-400 hover:text-gray-600"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 bg-gray-50">

        {tab === "overview" && (
          <>
            <Section title="Confidence Assessment">
              <div className="flex items-start gap-4 bg-white rounded-xl border border-gray-200 p-4">
                <ConfidenceRing score={lead.confidence} />
                <div className="flex-1">
                  <div className={`text-sm font-bold mb-1 ${lead.confidence >= 80 ? "text-emerald-600" : lead.confidence >= 60 ? "text-amber-600" : "text-red-600"}`}>
                    {lead.confidence >= 80 ? "Auto-send threshold met" : lead.confidence >= 60 ? "Below threshold — review required" : "Too low — blocked"}
                  </div>
                  <div className="text-xs text-gray-500 leading-relaxed">{lead.confidenceReason}</div>
                </div>
              </div>
            </Section>

            <Section title="Lead Data">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-4">
                  <Field label="Name"     value={lead.extractedData.name} />
                  <Field label="Phone"    value={lead.customer.phone || <span className="text-red-500 text-xs">Missing</span>} />
                  <Field label="Email"    value={lead.customer.email || <span className="text-amber-500 text-xs">Missing</span>} />
                  <Field label="Location" value={[lead.customer.city, lead.customer.state, lead.customer.zip].filter(Boolean).join(", ")} />
                  <Field label="Service"  value={lead.extractedData.serviceType} />
                  <Field label="Urgency"  value={
                    <span className={lead.extractedData.urgency === "urgent" ? "text-red-600 font-semibold" : "text-gray-700"}>
                      {lead.extractedData.urgency}
                    </span>
                  } />
                  <Field label="In Service Area" value={
                    lead.extractedData.inServiceArea
                      ? <span className="text-emerald-600">✓ Yes</span>
                      : <span className="text-red-600">✗ No — outside coverage</span>
                  } />
                </div>
                <div>
                  <div className="text-[11px] text-gray-400 font-medium mb-1.5">Scope of Work</div>
                  <div className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">
                    {lead.extractedData.scope}
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Dual-Channel Outreach">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex gap-3 mb-3">
                  {[
                    { icon:"💬", label:"Text / iMessage", active:lead.channel.text },
                    { icon:"✉️", label:"Email",           active:lead.channel.email },
                  ].map(ch => (
                    <div key={ch.label} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium flex-1 justify-center
                      ${ch.active ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-50 border-gray-200 text-gray-400"}`}>
                      <span>{ch.icon}</span><span>{ch.label}</span>
                      <span>{ch.active ? "✓ Sent" : "—"}</span>
                    </div>
                  ))}
                </div>
                {lead.channel.text && lead.generatedResponse && (
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                    <div className="text-[11px] text-gray-400 mb-2">📱 iMessage to {lead.customer.phone} <span className="text-gray-300">(Agent Phone — demo mode)</span></div>
                    <div className="text-xs text-gray-700 leading-relaxed">{lead.generatedResponse}</div>
                  </div>
                )}
                {!lead.channel.text && lead.status === "review" && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    Outreach will send via iMessage + email once approved below.
                  </div>
                )}
                {!lead.channel.text && lead.status === "flagged" && (
                  <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                    No outreach sent — lead was blocked by the system.
                  </div>
                )}
              </div>
            </Section>
          </>
        )}

        {tab === "response" && (
          <>
            <Section title={lead.status === "review" ? "Draft Response — Approve to Send" : "Generated Response"}>
              {lead.generatedResponse ? (
                <>
                  {lead.status === "review" ? (
                    <div className="bg-white rounded-xl border border-amber-200 p-4">
                      <div className="text-xs text-amber-700 mb-3 font-medium bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                        ◐ Draft ready — edit if needed, then approve to send
                      </div>
                      <textarea
                        value={editedResponse}
                        onChange={e => setEditedResponse(e.target.value)}
                        rows={8}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-800 resize-none focus:outline-none focus:border-emerald-400 leading-relaxed"
                      />
                      <div className="flex gap-3 mt-3">
                        <button onClick={onApprove}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-3 rounded-xl transition-colors shadow-sm">
                          ✓ Approve & Send
                        </button>
                        <button onClick={onReject}
                          className="px-5 bg-white hover:bg-gray-50 text-gray-600 text-sm font-semibold py-3 rounded-xl border border-gray-200 transition-colors">
                          Reject
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-2">Edits are logged to the audit trail.</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {lead.generatedResponse}
                    </div>
                  )}
                  <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                    <div className="text-[11px] text-gray-400 font-medium mb-1">Confidence Reasoning</div>
                    <div className="text-xs text-gray-600">{lead.confidenceReason}</div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-4 leading-relaxed">
                  ⊗ No response generated — confidence score ({lead.confidence}%) was too low.<br/>
                  <span className="text-xs text-red-500 mt-1 block">{lead.confidenceReason}</span>
                </div>
              )}
            </Section>

            {lead.generatedResponse && lead.customer.email && (
              <Section title="Email Preview — SendGrid (demo mode)">
                <div className="rounded-xl border border-gray-200 overflow-hidden text-xs bg-white">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 space-y-1">
                    <div className="flex gap-3"><span className="text-gray-400 w-10">To</span><span className="text-gray-700">{lead.customer.name} &lt;{lead.customer.email}&gt;</span></div>
                    <div className="flex gap-3"><span className="text-gray-400 w-10">From</span><span className="text-gray-700">Premier Tree Specialists &lt;customerservice@premiertreesllc.com&gt;</span></div>
                    <div className="flex gap-3"><span className="text-gray-400 w-10">Subj</span><span className="text-gray-700">Re: Your {lead.extractedData.serviceType} Enquiry — Premier Tree Specialists</span></div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 pb-3 mb-4 border-b border-gray-100">
                      <span className="text-2xl">🌲</span>
                      <div>
                        <div className="text-emerald-700 font-bold text-sm">Premier Tree Specialists</div>
                        <div className="text-gray-400 text-[11px]">Cleveland: 216-245-8908 · Columbus: 614-526-2266</div>
                      </div>
                    </div>
                    <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">{lead.generatedResponse}</div>
                    <div className="border-t border-gray-100 mt-4 pt-3 text-gray-400 text-[11px]">
                      Premier Tree Specialists LLC · ISA-Certified Arborists · Fully Insured · Serving Northeast & Central Ohio
                    </div>
                  </div>
                </div>
              </Section>
            )}
            {lead.generatedResponse && !lead.customer.email && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                ⚠️ No email address on file — email follow-up skipped. Text reply only.
              </div>
            )}
          </>
        )}

        {tab === "raw" && (
          <Section title="Raw Incoming Message">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-700 font-mono leading-relaxed whitespace-pre-wrap">
              {lead.rawMessage}
            </div>
            <div className="mt-3 text-xs text-gray-400">
              Source: <span className="text-gray-600">{lead.source}</span>
              {" · "}
              Received: <span className="text-gray-600">{new Date(lead.receivedAt).toLocaleString()}</span>
            </div>
          </Section>
        )}

        {tab === "arbostar" && (
          <Section title="ArboStar CRM Sync">
            <div className={`flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg border text-sm font-medium
              ${lead.arbostarSynced
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-gray-50 border-gray-200 text-gray-500"}`}>
              {lead.arbostarSynced ? "✓ Synced to ArboStar" : "○ Pending — syncs after response is approved"}
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-[11px] text-gray-400 font-semibold mb-2">POST payload</div>
              <pre className="text-xs text-gray-600 font-mono leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border border-gray-200">
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
            <div className="mt-3 text-xs text-gray-400">
              Endpoint: <span className="text-gray-600 font-mono">https://[COMPANY_ID].arbostar.com/api/requests/create</span>
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
    customer: { name:r.name, phone:r.phone??"", email:r.email??"", address:r.address??"", city:r.city??"", state:r.state??"OH", zip:r.zip??"" },
    extractedData: { name:r.name, phone:r.phone??"", email:r.email??"", address:[r.address,r.city,r.state,r.zip].filter(Boolean).join(", "), scope:r.scope??"", serviceType:r.service_type??"Tree Service", urgency:r.urgency??"standard", inServiceArea:!!r.in_service_area },
    channel:        { text:!!r.text_sent, email:!!r.email_sent },
    arbostarSynced: !!r.arbostar_synced,
  };
}

// ─── SOURCE INBOX TABS ────────────────────────────────────────────────────────
const SOURCE_TABS = [
  { key:"all",          label:"All Sources",  dot:"bg-gray-400",   desc:"All inbound leads from every channel combined." },
  { key:"Google LSA",   label:"Google LSA",   dot:"bg-sky-500",    desc:SOURCE_CONFIG["Google LSA"].desc },
  { key:"Website Form", label:"Website Form", dot:"bg-violet-500", desc:SOURCE_CONFIG["Website Form"].desc },
  { key:"AnswerForce",  label:"AnswerForce",  dot:"bg-orange-400", desc:SOURCE_CONFIG["AnswerForce"].desc },
];

const STATUS_FILTERS = [
  { key:"all",       label:"All"          },
  { key:"review",    label:"Needs Review" },
  { key:"auto-sent", label:"Auto-Sent"    },
  { key:"flagged",   label:"Flagged"      },
];

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [leads, setLeads]           = useState([]);
  const [selected, setSelected]     = useState(null);
  const [sourceTab, setSourceTab]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editedResponse, setEdited] = useState("");
  const [toast, setToast]           = useState(null);
  const [simulating, setSim]        = useState(false);
  const [loading, setLoading]       = useState(true);
  const [simIdx, setSimIdx]         = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const tourDone = localStorage.getItem("pts_tour_done") === "1";
  const [tourPhase, setTourPhase]   = useState(tourDone ? "done" : "landing");

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

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
        setSelected(pick); setEdited(pick?.generatedResponse ?? "");
      }
    } catch {
      if (leads.length === 0) {
        setLeads(MOCK_LEADS);
        const pick = MOCK_LEADS.find(l => l.status === "review") ?? MOCK_LEADS[0];
        setSelected(pick); setEdited(pick?.generatedResponse ?? "");
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchLeads(); }, []);

  const handleSelect   = lead => { setSelected(lead); setEdited(lead.generatedResponse || ""); };

  const handleApprove = async () => {
    try {
      const res = await fetch(`/api/respond/${selected.id}/approve`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ editedResponse, actor:"dashboard-user" }) });
      if (!res.ok) throw new Error();
      showToast(`✓ Approved and sent to ${selected.customer.name}`);
      await fetchLeads(selected.id);
    } catch {
      setLeads(ls => ls.map(l => l.id === selected.id ? { ...l, status:"approved", generatedResponse:editedResponse, respondedAt:new Date().toISOString(), channel:{text:true,email:!!l.customer.email}, arbostarSynced:true } : l));
      setSelected(s => ({ ...s, status:"approved", generatedResponse:editedResponse, respondedAt:new Date().toISOString(), channel:{text:true,email:!!s.customer.email}, arbostarSynced:true }));
      showToast(`✓ Approved (offline) — ${selected.customer.name}`);
    }
  };

  const handleReject = async () => {
    try {
      const res = await fetch(`/api/respond/${selected.id}/reject`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ reason:"Rejected via dashboard", actor:"dashboard-user" }) });
      if (!res.ok) throw new Error();
      showToast(`Rejected — ${selected.customer.name}`, "warn");
      await fetchLeads(selected.id);
    } catch {
      setLeads(ls => ls.map(l => l.id === selected.id ? { ...l, status:"rejected" } : l));
      setSelected(s => ({ ...s, status:"rejected" }));
      showToast(`Rejected — ${selected.customer.name}`, "warn");
    }
  };

  // ── Simulate ─────────────────────────────────────────────────────────────
  const SIM = [
    { label:"Google LSA — tree trimming", source:"Google LSA", names:["Deborah Stafford","Carlos Rivera","Patrice Nguyen","Owen Fletcher","Simone Brady"], phones:["216-555-0831","216-555-0144","216-555-0562","216-555-0789","216-555-0213"], emails:["dstafford@gmail.com","crivera@gmail.com","pnguyen@gmail.com","ofletcher@gmail.com","sbrady@gmail.com"], city:"Parma", zip:"44129", rawMsg:(n,p)=>`Hi, I have two large silver maples in my backyard that need trimming. They are starting to hang over the roof. Can you give me a quote? Name: ${n}, Phone: ${p}, Zip: 44129`, serviceType:"Tree Trimming", urgency:"standard", autoSend:true },
    { label:"AnswerForce — after-hours emergency", source:"AnswerForce", names:["Greg Tanaka","Felicia Monroe","Darnell Obi","Lucy Hartman","Mo Saleh"], phones:["614-555-0247","614-555-0388","614-555-0561","614-555-0692","614-555-0724"], emails:["","","","",""], city:"Dublin", zip:"43017", rawMsg:(n,p)=>`Call at 9:52 PM, Name: ${n}, Phone: ${p}, Details: Caller has a tree that fell during tonight's storm and is blocking the driveway.`, serviceType:"Emergency Service", urgency:"urgent", autoSend:false },
    { label:"Website form — stump grinding", source:"Website Form", names:["Anita Kowalczyk","Marcus Webb","Irene Castillo","Theo Patel","Nadia Osei"], phones:["440-555-0193","440-555-0344","440-555-0477","440-555-0512","440-555-0638"], emails:["akowalczyk@outlook.com","mwebb@gmail.com","icastillo@gmail.com","tpatel@gmail.com","nosei@outlook.com"], city:"Westlake", zip:"44145", rawMsg:(n,p)=>`Service: Stump Grinding | We had a tree removed last year and need the stump ground down. Name: ${n}, Phone: ${p}, Zip: 44145`, serviceType:"Stump Grinding", urgency:"standard", autoSend:true },
    { label:"Website form — plant health", source:"Website Form", names:["Yolanda Fischer","Bernard Lam","Cleo Adkins","Ray Popescu","Gwen Mbeki"], phones:["216-555-0901","216-555-0433","216-555-0755","216-555-0867","216-555-0923"], emails:["yfischer@gmail.com","blam@outlook.com","cadkins@gmail.com","rpopescu@gmail.com","gmbeki@outlook.com"], city:"Lakewood", zip:"44107", rawMsg:(n,p)=>`Service: Plant Health Care | Several trees in my yard have yellowing leaves and dead branches. I am worried about disease. Name: ${n}, Phone: ${p}, Zip: 44107`, serviceType:"Plant Health Care", urgency:"standard", autoSend:true },
  ];

  const handleSimulate = async () => {
    setSim(true);
    const tpl = SIM[simIdx % SIM.length];
    const ni = Math.floor(simIdx / SIM.length) % tpl.names.length;
    const name = tpl.names[ni], phone = tpl.phones[ni], email = tpl.emails[ni];
    const rawMsg = tpl.rawMsg(name, phone);
    setSimIdx(i => i + 1);
    try {
      const ep = tpl.source === "Website Form" ? "/api/leads/ingest/form" : "/api/leads/ingest/email";
      const pl = tpl.source === "Website Form"
        ? { name, email, phone, zip:tpl.zip, serviceType:tpl.serviceType, message:rawMsg }
        : { from:email||"noreply@googleleadservices.com", subject:`New lead: ${tpl.serviceType}`, body:rawMsg, source:tpl.source==="AnswerForce"?"AnswerForce":"LSA" };
      const res = await fetch(ep, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(pl) });
      if (!res.ok) throw new Error();
      const after = await (await fetch("/api/leads")).json();
      const mapped = after.map(rowToLead);
      setLeads(mapped); setSourceTab("all"); setStatusFilter("all");
      if (mapped.length > 0) { setSelected(mapped[0]); setEdited(mapped[0].generatedResponse || ""); }
      showToast(tpl.autoSend ? `⚡ Auto-sent — ${name}` : `📥 Queued for review — ${name}`, tpl.autoSend ? "success" : "warn");
    } catch { showToast("⚠️ Simulate failed — check backend", "warn"); }
    finally { setSim(false); }
  };

  // ── Filtering ─────────────────────────────────────────────────────────────
  const bySource = sourceTab === "all" ? leads : leads.filter(l => l.source === sourceTab);
  const filtered = statusFilter === "all" ? bySource
    : statusFilter === "auto-sent" ? bySource.filter(l => l.status === "auto-sent" || l.status === "approved")
    : bySource.filter(l => l.status === statusFilter);

  const sourceCount = (key) => key === "all" ? leads.length : leads.filter(l => l.source === key).length;
  const statusCount = (key) => {
    const base = sourceTab === "all" ? leads : leads.filter(l => l.source === sourceTab);
    if (key === "all") return base.length;
    if (key === "auto-sent") return base.filter(l => l.status === "auto-sent" || l.status === "approved").length;
    return base.filter(l => l.status === key).length;
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-pulse">🌲</div>
        <div className="text-gray-400 text-sm">Loading leads…</div>
      </div>
    </div>
  );

  const nextSim = SIM[simIdx % SIM.length];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900" style={{ fontFamily:"'DM Sans', system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;0,9..40,900&display=swap" rel="stylesheet" />

      {/* Tour */}
      {tourPhase === "landing" && <TourLanding onStartTour={() => setTourPhase("tour")} onSkip={() => { localStorage.setItem("pts_tour_done","1"); setTourPhase("done"); }} />}
      {tourPhase === "tour"    && <TourOverlay onFinish={() => setTourPhase("done")} />}

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl border
          ${toast.type === "warn" ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl bg-emerald-600 shadow-sm">
            🌲
          </div>
          <div>
            <div className="text-sm font-black text-gray-900 tracking-tight leading-none">Premier Tree Specialists</div>
            <div className="text-[11px] text-gray-400 mt-0.5 font-medium">Lead Intake Dashboard</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Location */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 bg-gray-50 px-3 py-1.5 rounded-lg">
            <span>📍</span> Cleveland · Columbus
          </div>

          {/* Simulate */}
          <div id="tour-simulate" className="relative group/sim">
            <button onClick={handleSimulate} disabled={simulating}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border transition-all
                ${simulating
                  ? "opacity-50 cursor-not-allowed border-gray-200 text-gray-400 bg-gray-50"
                  : "border-sky-200 text-sky-700 bg-sky-50 hover:bg-sky-100 hover:border-sky-300"}`}>
              {simulating
                ? <><span className="inline-block animate-spin">⟳</span><span>Simulating…</span></>
                : <><span>⚡</span><span>Simulate Lead</span></>}
            </button>
            {!simulating && (
              <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-gray-200 shadow-xl z-50
                opacity-0 group-hover/sim:opacity-100 pointer-events-none transition-opacity duration-200 bg-white">
                <div className="p-4">
                  <div className="text-xs font-bold text-gray-800 mb-1">🧪 Simulate Inbound Lead</div>
                  <div className="text-[11px] text-gray-500 leading-relaxed mb-3">Fires a realistic test lead through the full ingest pipeline — parsing, AI scoring, and response generation.</div>
                  <div className="border-t border-gray-100 pt-3">
                    <div className="text-[11px] text-gray-400 mb-1 font-medium">Next scenario:</div>
                    <div className="text-[11px] text-sky-700 font-semibold">{nextSim.label}</div>
                    <div className="text-[10px] text-gray-400 mt-1">Cycles through 4 scenarios · 5 unique contacts each</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Settings */}
          <button id="tour-settings" onClick={() => setShowSettings(s => !s)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all
              ${showSettings
                ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50 hover:border-gray-300"}`}>
            ⚙️ Settings
          </button>

          {/* Take a Tour button */}
          <button onClick={() => setTourPhase("landing")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-gray-200 text-gray-500 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all">
            🗺 Take a Tour
          </button>

          {/* Live indicator */}
          <div className="flex items-center gap-1.5 pl-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-gray-400 hidden sm:block">Live</span>
          </div>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-6">
        {showSettings && <Settings onBack={() => setShowSettings(false)} />}
        {!showSettings && (
          <div>
            {/* Stats */}
            <div id="tour-stats"><StatsBar leads={leads} /></div>

            {/* Source inbox tabs */}
            <div id="tour-filters" className="mb-4">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                {SOURCE_TABS.map(tab => (
                  <div key={tab.key} className="relative group/src">
                    <button onClick={() => setSourceTab(tab.key)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all
                        ${sourceTab === tab.key
                          ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}>
                      <span className={`w-2 h-2 rounded-full ${tab.dot}`} />
                      {tab.label}
                      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full
                        ${sourceTab === tab.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                        {sourceCount(tab.key)}
                      </span>
                    </button>
                    {/* Hover description */}
                    <div className="absolute top-full left-0 mt-1.5 w-64 bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 text-xs text-gray-600 leading-relaxed z-30
                      opacity-0 group-hover/src:opacity-100 pointer-events-none transition-opacity duration-150">
                      {tab.desc}
                    </div>
                  </div>
                ))}
              </div>

              {/* Status filter chips */}
              <div className="flex items-center gap-2 flex-wrap">
                {STATUS_FILTERS.map(f => {
                  const cnt = statusCount(f.key);
                  const color = f.key === "review" ? "text-amber-700 border-amber-200 bg-amber-50" : f.key === "auto-sent" ? "text-emerald-700 border-emerald-200 bg-emerald-50" : f.key === "flagged" ? "text-red-700 border-red-200 bg-red-50" : "text-gray-600 border-gray-200 bg-white";
                  const activeColor = f.key === "review" ? "bg-amber-500 text-white border-amber-500" : f.key === "auto-sent" ? "bg-emerald-600 text-white border-emerald-600" : f.key === "flagged" ? "bg-red-500 text-white border-red-500" : "bg-gray-800 text-white border-gray-800";
                  return (
                    <button key={f.key} onClick={() => setStatusFilter(f.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                        ${statusFilter === f.key ? activeColor : color}`}>
                      {f.label}
                      <span className={`text-[11px] font-bold ${statusFilter === f.key ? "opacity-80" : ""}`}>{cnt}</span>
                    </button>
                  );
                })}

                {/* Legend */}
                <div className="ml-auto hidden lg:flex items-center gap-4 text-[11px] text-gray-400">
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"/><span>Auto-sent</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400"/><span>Review</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-400"/><span>Flagged</span></div>
                </div>
              </div>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">

              {/* Lead list */}
              <div id="tour-leadlist" className="lg:col-span-2 flex flex-col gap-2">
                {filtered.length === 0 ? (
                  <div className="text-center text-gray-400 py-16 text-sm bg-white rounded-xl border border-gray-200">
                    No leads in this view
                  </div>
                ) : (
                  filtered.map(lead => (
                    <LeadRow key={lead.id} lead={lead} onClick={handleSelect} selected={selected?.id === lead.id} />
                  ))
                )}
              </div>

              {/* Detail panel */}
              <div id="tour-detail" className="lg:col-span-3 sticky top-[64px]" style={{ height:"calc(100vh - 88px)" }}>
                {selected
                  ? <LeadDetail
                      lead={selected}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      editedResponse={editedResponse}
                      setEditedResponse={setEdited}
                    />
                  : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm gap-3 rounded-2xl border border-gray-200 bg-white">
                      <div className="text-3xl opacity-30">🌲</div>
                      <div>Select a lead to view details</div>
                    </div>
                  )
                }
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-400">
              <span>Premier Tree Specialists LLC · Lead Intake Dashboard</span>
              <span>All leads persisted · Railway + SQLite</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
