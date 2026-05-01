import { useState, useEffect } from "react";

// ─── TOUR STEPS ───────────────────────────────────────────────────────────────
const STEPS = [
  { id:"tour-stats",    title:"Your performance at a glance", icon:"📊", position:"below",
    body:"These six numbers tell the full story. The most important one is '< 1 Min Response' — the percentage of leads replied to in under 60 seconds. Google uses this to rank your Local Service Ads. The higher it is, the more enquiries you get." },
  { id:"tour-filters",  title:"Three sources, one inbox — or split by channel", icon:"📥", position:"center",
    body:"Switch between All Sources and the individual channel tabs to see only Google LSA, Website Form, or AnswerForce leads. The status chips below (Needs Review, Auto-Sent, Flagged) filter within whichever source you're viewing. Hover each tab for a description." },
  { id:"tour-leadlist", title:"Your unified lead inbox", icon:"🟢", position:"center",
    body:"Every inbound enquiry lands here in real time. The coloured bar on the left shows status instantly — green for auto-sent, amber for needs review, red for flagged. Leads in review show a draft preview right on the card. Click any lead to open the full detail panel." },
  { id:"tour-stats",    title:"The detail panel — everything in one place", icon:"📋", position:"below",
    scrollToTop: true,
    body:"Clicking a lead opens the detail panel on the right. Overview shows contact details, confidence score, and outreach status. Response shows the AI draft — editable before you approve. Raw shows the original message. ArboStar shows the CRM payload ready to sync." },
  { id:"tour-simulate", title:"The Simulate Lead button", icon:"⚡", position:"below-left",
    body:"This fires a realistic test enquiry through the full pipeline — parsing, scoring, and response generation — exactly as a real customer message would behave. Use it to demo the system to your team or test changes you've made in Settings." },
  { id:"tour-settings", title:"All business rules are editable", icon:"⚙️", position:"below-left",
    body:"Nothing is hardcoded. The oak season restriction, emergency keywords, service area zip codes, auto-send threshold, AI system prompt, and FAQ knowledge base all live in Settings. Matt can change any of them at any time — no developer needed." },
];

