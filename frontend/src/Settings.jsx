import { useState, useEffect } from "react";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function useSettings() {
  const [settings, setSettings] = useState({});
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(data => { setSettings(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const save = async (patch) => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      setSettings(s => ({ ...s, ...patch }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      alert("Save failed — check connection.");
    } finally {
      setSaving(false);
    }
  };

  return { settings, save, saving, saved, loading };
}

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────

function Card({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-[#1e3a2a]/70 overflow-hidden mb-5"
      style={{ background: "#0a1a12" }}>
      <div className="px-6 py-4 border-b border-[#1e3a2a]/50"
        style={{ background: "#0d2018" }}>
        <div className="text-sm font-bold text-slate-200">{title}</div>
        {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 mb-1">{label}</label>
      {hint && <div className="text-[11px] text-slate-600 mb-1.5 leading-relaxed">{hint}</div>}
      {children}
    </div>
  );
}

function Input({ value, onChange, type = "text", placeholder, mono }) {
  return (
    <input
      type={type}
      value={value ?? ""}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 rounded-xl border border-[#1e3a2a]/60 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-colors ${mono ? "font-mono text-xs" : ""}`}
      style={{ background: "#0d2018" }}
    />
  );
}

function Textarea({ value, onChange, rows = 4, mono, placeholder }) {
  return (
    <textarea
      value={value ?? ""}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className={`w-full px-3 py-2.5 rounded-xl border border-[#1e3a2a]/60 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 resize-y transition-colors leading-relaxed ${mono ? "font-mono text-xs" : ""}`}
      style={{ background: "#0d2018" }}
    />
  );
}

function Toggle({ value, onChange, label }) {
  const on = value === "true" || value === true;
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div onClick={() => onChange(on ? "false" : "true")}
        className={`relative w-11 h-6 rounded-full border transition-all flex-shrink-0
          ${on ? "border-emerald-500/60" : "border-[#1e3a2a]/60"}`}
        style={{ background: on ? "#0d4a28" : "#0a1810" }}>
        <div className={`absolute top-0.5 w-5 h-5 rounded-full transition-all shadow
          ${on ? "left-[22px] bg-emerald-400" : "left-0.5 bg-slate-600"}`} />
      </div>
      <span className={`text-sm font-medium ${on ? "text-slate-200" : "text-slate-500"}`}>{label}</span>
    </label>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select value={value ?? ""} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-xl border border-[#1e3a2a]/60 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 transition-colors"
      style={{ background: "#0d2018" }}>
      {options.map(o => (
        <option key={o.value} value={o.value} style={{ background: "#0d2018" }}>{o.label}</option>
      ))}
    </select>
  );
}

function SaveBar({ saving, saved, onSave }) {
  return (
    <div className="flex items-center justify-between py-3 px-1">
      {saved
        ? <span className="text-xs text-emerald-400 font-semibold">✓ Saved</span>
        : <span className="text-xs text-slate-600">Unsaved changes</span>}
      <button onClick={onSave} disabled={saving}
        className={`px-5 py-2 rounded-xl text-sm font-bold border transition-all
          ${saving ? "opacity-50 cursor-not-allowed border-slate-700/40 text-slate-500" : "border-emerald-500/50 text-emerald-200 hover:border-emerald-400"}`}
        style={{ background: saving ? "transparent" : "#0d3a22" }}>
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

// ─── SECTION COMPONENTS ───────────────────────────────────────────────────────

function OutreachSettings({ s, set }) {
  return (
    <Card title="Outreach Settings" subtitle="Control how and when responses are sent to customers">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Auto-send confidence threshold (%)"
          hint="Leads scoring at or above this % are sent automatically. Default: 80.">
          <Input value={s["outreach.auto_send_threshold"]} onChange={v => set("outreach.auto_send_threshold", v)} type="number" />
        </Field>
        <Field label="Review threshold (%)"
          hint="Leads below this score are flagged with no response drafted. Between this and auto-send = review queue.">
          <Input value={s["scoring.review_threshold"]} onChange={v => set("scoring.review_threshold", v)} type="number" />
        </Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Toggle value={s["outreach.text_enabled"]} onChange={v => set("outreach.text_enabled", v)} label="Text / iMessage outreach enabled" />
        <Toggle value={s["outreach.email_enabled"]} onChange={v => set("outreach.email_enabled", v)} label="Email outreach enabled" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="From name"><Input value={s["outreach.from_name"]} onChange={v => set("outreach.from_name", v)} /></Field>
        <Field label="From email"><Input value={s["outreach.from_email"]} onChange={v => set("outreach.from_email", v)} /></Field>
        <Field label="Cleveland phone"><Input value={s["outreach.cleveland_phone"]} onChange={v => set("outreach.cleveland_phone", v)} /></Field>
        <Field label="Columbus phone"><Input value={s["outreach.columbus_phone"]} onChange={v => set("outreach.columbus_phone", v)} /></Field>
      </div>
      <Field label="Email signature" hint="Appended to every outbound email.">
        <Input value={s["outreach.signature"]} onChange={v => set("outreach.signature", v)} />
      </Field>
    </Card>
  );
}

function InboundSettings({ s, set }) {
  const routeOptions = [
    { value: "auto",     label: "Auto — score and route normally" },
    { value: "review",   label: "Always queue for review" },
    { value: "disabled", label: "Disabled — ignore this channel" },
  ];
  return (
    <Card title="Inbound Channel Settings" subtitle="Control which channels are active and how their leads are routed">
      <div className="space-y-5">
        {[
          { key: "google_lsa",    label: "Google Local Service Ads", icon: "🔵", desc: "Messages sent via Google LSA" },
          { key: "website_form",  label: "Website Contact Form",     icon: "🟣", desc: "Submissions from premiertreesllc.com" },
          { key: "answerforce",   label: "AnswerForce",              icon: "🟡", desc: "After-hours call transcripts emailed by AnswerForce" },
        ].map(ch => (
          <div key={ch.key} className="p-4 rounded-xl border border-[#1e3a2a]/50 space-y-3"
            style={{ background: "#0d2018" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{ch.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-slate-200">{ch.label}</div>
                  <div className="text-[11px] text-slate-500">{ch.desc}</div>
                </div>
              </div>
              <Toggle
                value={s[`inbound.${ch.key}_enabled`]}
                onChange={v => set(`inbound.${ch.key}_enabled`, v)}
                label=""
              />
            </div>
            {(s[`inbound.${ch.key}_enabled`] === "true") && (
              <Field label="Routing behaviour">
                <Select
                  value={s[`inbound.${ch.key}_route`]}
                  onChange={v => set(`inbound.${ch.key}_route`, v)}
                  options={routeOptions}
                />
              </Field>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function BusinessRules({ s, set }) {
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"]
    .map((m,i) => ({ value: String(i+1), label: m }));

  return (
    <Card title="Business Rules" subtitle="Oak season, service area, emergency escalation — all editable">

      {/* Oak season */}
      <div className="p-4 rounded-xl border border-amber-500/20 space-y-3" style={{ background: "#1a1000" }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-amber-300">🌳 Oak Season Restriction</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Warn customers and delay oak trim bookings during wilt risk months</div>
          </div>
          <Toggle value={s["rules.oak_trim_restricted"]} onChange={v => set("rules.oak_trim_restricted", v)} label="" />
        </div>
        {s["rules.oak_trim_restricted"] === "true" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Restriction starts">
                <Select value={s["rules.oak_season_start_month"]} onChange={v => set("rules.oak_season_start_month", v)} options={months} />
              </Field>
              <Field label="Restriction ends">
                <Select value={s["rules.oak_season_end_month"]} onChange={v => set("rules.oak_season_end_month", v)} options={months} />
              </Field>
            </div>
            <Field label="Oak season message" hint="Shown in the drafted reply when a customer requests oak trimming during the restricted period.">
              <Textarea value={s["rules.oak_season_message"]} onChange={v => set("rules.oak_season_message", v)} rows={3} />
            </Field>
          </>
        )}
      </div>

      {/* Emergency keywords */}
      <div className="p-4 rounded-xl border border-red-500/20 space-y-3" style={{ background: "#1a0808" }}>
        <div>
          <div className="text-sm font-semibold text-red-300">⚠️ Emergency Escalation Keywords</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Leads containing any of these words are always routed to review — regardless of confidence score.</div>
        </div>
        <Field label="Keywords (comma-separated)" hint="Add or remove words. Matching is case-insensitive.">
          <Textarea value={s["rules.emergency_keywords"]} onChange={v => set("rules.emergency_keywords", v)} rows={3} mono />
        </Field>
      </div>

      {/* Service area */}
      <div className="p-4 rounded-xl border border-sky-500/20 space-y-3" style={{ background: "#08121a" }}>
        <div>
          <div className="text-sm font-semibold text-sky-300">📍 Service Area</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Leads from zip codes not matching these prefixes are flagged as out-of-area.</div>
        </div>
        <Field label="Zip code prefixes (comma-separated, first 3 digits)"
          hint="E.g. 440 covers all of 44000–44099 (Cleveland metro). Add or remove prefixes to expand or shrink your coverage.">
          <Textarea value={s["service_area.zip_prefixes"]} onChange={v => set("service_area.zip_prefixes", v)} rows={2} mono />
        </Field>
        <Field label="Service area description" hint="Plain English description shown in system messages.">
          <Input value={s["service_area.description"]} onChange={v => set("service_area.description", v)} />
        </Field>
      </div>
    </Card>
  );
}

function AISettings({ s, set }) {
  return (
    <Card title="AI & Prompt Settings" subtitle="Control the model, parameters, and prompts used for response generation">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Model" hint="OpenRouter model string.">
          <Input value={s["ai.model"]} onChange={v => set("ai.model", v)} mono />
        </Field>
        <Field label="Max tokens" hint="Maximum length of generated response.">
          <Input value={s["ai.max_tokens"]} onChange={v => set("ai.max_tokens", v)} type="number" />
        </Field>
        <Field label="Temperature" hint="0 = deterministic, 1 = creative. Recommended: 0.3–0.5.">
          <Input value={s["ai.temperature"]} onChange={v => set("ai.temperature", v)} type="number" />
        </Field>
      </div>

      <Field label="System prompt"
        hint="The persona and rules given to the AI before every response. Changes take effect immediately on the next inbound lead.">
        <Textarea value={s["ai.system_prompt"]} onChange={v => set("ai.system_prompt", v)} rows={12} />
      </Field>

      <Field label="Extraction prompt"
        hint="Instructions for extracting structured data (name, phone, service type, etc.) from raw messages. JSON output expected.">
        <Textarea value={s["ai.extraction_prompt"]} onChange={v => set("ai.extraction_prompt", v)} rows={4} />
      </Field>

      <div className="p-3 rounded-lg border border-sky-500/15 text-[11px] text-slate-500 leading-relaxed"
        style={{ background: "#08121a" }}>
        💡 The system prompt supports these variables: <span className="text-slate-400 font-mono">{`{faq_context}`}</span> (FAQ knowledge base), <span className="text-slate-400 font-mono">{`{office_phone}`}</span> (correct office number for customer's location), <span className="text-slate-400 font-mono">{`{office_name}`}</span>.
      </div>
    </Card>
  );
}

function ScoringSettings({ s, set }) {
  return (
    <Card title="Confidence Scoring" subtitle="Tune how confidence scores are calculated">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Points per contact field (max 4 fields)"
          hint="Name, phone, email, and city/zip each contribute this many points. Default: 5 (max 20 pts).">
          <Input value={s["scoring.field_score_per_item"]} onChange={v => set("scoring.field_score_per_item", v)} type="number" />
        </Field>
        <Field label="Points per FAQ category match"
          hint="Each matching FAQ category adds this many points. Default: 30. 2 matches + full fields = 80.">
          <Input value={s["scoring.faq_score_per_match"]} onChange={v => set("scoring.faq_score_per_match", v)} type="number" />
        </Field>
      </div>
      <div className="p-4 rounded-xl border border-[#1e3a2a]/50 text-xs text-slate-400 leading-relaxed space-y-1.5"
        style={{ background: "#0d2018" }}>
        <div className="font-semibold text-slate-300 mb-2">How scoring works</div>
        <div>📋 <span className="text-slate-300">Field score</span> — {s["scoring.field_score_per_item"] || 5} pts × up to 4 contact fields = max {(s["scoring.field_score_per_item"] || 5) * 4} pts</div>
        <div>🔍 <span className="text-slate-300">FAQ score</span> — {s["scoring.faq_score_per_match"] || 30} pts × number of FAQ categories matched (capped at 90)</div>
        <div>⚡ <span className="text-slate-300">Auto-send</span> — score ≥ {s["outreach.auto_send_threshold"] || 80}% and in service area</div>
        <div>◐ <span className="text-slate-300">Review queue</span> — score between {s["scoring.review_threshold"] || 50}% and {s["outreach.auto_send_threshold"] || 80}%</div>
        <div>⊗ <span className="text-slate-300">Flagged</span> — score below {s["scoring.review_threshold"] || 50}%, out of area, or emergency keyword hit</div>
      </div>
    </Card>
  );
}

// ─── MAIN SETTINGS PAGE ───────────────────────────────────────────────────────

export default function Settings({ onBack }) {
  const { settings, save, saving, saved, loading } = useSettings();
  const [local, setLocal] = useState({});
  const [activeSection, setActiveSection] = useState("outreach");

  useEffect(() => { setLocal(settings); }, [settings]);

  const set = (key, value) => setLocal(s => ({ ...s, [key]: value }));
  const handleSave = () => save(local);

  const sections = [
    { key: "outreach",  label: "Outreach",       icon: "📤" },
    { key: "inbound",   label: "Inbound",         icon: "📥" },
    { key: "rules",     label: "Business Rules",  icon: "⚙️" },
    { key: "ai",        label: "AI & Prompts",    icon: "🤖" },
    { key: "scoring",   label: "Scoring",         icon: "📊" },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
      <span className="animate-pulse">Loading settings…</span>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-3 transition-colors">
            ← Back to dashboard
          </button>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Configure business rules, AI prompts, and outreach behaviour</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-emerald-400 font-semibold">✓ All changes saved</span>}
          <button onClick={handleSave} disabled={saving}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all
              ${saving ? "opacity-50 cursor-not-allowed border-slate-700/40 text-slate-500" : "border-emerald-500/50 text-emerald-200 hover:border-emerald-400"}`}
            style={{ background: saving ? "transparent" : "#0d3a22" }}>
            {saving ? "Saving…" : "Save all changes"}
          </button>
        </div>
      </div>

      {/* Section nav */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {sections.map(sec => (
          <button key={sec.key} onClick={() => setActiveSection(sec.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all
              ${activeSection === sec.key
                ? "border-emerald-500/60 text-emerald-300"
                : "border-[#1a3a22]/60 text-slate-500 hover:text-slate-300 hover:border-[#2d5a3a]/60"}`}
            style={{ background: activeSection === sec.key ? "#0d2a1e" : "#0a1a12" }}>
            <span>{sec.icon}</span> {sec.label}
          </button>
        ))}
      </div>

      {/* Active section */}
      {activeSection === "outreach"  && <OutreachSettings  s={local} set={set} />}
      {activeSection === "inbound"   && <InboundSettings   s={local} set={set} />}
      {activeSection === "rules"     && <BusinessRules     s={local} set={set} />}
      {activeSection === "ai"        && <AISettings        s={local} set={set} />}
      {activeSection === "scoring"   && <ScoringSettings   s={local} set={set} />}

      <SaveBar saving={saving} saved={saved} onSave={handleSave} />
    </div>
  );
}
