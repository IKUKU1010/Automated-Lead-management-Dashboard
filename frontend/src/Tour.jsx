import { useState, useEffect, useRef } from "react";

// ─── TOUR STEPS ───────────────────────────────────────────────────────────────

const STEPS = [
  {
    id: "tour-stats",
    title: "Your performance at a glance",
    body: "These six numbers tell the full story. The most important one is '< 1 Min Response' — the percentage of leads replied to in under 60 seconds. Google uses this to rank your Local Service Ads. The higher it is, the more calls you get.",
    position: "below",
    icon: "📊",
  },
  {
    id: "tour-filters",
    title: "Three queues, colour-coded",
    body: "Every inbound lead lands in one of three states. Green = auto-sent without anyone lifting a finger. Amber = a draft is ready and waiting for your approval. Red = flagged by the system — out of your service area, or the message was too unclear to draft a response for.",
    position: "below",
    icon: "🟢",
  },
  {
    id: "tour-leadlist",
    title: "Your unified inbox",
    body: "Google LSA messages, website form submissions, and AnswerForce call summaries all arrive here — one place, no switching between tabs. The coloured bar on the left of each card shows its status instantly. Click any lead to open the full detail panel.",
    position: "right",
    icon: "📥",
  },
  {
    id: "tour-detail",
    title: "Everything about a lead — one panel",
    body: "Click a lead and this panel fills in. Overview shows extracted contact details, confidence reasoning, and outreach status. Response shows the drafted reply — editable before sending. Raw shows the original message. ArboStar shows the CRM payload.",
    position: "left",
    icon: "📋",
  },
  {
    id: "tour-simulate",
    title: "The Simulate Lead button",
    body: "This fires a realistic test enquiry through the full pipeline — parsing, AI scoring, confidence routing, and response generation — exactly as a real customer message would behave. Use it to show the team how the system works, or to test changes you've made in Settings.",
    position: "below-left",
    icon: "⚡",
  },
  {
    id: "tour-settings",
    title: "All business rules are editable",
    body: "Nothing is hardcoded. The oak season restriction, emergency keywords, service area zip codes, auto-send threshold, AI system prompt, FAQ knowledge base — all of it lives in Settings and can be changed by Matt at any time. No developer needed.",
    position: "below-left",
    icon: "⚙️",
  },
];

// ─── SPOTLIGHT ────────────────────────────────────────────────────────────────