function getRect(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

// ─── TOUR OVERLAY ─────────────────────────────────────────────────────────────
export function TourOverlay({ onFinish }) {
  const [step, setStep]       = useState(0);
  const [rect, setRect]       = useState(null);
  const [visible, setVisible] = useState(false);
  const PAD = 12;

  const gotoStep = (n) => {
    setVisible(false);
    const s = STEPS[n];
    // Scroll to top for steps that need the full viewport visible
    if (s.scrollToTop) window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => {
      const el = document.getElementById(s.id);
      if (el && !s.scrollToTop) el.scrollIntoView({ behavior:"smooth", block:"center" });
      const r = getRect(s.id);
      setRect(r);
      setVisible(true);
    }, s.scrollToTop ? 400 : 300);
  };

  useEffect(() => { gotoStep(0); }, []);
  useEffect(() => { gotoStep(step); }, [step]);

  useEffect(() => {
    const update = () => { const r = getRect(STEPS[step].id); setRect(r); };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [step]);

  const current  = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  const tooltipPos = () => {
    const TW = 380, GAP = 24;
    if (current.position === "center" || !rect) {
      return { top:"50%", left:"50%", transform:"translate(-50%,-50%)" };
    }
    switch (current.position) {
      case "below":
        return { top: rect.top + rect.height + GAP + window.scrollY, left: Math.min(Math.max(rect.left + rect.width/2 - TW/2, 16), window.innerWidth - TW - 16) };
      case "below-left":
        return { top: rect.top + rect.height + GAP + window.scrollY, left: Math.max(rect.left + rect.width - TW, 16) };
      case "right":
        return { top: Math.max(rect.top + window.scrollY - 20, window.scrollY + 80), left: Math.min(rect.left + rect.width + GAP, window.innerWidth - TW - 16) };
      case "left":
        return { top: Math.max(rect.top + window.scrollY - 20, window.scrollY + 80), left: Math.max(rect.left - TW - GAP, 16) };
      default:
        return { top:"40%", left:"50%", transform:"translate(-50%,-50%)" };
    }
  };

  const done = () => { localStorage.setItem("pts_tour_done","1"); onFinish(); };

  return (
    <div className="fixed inset-0 z-[200]" style={{ pointerEvents:"none" }}>
      {/* Backdrop */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents:"none" }}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && visible && <rect x={rect.left-PAD} y={rect.top+window.scrollY-PAD} width={rect.width+PAD*2} height={rect.height+PAD*2} rx="12" fill="black" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(15,23,42,0.65)" mask="url(#tour-mask)" />
      </svg>

      {/* Spotlight ring */}
      {rect && visible && (
        <div className="absolute rounded-xl pointer-events-none transition-all duration-300"
          style={{ top:rect.top+window.scrollY-PAD, left:rect.left-PAD, width:rect.width+PAD*2, height:rect.height+PAD*2,
            boxShadow:"0 0 0 2px #16a34a, 0 0 0 5px rgba(22,163,74,0.15)" }} />
      )}

      {/* Tooltip */}
      <div className="absolute w-[400px] max-w-[calc(100vw-32px)] rounded-2xl shadow-2xl transition-all duration-300 bg-white border border-gray-200"
        style={{ ...tooltipPos(), pointerEvents:"all", opacity:visible?1:0, zIndex:300 }}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] font-bold text-emerald-600 tracking-widest uppercase">
              Step {step+1} of {STEPS.length}
            </div>
            <button onClick={done} className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors">
              Skip tour
            </button>
          </div>
          <div className="flex items-start gap-2 mb-2">
            <span className="text-xl mt-0.5">{current.icon}</span>
            <h3 className="text-base font-black text-gray-900 leading-snug">{current.title}</h3>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed mb-5">{current.body}</p>
          <div className="h-1.5 rounded-full mb-4 overflow-hidden bg-gray-100">
            <div className="h-full rounded-full transition-all duration-500 bg-emerald-500" style={{ width:`${progress}%` }} />
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep(s => s-1)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 transition-all bg-white">
                Back
              </button>
            )}
            <button onClick={() => step < STEPS.length-1 ? setStep(s => s+1) : done()}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm">
              {step < STEPS.length-1 ? "Next →" : "Go to dashboard →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LANDING SCREEN ───────────────────────────────────────────────────────────
export function TourLanding({ onStartTour, onSkip }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4 bg-white">
      {/* Subtle green top bar */}
      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600" />

      {/* Decorative tree silhouettes */}
      <div className="absolute bottom-0 inset-x-0 pointer-events-none overflow-hidden opacity-[0.06]">
        <svg className="w-full" viewBox="0 0 1440 220" preserveAspectRatio="xMidYMax meet">
          <g fill="#16a34a">
            <polygon points="0,220 70,60 140,220"/><polygon points="160,220 240,40 320,220"/>
            <polygon points="360,220 450,50 540,220"/><polygon points="580,220 670,35 760,220"/>
            <polygon points="800,220 890,45 980,220"/><polygon points="1020,220 1110,38 1200,220"/>
            <polygon points="1240,220 1320,55 1400,220"/><polygon points="1380,220 1440,65 1500,220"/>
          </g>
        </svg>
      </div>

      <div className="relative max-w-lg w-full text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6 bg-emerald-600 shadow-lg">
          🌲
        </div>
        <div className="text-[11px] font-bold text-emerald-600 tracking-[0.2em] uppercase mb-3">
          Premier Tree Specialists
        </div>
        <h1 className="text-4xl font-black text-gray-900 leading-tight mb-4">
          Customer enquiries answered{" "}
          <span className="relative inline-block">
            <span className="relative z-10">in under 60 seconds</span>
            <span className="absolute -bottom-1 left-0 right-0 h-3 bg-emerald-100 -skew-x-2 z-0 rounded" />
          </span>
          {" "}— automatically.
        </h1>
        <p className="text-gray-500 text-base leading-relaxed mb-8 max-w-md mx-auto">
          The system reads every inbound message, scores it, drafts a reply, and sends it — before your team has even seen it. This is your control centre.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-10">
          <button onClick={onStartTour}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl text-sm font-black bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md hover:shadow-lg">
            Walk through the dashboard →
          </button>
          <button onClick={onSkip}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors px-4 py-3.5">
            Or skip to the dashboard →
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon:"⚡", label:"Auto-send",   desc:"High-confidence replies sent instantly" },
            { icon:"◐",  label:"Review queue", desc:"Drafts ready for one-click approval" },
            { icon:"📍", label:"Service area", desc:"Out-of-area leads flagged automatically" },
          ].map(f => (
            <div key={f.label} className="rounded-xl p-3.5 border border-gray-200 bg-gray-50 text-center">
              <div className="text-xl mb-1.5">{f.icon}</div>
              <div className="text-xs font-bold text-gray-700">{f.label}</div>
              <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
