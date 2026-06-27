"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight, Plus, Check, Search, Info, ChevronDown, Star,
  CheckCircle, AlertTriangle, XCircle,
} from "lucide-react";
import { NoonWordmark, NoonMark } from "@/components/brand/noon-logo";

/* ---------- small helpers ---------- */

function Ticks() {
  return (
    <>
      {(["tl", "tr", "bl", "br"] as const).map((p) => (
        <span key={p} className={`lab-tick ${p}`} aria-hidden>
          <svg viewBox="0 0 12 12"><path d="M6 0V12M0 6H12" stroke="currentColor" strokeWidth="1" /></svg>
        </span>
      ))}
    </>
  );
}

function Section({ n, title, note, children }: { n: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section className="lab-section">
      <div className="lab-sectitle"><span className="lab-kicker">{n}</span><h2 className="lab-h2">{title}</h2></div>
      {note && <p className="lab-secnote">{note}</p>}
      {children}
    </section>
  );
}

/* ---------- illustration signature (mix gobernado) ---------- */

function NodeGraph() {
  const nodes = [[30, 70, 0], [95, 30, 0], [150, 95, 1], [215, 45, 0], [250, 110, 0], [180, 150, 0]];
  const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [0, 2], [3, 5]];
  return (
    <svg viewBox="0 0 280 180" style={{ width: "100%", height: "auto" }} aria-hidden>
      {edges.map(([a, b], i) => (
        <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke="var(--border)" strokeWidth="1" />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n[0]} cy={n[1]} r={n[2] ? 6 : 4} fill={n[2] ? "var(--brand)" : "var(--bg-base)"} stroke={n[2] ? "var(--brand)" : "var(--text-muted)"} strokeWidth="1.5" />
      ))}
    </svg>
  );
}
function DotField() {
  const dots = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 9; c++) dots.push([c, r, r === 2 && c === 5]);
  return (
    <svg viewBox="0 0 280 150" style={{ width: "100%", height: "auto" }} aria-hidden>
      {dots.map((d, i) => (
        <circle key={i} cx={20 + (d[0] as number) * 30} cy={18 + (d[1] as number) * 28} r={d[2] ? 5 : 2.5} fill={d[2] ? "var(--brand)" : "var(--text-muted)"} opacity={d[2] ? 1 : 0.45} />
      ))}
    </svg>
  );
}
function Wireframe() {
  return (
    <svg viewBox="0 0 220 170" style={{ width: "100%", height: "auto" }} aria-hidden>
      <g fill="none" stroke="var(--border)" strokeWidth="1">
        <circle cx="110" cy="85" r="62" />
        <ellipse cx="110" cy="85" rx="62" ry="23" />
        <ellipse cx="110" cy="85" rx="30" ry="62" />
        <ellipse cx="110" cy="85" rx="52" ry="62" />
      </g>
      <line x1="110" y1="85" x2="156" y2="56" stroke="var(--border)" strokeWidth="1" />
      <circle cx="156" cy="56" r="4.5" fill="var(--brand)" />
    </svg>
  );
}
function Iso() {
  return (
    <svg viewBox="0 0 220 170" style={{ width: "100%", height: "auto" }} fill="none" stroke="var(--text-secondary)" strokeWidth="1.2" aria-hidden>
      <path d="M65 80 L110 56 L155 80 L110 104 Z" />
      <path d="M65 80 L65 112 L110 136 L110 104" />
      <path d="M155 80 L155 112 L110 136" />
      <path d="M78 46 L110 30 L142 46 L110 62 Z" stroke="var(--text-muted)" />
      <line x1="110" y1="62" x2="110" y2="56" stroke="var(--text-muted)" strokeDasharray="2 3" />
    </svg>
  );
}

/* ---------- data ---------- */