function getRect(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

// ─── TOUR OVERLAY ─────────────────────────────────────────────────────────────

export function TourOverlay({ onFinish }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const [visible, setVisible] = useState(false);
  const PAD = 12;

  useEffect(() => {
    setVisible(false);
    const timer = setTimeout(() => {
      const r = getRect(STEPS[step].id);
      setRect(r);
      setVisible(true);
      if (r) {
        const el = document.getElementById(STEPS[step].id);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [step]);

  // Recompute on scroll/resize
  useEffect(() => {
    const update = () => {
      const r = getRect(STEPS[step].id);
      setRect(r);
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step]);

  const current = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  // ── Tooltip position ──────────────────────────────────────────────────────
  const tooltipStyle = () => {
    if (!rect) return { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
    const GAP = 16;
    const TW = 360;
    switch (current.position) {
      case "below":
        return {
          top:  rect.top + rect.height + GAP + window.scrollY,
          left: Math.min(Math.max(rect.left + rect.width / 2 - TW / 2, 16), window.innerWidth - TW - 16),
        };
      case "below-left":
        return {
          top:  rect.top + rect.height + GAP + window.scrollY,
          left: Math.max(rect.left + rect.width - TW, 16),
        };
      case "right":
        return {
          top:  rect.top + window.scrollY,
          left: rect.left + rect.width + GAP,
        };
      case "left":
        return {
          top:  rect.top + window.scrollY,
          left: Math.max(rect.left - TW - GAP, 16),
        };
      default:
        return { top: "40%", left: "50%", transform: "translate(-50%,-50%)" };
    }
  };

  const handleFinish = () => {
    localStorage.setItem("pts_tour_done", "1");
    onFinish();
  };

  const handleSkip = () => {
    localStorage.setItem("pts_tour_done", "1");
    onFinish();
  };

  return (
    <div className="fixed inset-0 z-[200]" style={{ pointerEvents: "none" }}>

      {/* Dark backdrop with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && visible && (
              <rect
                x={rect.left - PAD}
                y={rect.top + window.scrollY - PAD}
                width={rect.width + PAD * 2}
                height={rect.height + PAD * 2}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(2,8,5,0.75)" mask="url(#spotlight-mask)" />
      </svg>

      {/* Spotlight border ring */}
      {rect && visible && (
        <div
          className="absolute rounded-xl pointer-events-none transition-all duration-300"
          style={{
            top:    rect.top  + window.scrollY - PAD,
            left:   rect.left - PAD,
            width:  rect.width  + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 2px #34d399, 0 0 0 4px rgba(52,211,153,0.15)",
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className="absolute w-[360px] rounded-2xl shadow-2xl shadow-black/60 transition-all duration-300"
        style={{
          ...tooltipStyle(),
          pointerEvents: "all",
          background: "#0a1a12",
          border: "1px solid #1e3a2a",
          opacity: visible ? 1 : 0,
          zIndex: 300,
        }}
      >
        <div className="p-5">
          {/* Step label */}
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] font-bold text-emerald-400 tracking-widest uppercase">
              Step {step + 1} of {STEPS.length}
            </div>
            <button onClick={handleSkip}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors">
              Skip tour
            </button>
          </div>

          {/* Title */}
          <div className="flex items-start gap-2 mb-2">
            <span className="text-xl mt-0.5">{current.icon}</span>
            <h3 className="text-base font-black text-slate-100 leading-snug">{current.title}</h3>
          </div>

          {/* Body */}
          <p className="text-sm text-slate-400 leading-relaxed mb-5">{current.body}</p>

          {/* Progress bar */}
          <div className="h-1 rounded-full mb-4 overflow-hidden" style={{ background: "#1e3a2a" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: "linear-gradient(90deg, #22c55e, #4ade80)" }}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#1e3a2a]/60 text-slate-400 hover:text-slate-200 hover:border-[#2d5a3a] transition-all"
                style={{ background: "#0d2018" }}>
                Back
              </button>
            )}
            <button
              onClick={() => step < STEPS.length - 1 ? setStep(s => s + 1) : handleFinish()}
              className="flex-1 px-4 py-2 rounded-xl text-sm font-bold border border-emerald-500/50 text-emerald-100 hover:border-emerald-400 transition-all"
              style={{ background: "linear-gradient(135deg, #0d3a22, #155e38)" }}>
              {step < STEPS.length - 1 ? "Next →" : "Go to dashboard →"}
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
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4"
      style={{ background: "rgba(2,8,5,0.96)" }}>

      {/* Background trees — subtle */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
        <svg className="absolute bottom-0 w-full" viewBox="0 0 1440 320" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax meet">
          <g fill="#1a5c38">
            <polygon points="0,320 70,100 140,320"/>
            <polygon points="180,320 260,80,340,320"/>
            <polygon points="380,320 460,95 540,320"/>
            <polygon points="580,320 660,85 740,320"/>
            <polygon points="780,320 860,92 940,320"/>
            <polygon points="980,320 1060,88 1140,320"/>
            <polygon points="1180,320 1260,94 1340,320"/>
            <polygon points="1360,320 1420,100 1480,320"/>
          </g>
        </svg>
      </div>

      <div className="relative max-w-lg w-full text-center">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6"
          style={{ background: "linear-gradient(135deg, #1a4a2a, #0d2a18)", border: "1px solid #2d6a3a" }}>
          🌲
        </div>

        {/* Headline */}
        <div className="text-[11px] font-bold text-emerald-400 tracking-[0.2em] uppercase mb-3">
          Premier Tree Specialists
        </div>
        <h1 className="text-4xl font-black text-slate-100 leading-tight mb-4">
          Customer enquiries answered{" "}
          <span className="text-emerald-400" style={{ textDecoration: "underline", textDecorationColor: "rgba(52,211,153,0.4)", textUnderlineOffset: "6px" }}>
            in under 60 seconds
          </span>
          {" "}— automatically.
        </h1>
        <p className="text-slate-400 text-base leading-relaxed mb-8 max-w-md mx-auto">
          The system reads every inbound message, scores it, drafts a reply, and sends it — before your team has even seen it. This is your control centre.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <button onClick={onStartTour}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl text-sm font-black border border-emerald-500/60 text-white transition-all hover:border-emerald-400 hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg, #0d4a28, #186b38)" }}>
            Walk through the dashboard →
          </button>
          <button onClick={onSkip}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors px-4 py-3.5">
            Or skip to the dashboard →
          </button>
        </div>

        {/* Feature hints */}
        <div className="grid grid-cols-3 gap-3 mt-10">
          {[
            { icon: "⚡", label: "Auto-send", desc: "High-confidence replies send instantly" },
            { icon: "◐",  label: "Review queue", desc: "Drafts ready for one-click approval" },
            { icon: "📍", label: "Service area", desc: "Out-of-area leads flagged automatically" },
          ].map(f => (
            <div key={f.label} className="rounded-xl p-3 border border-[#1e3a2a]/60 text-center"
              style={{ background: "#0a1a12" }}>
              <div className="text-xl mb-1">{f.icon}</div>
              <div className="text-xs font-bold text-slate-300">{f.label}</div>
              <div className="text-[10px] text-slate-600 mt-0.5 leading-tight">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── REPLAY BUTTON ────────────────────────────────────────────────────────────

export function ReplayTourButton({ onClick }) {
  return (
    <button onClick={onClick} title="Replay walkthrough tour"
      className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-slate-400 transition-colors px-2 py-1 rounded-lg hover:bg-[#0d2018]">
      <span>?</span>
      <span className="hidden sm:block">Tour</span>
    </button>
  );
}