const TYPE = [
  ["Display", "lab-display", "76 · 400"], ["H1", "lab-h1", "48 · 600"], ["H2", "lab-h2", "32 · 600"],
  ["H3", "lab-h3", "24 · 600"], ["Lead", "lab-lead", "19 · 500"], ["Body", "lab-body", "16 · 400"],
  ["Small", "lab-small", "14 · 400"], ["Kicker", "lab-kicker", "12 · 500 · upper"],
] as const;
const WEIGHTS = [["Regular", 400], ["Medium", 500], ["Semibold", 600], ["Bold", 700]] as const;
const SPACING = [4, 8, 12, 16, 24, 32, 48, 64, 96, 128];
const SWATCHES = [
  ["Brand", "var(--brand)", "#0056FD"], ["Brand hover", "var(--brand-hover)", "#3378FD"], ["Accent", "var(--accent)", "#00D4FF"],
  ["Text", "var(--text-primary)", "primary"], ["Surface", "var(--surface)", "surface"], ["Border", "var(--border)", "border"],
  ["Success", "var(--success)", "#00C853"], ["Warning", "var(--warning)", "#FFB300"], ["Error", "var(--error)", "#FF3B6E"],
];
const NEUTRALS = [["900", "#0A0A23"], ["800", "#1A1A2E"], ["700", "#2A2A44"], ["500", "#6B6B7D"], ["400", "#9CA3AF"], ["300", "#D1D5DB"], ["200", "#F3F4F6"]];
const FAQ = [
  ["Do I own the code?", "Yes — completely. No lock-in, no per-seat licence on your own software. The repo is yours from day one, clean and documented."],
  ["What does 'human-reviewed' mean?", "A real engineer reviews every build before it ships — reading the diff, checking the logic, and signing off. AI drafts, a human decides."],
  ["How fast is a typical build?", "Most scoped builds land in days, not months — we pair AI generation speed with a tight review loop."],
];

export function Gallery() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [font, setFont] = useState<"geist" | "schibsted">("geist");
  const [tab, setTab] = useState(0);
  const [acc, setAcc] = useState<number | null>(0);
  const [sw, setSw] = useState(true);
  const [ck, setCk] = useState(true);
  const fontVar = font === "geist" ? "var(--font-geist-sans)" : "var(--font-schibsted)";

  return (
    <div className="lab" data-theme={theme} style={{ "--lab-font": fontVar } as CSSProperties}>
      {/* controls */}
      <div className="lab-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ height: 22, width: 21, display: "inline-block" }}><NoonMark /></span>
          <span className="lab-kicker">Design System · Lab</span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div className="lab-toggle" role="group" aria-label="Theme">
            {(["light", "dark"] as const).map((t) => <button key={t} className={theme === t ? "on" : ""} onClick={() => setTheme(t)}>{t}</button>)}
          </div>
          <div className="lab-toggle" role="group" aria-label="Font">
            {(["geist", "schibsted"] as const).map((f) => <button key={f} className={font === f ? "on" : ""} onClick={() => setFont(f)}>{f === "geist" ? "Geist" : "Schibsted"}</button>)}
          </div>
        </div>
      </div>

      <div className="lab-wrap">
        {/* hero */}
        <section className="lab-section">
          <p className="lab-kicker" style={{ marginBottom: 16 }}>/ Custom software + AI</p>
          <h1 className="lab-display" style={{ maxWidth: 760 }}>Software, reviewed<br />by humans.</h1>
          <p className="lab-lead lab-secondary" style={{ marginTop: 20, maxWidth: 540 }}>
            We pair the speed of AI generation with the judgment of a real engineer — before anything ships. The code is yours.
          </p>
          <div className="lab-row" style={{ marginTop: 28 }}>
            <button className="lab-btn lab-btn-primary">Start a build <ArrowRight size={15} /></button>
            <button className="lab-btn lab-btn-secondary">See the work</button>
          </div>
        </section>

        {/* 01 type */}
        <Section n="01" title="Typography">
          <div className="lab-stack" style={{ gap: 22 }}>
            {TYPE.map(([label, cls, meta]) => (
              <div key={label} className="lab-specrow">
                <div><div className="lab-small lab-muted">{label}</div><div className="lab-small lab-muted" style={{ fontFamily: "var(--mono)", fontSize: 11, opacity: 0.7 }}>{meta}</div></div>
                <span className={cls}>Software, reviewed by humans.</span>
              </div>
            ))}
          </div>
          <p className="lab-subhead" style={{ marginTop: 40 }}>Weights</p>
          <div className="lab-row" style={{ gap: 28 }}>
            {WEIGHTS.map(([n, w]) => <span key={n} className="lab-h3" style={{ fontWeight: w }}>{n}</span>)}
          </div>
          <p className="lab-subhead" style={{ marginTop: 40 }}>Emphasis — muted-word</p>
          <div className="lab-h1" style={{ fontWeight: 400, maxWidth: "15ch" }}>Real software, <span style={{ color: "var(--text-secondary)" }}>shipped and</span> reviewed.</div>
          <p className="lab-small lab-muted" style={{ marginTop: 12, maxWidth: "46ch" }}>Highlight only what matters — supporting words go grey. Hierarchy comes from color, not weight. Light weights (display 400).</p>
        </Section>

        {/* 02 spacing + radius */}
        <Section n="02" title="Spacing & radius" note="Base 8px. Radio: pill en botones, 12px en cards. Elevación flat — la profundidad sale de bordes, no sombras.">
          <p className="lab-subhead">Spacing scale (8pt)</p>
          <div className="lab-stack" style={{ gap: 8 }}>
            {SPACING.map((s) => (
              <div key={s} className="lab-scalebar">
                <span className="lab-small lab-muted" style={{ width: 38, fontFamily: "var(--mono)", fontSize: 12 }}>{s}</span>
                <span className="bar" style={{ width: s * 1.8 }} />
              </div>
            ))}
          </div>
          <p className="lab-subhead" style={{ marginTop: 32 }}>Radius</p>
          <div className="lab-radii">
            {[["sm", 8], ["md", 12], ["pill", 24]].map(([n, r]) => (
              <div key={n as string} className="r" style={{ borderRadius: (n === "pill" ? 24 : (r as number)) }}>{n}</div>
            ))}
          </div>
        </Section>

        {/* 03 type details */}
        <Section n="03" title="Text, links & code">
          <div className="lab-grid2">
            <div className="lab-stack">
              <p className="lab-body">Body copy at a comfortable measure. Use <a className="lab-link">an inline link</a> or a <a className="lab-link lab-link-brand">brand link</a> for primary actions, and <span className="lab-code">inline code</span> for technical terms.</p>
              <ul className="lab-list lab-body lab-secondary">
                <li>The code is yours — no lock-in.</li>
                <li>Every build is human-reviewed.</li>
                <li>Production-ready from day one.</li>
              </ul>
            </div>
            <pre className="lab-codeblock">{`// Maxwell — build receipt
{
  "brief": "reservation platform",
  "reviewed_by": "engineer",
  "status": "ready to ship"
}`}</pre>
          </div>
        </Section>

        {/* 04 color */}
        <Section n="04" title="Color" note="Neutra primero — el color es un acento intencional, nunca de relleno: solo si mejora la jerarquía o destaca lo importante. Si ya funciona en gris, no lleva color. Azul de marca #0056FD, escaso. Todo resuelve por tema.">
          <div className="lab-swatches">
            {SWATCHES.map(([name, val, hex]) => (
              <div key={name} className="lab-swatch">
                <div className="chip" style={{ background: val }} />
                <div className="meta"><div className="name">{name}</div><div className="hex">{hex}</div></div>
              </div>
            ))}
          </div>
          <p className="lab-subhead" style={{ marginTop: 32 }}>Neutral scale</p>
          <div className="lab-scale">
            {NEUTRALS.map(([n, hex], i) => (
              <div key={n} className="step" style={{ background: hex, color: i < 3 ? "#fff" : "#111" }}>{n}</div>
            ))}
          </div>
        </Section>

        {/* 05 buttons + states */}
        <Section n="05" title="Buttons & states" note="Primario = negro (invierte por tema). Azul = máx 1 por página.">
          <div className="lab-row">
            <button className="lab-btn lab-btn-primary">Primary <ArrowRight size={15} /></button>
            <button className="lab-btn lab-btn-secondary">Secondary</button>
            <button className="lab-btn lab-btn-ghost">Ghost</button>
            <button className="lab-btn lab-btn-blue">Blue CTA</button>
            <button className="lab-iconbtn" aria-label="next"><ArrowRight size={17} /></button>
            <button className="lab-iconbtn lab-iconbtn-ghost" aria-label="add"><Plus size={17} /></button>
          </div>
          <p className="lab-subhead" style={{ marginTop: 28 }}>Sizes & states</p>
          <div className="lab-row">
            <button className="lab-btn lab-btn-primary lab-btn-sm">Small</button>
            <button className="lab-btn lab-btn-primary">Default</button>
            <button className="lab-btn lab-btn-primary lab-btn-lg">Large</button>
            <button className="lab-btn lab-btn-secondary lab-btn-focus">Focus</button>
            <button className="lab-btn lab-btn-primary" disabled>Disabled</button>
          </div>
        </Section>

        {/* 06 forms */}
        <Section n="06" title="Forms & inputs">
          <div className="lab-grid2">
            <div className="lab-stack">
              <div className="lab-field"><label className="lab-label">Email</label><input className="lab-input" placeholder="you@company.com" defaultValue="" /></div>
              <div className="lab-field"><label className="lab-label">Project brief</label><textarea className="lab-textarea" rows={3} placeholder="Build a reservation platform…" /></div>
              <div className="lab-field"><label className="lab-label">Budget</label>
                <select className="lab-select" defaultValue=""><option value="">Select a range</option><option>$5k–15k</option><option>$15k–50k</option></select>
              </div>
              <div className="lab-search"><Search size={15} /><input className="lab-input" placeholder="Search…" /></div>
            </div>
            <div className="lab-stack">
              <div className="lab-field"><label className="lab-label">Focused</label><input className="lab-input lab-btn-focus" defaultValue="reservation platform" style={{ borderColor: "var(--brand)" }} /></div>
              <div className="lab-field"><label className="lab-label">Error</label><input className="lab-input err" defaultValue="not-an-email" /><span className="lab-help err">Enter a valid email.</span></div>
              <div className="lab-field"><label className="lab-label">Disabled</label><input className="lab-input" defaultValue="locked" disabled /></div>
              <div className="lab-row" style={{ gap: 22, marginTop: 4 }}>
                <span className={`lab-check ${ck ? "on" : ""}`} onClick={() => setCk(!ck)}><span className="box">{ck && <Check size={13} />}</span>Checkbox</span>
                <span className="lab-check on"><span className="box radio" /></span>
                <span className="lab-small lab-muted">Radio</span>
                <span className={`lab-switch ${sw ? "on" : ""}`} role="switch" aria-checked={sw} onClick={() => setSw(!sw)} />
                <span className="lab-small lab-muted">Toggle</span>
              </div>
            </div>
          </div>
        </Section>

        {/* 07 badges, tags, avatars */}
        <Section n="07" title="Badges, tags & avatars">
          <div className="lab-row" style={{ marginBottom: 24 }}>
            <span className="lab-badge"><span className="dot" style={{ background: "var(--success)" }} />Active</span>
            <span className="lab-badge"><span className="dot" style={{ background: "var(--warning)" }} />Pending</span>
            <span className="lab-badge"><span className="dot" style={{ background: "var(--error)" }} />Failed</span>
            <span className="lab-badge lab-badge-solid">New</span>
            <span className="lab-badge lab-badge-blue">Pro</span>
            <span className="lab-tag">Next.js</span>
            <span className="lab-tag">TypeScript</span>
          </div>
          <div className="lab-row">
            <span className="lab-avatar">MR</span>
            <div className="lab-avatar-stack">
              {["AK", "JD", "TL", "SM"].map((a) => <span key={a} className="lab-avatar">{a}</span>)}
              <span className="lab-avatar" style={{ background: "var(--text-primary)", color: "var(--bg-base)" }}>+3</span>
            </div>
          </div>
        </Section>

        {/* 08 alerts */}
        <Section n="08" title="Alerts & banners" note="Color semántico al 10–15% de fondo; pleno para ícono y borde.">
          <div className="lab-stack">
            <div className="lab-alert lab-alert-success"><CheckCircle size={17} className="ico" /><div>Build shipped. The repo is now yours.</div></div>
            <div className="lab-alert lab-alert-info"><Info size={17} className="ico" /><div>A real engineer is reviewing your build — pauses for sign-off before shipping.</div></div>
            <div className="lab-alert lab-alert-warning"><AlertTriangle size={17} className="ico" /><div>This action needs your review before it can proceed.</div></div>
            <div className="lab-alert lab-alert-error"><XCircle size={17} className="ico" /><div>Couldn&apos;t reach the service. We&apos;ve logged it and a person will follow up.</div></div>
          </div>
        </Section>

        {/* 09 tabs, accordion, table */}
        <Section n="09" title="Tabs, accordion & table">
          <div className="lab-tabs">
            {["Overview", "How it works", "Pricing"].map((t, i) => <button key={t} className={tab === i ? "on" : ""} onClick={() => setTab(i)}>{t}</button>)}
          </div>
          <p className="lab-body lab-secondary" style={{ margin: "18px 0 36px", maxWidth: 560 }}>
            {["A studio that builds custom software and AI products.", "Brief in, production software out — with a human-review gate.", "Scoped builds, transparent pricing, the code is yours."][tab]}
          </p>

          <div className="lab-acc" style={{ maxWidth: 720 }}>
            {FAQ.map(([q, a], i) => (
              <div key={q} className="lab-acc-item">
                <button className="lab-acc-head" onClick={() => setAcc(acc === i ? null : i)}>
                  {q}<ChevronDown size={18} style={{ transform: acc === i ? "rotate(180deg)" : "none", transition: "transform .2s", color: "var(--text-muted)" }} />
                </button>
                {acc === i && <div className="lab-acc-body">{a}</div>}
              </div>
            ))}
          </div>

          <table className="lab-table" style={{ marginTop: 40 }}>
            <thead><tr><th>Project</th><th>Type</th><th>Status</th><th>Owner</th></tr></thead>
            <tbody>
              {[["Reservation platform", "Web app", "success", "Active"], ["Ops dashboard", "Internal", "warning", "Review"], ["AI support", "AI agent", "success", "Shipped"]].map(([p, t, s, st]) => (
                <tr key={p}><td style={{ color: "var(--text-primary)", fontWeight: 500 }}>{p}</td><td>{t}</td>
                  <td><span className="lab-badge"><span className="dot" style={{ background: `var(--${s})` }} />{st}</span></td><td>MR</td></tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* 10 cards, feature row, content blocks */}
        <Section n="10" title="Cards & content patterns">
          <div className="lab-tickframe" style={{ borderRadius: 0, overflow: "hidden" }}>
            <Ticks />
            <div className="lab-features">
              {[["01", "Human review", "A real engineer reviews every build before it ships."], ["02", "You own the code", "No lock-in. Clean, documented, yours from day one."], ["03", "Built with Maxwell", "A brief becomes production software with an auditable trail."]].map(([n, t, d]) => (
                <div key={n} className="lab-feature"><span className="num">{n}</span><h3 className="lab-h3" style={{ marginTop: 12, fontSize: 18 }}>{t}</h3><p className="lab-small lab-secondary" style={{ marginTop: 8 }}>{d}</p></div>
              ))}
            </div>
          </div>

          <div className="lab-grid3" style={{ marginTop: 28 }}>
            {[["120+", "Builds shipped"], ["4.8d", "Avg. delivery"], ["100%", "Human-reviewed"]].map(([v, l]) => (
              <div key={l} className="lab-card lab-stat"><div className="v">{v}</div><div className="l">{l}</div></div>
            ))}
          </div>

          <div className="lab-grid3" style={{ marginTop: 28, alignItems: "start" }}>
            <div className="lab-price"><div className="lab-kicker">Starter</div><div className="amt" style={{ marginTop: 8 }}>$5k</div>
              <ul>{["1 scoped build", "Human review", "You own the code"].map((f) => <li key={f}><Check size={15} />{f}</li>)}</ul>
              <button className="lab-btn lab-btn-secondary" style={{ width: "100%", justifyContent: "center" }}>Choose</button></div>
            <div className="lab-price featured"><div className="lab-row" style={{ justifyContent: "space-between" }}><span className="lab-kicker">Studio</span><span className="lab-badge lab-badge-solid">Popular</span></div><div className="amt" style={{ marginTop: 8 }}>$15k</div>
              <ul>{["Everything in Starter", "Priority review loop", "Ongoing iterations"].map((f) => <li key={f}><Check size={15} />{f}</li>)}</ul>
              <button className="lab-btn lab-btn-primary" style={{ width: "100%", justifyContent: "center" }}>Choose</button></div>
            <div className="lab-price"><div className="lab-kicker">Custom</div><div className="amt" style={{ marginTop: 8 }}>Talk</div>
              <ul>{["Multi-project", "Dedicated engineer", "SLA"].map((f) => <li key={f}><Check size={15} />{f}</li>)}</ul>
              <button className="lab-btn lab-btn-secondary" style={{ width: "100%", justifyContent: "center" }}>Contact</button></div>
          </div>

          <div className="lab-grid3" style={{ marginTop: 28 }}>
            {[["Engineering", "From design to distribution"], ["Process", "What 'human review' really means"], ["AI", "Where judgment beats generation"]].map(([cat, t]) => (
              <div key={t} className="lab-post"><div className="thumb"><div style={{ position: "absolute", inset: 0, opacity: 0.5 }}><DotField /></div></div>
                <p className="lab-kicker" style={{ marginTop: 14 }}>{cat}</p><h3 className="lab-h3" style={{ fontSize: 18, marginTop: 6 }}>{t}</h3><p className="lab-small lab-muted" style={{ marginTop: 6 }}>Jun 23 · 6 min read</p></div>
            ))}
          </div>

          <div className="lab-cta" style={{ marginTop: 28 }}>
            <h3 className="lab-h2">Tell us what you want to build.</h3>
            <p className="lab-body lab-secondary" style={{ margin: "10px auto 22px", maxWidth: 440 }}>A person reads it. We&apos;ll get back within a day.</p>
            <button className="lab-btn lab-btn-primary lab-btn-lg">Start a build <ArrowRight size={16} /></button>
          </div>
        </Section>

        {/* 11 signature */}
        <Section n="11" title="Illustration signature" note="Mix gobernado: abstracto sistémico = default (heros, texturas, data). Isométrico = solo 'how it works'. Mismo grosor de línea, monocromo, 1 acento azul.">
          <div className="lab-grid3">
            {[["Node graph", <NodeGraph key="n" />], ["Dot field", <DotField key="d" />], ["Wireframe", <Wireframe key="w" />]].map(([t, el]) => (
              <div key={t as string} className="lab-card" style={{ background: "var(--bg-secondary)" }}><span className="lab-kicker">Abstract · {t as string}</span><div style={{ marginTop: 12 }}>{el as ReactNode}</div></div>
            ))}
          </div>
          <div className="lab-grid2" style={{ marginTop: 28, alignItems: "center" }}>
            <div className="lab-card" style={{ background: "var(--bg-secondary)" }}><span className="lab-kicker">Isometric · how it works</span><div style={{ marginTop: 12, maxWidth: 240 }}><Iso /></div></div>
            <div>
              <p className="lab-subhead">Process steps</p>
              <div className="lab-steps">{["Brief", "Generate", "Human review", "Ship"].map((s, i) => <span key={s} className={`lab-step ${i === 2 ? "active" : ""}`}>{s}</span>)}</div>
              <p className="lab-small lab-muted" style={{ marginTop: 16 }}>El paso activo en negro. La revisión humana, siempre marcada.</p>
            </div>
          </div>
        </Section>

        {/* 12 nav + logo */}
        <Section n="12" title="Nav, logo & strip">
          <div className="lab-nav lab-tickframe" style={{ padding: "16px 20px" }}>
            <span style={{ height: 20, width: 70, display: "inline-block" }}><NoonWordmark /></span>
            <div className="links"><a className="active">Work</a><a>Services</a><a>Approach</a><a>Contact</a></div>
            <button className="lab-btn lab-btn-primary lab-btn-sm">Start a build</button>
          </div>
          <div className="lab-row" style={{ gap: 48, marginTop: 36 }}>
            <span style={{ height: 34, width: 120, display: "inline-block" }}><NoonWordmark /></span>
            <span style={{ height: 40, width: 38, display: "inline-block" }}><NoonMark /></span>
          </div>
          <p className="lab-small lab-muted" style={{ margin: "36px 0 14px" }}>Logo strip — honesto (built with), no clientes falsos:</p>
          <div className="lab-strip">
            {["Next.js", "Stripe", "Vercel", "Postgres", "Anthropic", "Resend"].map((n) => <span key={n} style={{ fontWeight: 600, fontSize: 18 }}>{n}</span>)}
          </div>
        </Section>

        <div style={{ padding: "40px 0 80px", display: "flex", alignItems: "center", gap: 8 }}>
          <Star size={13} className="lab-muted" />
          <span className="lab-small lab-muted">Galería v2 · toggleá tema y fuente arriba. Söhne se agrega cuando me pases los archivos.</span>
        </div>
      </div>
    </div>
  );
}
