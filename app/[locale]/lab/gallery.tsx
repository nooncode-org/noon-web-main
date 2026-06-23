"use client";

import { useState, type CSSProperties } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { NoonWordmark, NoonMark } from "@/components/brand/noon-logo";

function Ticks() {
  return (
    <>
      {(["tl", "tr", "bl", "br"] as const).map((p) => (
        <span key={p} className={`lab-tick ${p}`} aria-hidden>
          <svg viewBox="0 0 12 12">
            <path d="M6 0V12M0 6H12" stroke="currentColor" strokeWidth="1" />
          </svg>
        </span>
      ))}
    </>
  );
}

// the abstract-systemic signature: a thin-line node graph, mono + 1 blue node
function NodeGraph() {
  const nodes = [
    { x: 30, y: 70, on: false },
    { x: 95, y: 30, on: false },
    { x: 150, y: 95, on: true },
    { x: 215, y: 45, on: false },
    { x: 250, y: 110, on: false },
    { x: 180, y: 150, on: false },
  ];
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [0, 2], [3, 5],
  ];
  return (
    <svg viewBox="0 0 280 180" style={{ width: "100%", height: "auto" }} aria-hidden>
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
          stroke="var(--border)" strokeWidth="1"
        />
      ))}
      {nodes.map((n, i) => (
        <circle
          key={i}
          cx={n.x} cy={n.y} r={n.on ? 6 : 4}
          fill={n.on ? "var(--brand)" : "var(--bg-base)"}
          stroke={n.on ? "var(--brand)" : "var(--text-muted)"}
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}

const TYPE = [
  ["Display", "lab-display", "Software, reviewed by humans."],
  ["H1", "lab-h1", "Software, reviewed by humans."],
  ["H2", "lab-h2", "Software, reviewed by humans."],
  ["H3", "lab-h3", "Software, reviewed by humans."],
  ["Lead", "lab-lead", "A studio that builds custom software and AI products."],
  ["Body", "lab-body", "Every build is human-reviewed, and the code is yours. We pair the speed of AI generation with the judgment of a real engineer before anything ships."],
  ["Small", "lab-small", "Every build is human-reviewed, and the code is yours."],
  ["Kicker", "lab-kicker", "How it works"],
] as const;

const SWATCHES = [
  ["Brand", "var(--brand)", "#1200C5"],
  ["Brand hover", "var(--brand-hover)", "#2E1CFF"],
  ["Accent", "var(--accent)", "#00D4FF"],
  ["Text", "var(--text-primary)", "primary"],
  ["Surface", "var(--surface)", "surface"],
  ["Border", "var(--border)", "border"],
  ["Success", "var(--success)", "#00C853"],
  ["Warning", "var(--warning)", "#FFB300"],
  ["Error", "var(--error)", "#FF3B6E"],
];

export function Gallery() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [font, setFont] = useState<"geist" | "schibsted">("geist");
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
            {(["light", "dark"] as const).map((t) => (
              <button key={t} className={theme === t ? "on" : ""} onClick={() => setTheme(t)}>{t}</button>
            ))}
          </div>
          <div className="lab-toggle" role="group" aria-label="Font">
            {(["geist", "schibsted"] as const).map((f) => (
              <button key={f} className={font === f ? "on" : ""} onClick={() => setFont(f)}>
                {f === "geist" ? "Geist" : "Schibsted"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="lab-wrap">
        {/* hero sample */}
        <section className="lab-section">
          <p className="lab-kicker" style={{ marginBottom: 16 }}>/ Custom software + AI</p>
          <h1 className="lab-display" style={{ maxWidth: 760 }}>
            Software, reviewed<br />by humans.
          </h1>
          <p className="lab-lead lab-secondary" style={{ marginTop: 20, maxWidth: 540 }}>
            We pair the speed of AI generation with the judgment of a real engineer — before anything ships. The code is yours.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 28, alignItems: "center" }}>
            <button className="lab-btn lab-btn-primary">Start a build <ArrowRight size={15} /></button>
            <button className="lab-btn lab-btn-secondary">See the work</button>
          </div>
        </section>

        {/* typography */}
        <section className="lab-section">
          <div className="lab-sectitle"><span className="lab-kicker">01</span><h2 className="lab-h2">Typography</h2></div>
          <div style={{ display: "grid", gap: 22 }}>
            {TYPE.map(([label, cls, sample]) => (
              <div key={label} style={{ display: "grid", gridTemplateColumns: "84px 1fr", gap: 20, alignItems: "baseline" }}>
                <span className="lab-small lab-muted">{label}</span>
                <span className={cls}>{sample}</span>
              </div>
            ))}
          </div>
        </section>

        {/* color */}
        <section className="lab-section">
          <div className="lab-sectitle"><span className="lab-kicker">02</span><h2 className="lab-h2">Color</h2></div>
          <p className="lab-small lab-muted" style={{ marginBottom: 20 }}>Mono-forward: el azul es chispa, no campo. Resuelve por tema.</p>
          <div className="lab-swatches">
            {SWATCHES.map(([name, val, hex]) => (
              <div key={name} className="lab-swatch">
                <div className="chip" style={{ background: val }} />
                <div className="meta">
                  <div className="name">{name}</div>
                  <div className="hex">{hex}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* buttons */}
        <section className="lab-section">
          <div className="lab-sectitle"><span className="lab-kicker">03</span><h2 className="lab-h2">Buttons & controls</h2></div>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <button className="lab-btn lab-btn-primary">Primary <ArrowRight size={15} /></button>
            <button className="lab-btn lab-btn-secondary">Secondary</button>
            <button className="lab-btn lab-btn-blue">Blue CTA</button>
            <button className="lab-iconbtn" aria-label="next"><ArrowRight size={17} /></button>
          </div>
          <p className="lab-small lab-muted" style={{ marginTop: 14 }}>Primario = negro (invierte por tema). Azul = máx 1 por página.</p>
        </section>

        {/* cards + feature row */}
        <section className="lab-section">
          <div className="lab-sectitle"><span className="lab-kicker">04</span><h2 className="lab-h2">Cards & feature row</h2></div>
          <div className="lab-tickframe" style={{ borderRadius: 12, overflow: "hidden", marginTop: 8 }}>
            <Ticks />
            <div className="lab-features">
              {[
                ["01", "Human review", "A real engineer reviews every build before it ships — not just generated and shipped."],
                ["02", "You own the code", "No lock-in. The codebase is yours, clean and documented, from day one."],
                ["03", "Built with Maxwell", "Our process turns a brief into production software with a clear, auditable trail."],
              ].map(([n, t, d]) => (
                <div key={n} className="lab-feature">
                  <span className="num">{n}</span>
                  <h3 className="lab-h3" style={{ marginTop: 12, fontSize: 18 }}>{t}</h3>
                  <p className="lab-small lab-secondary" style={{ marginTop: 8 }}>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* illustration signature + steps */}
        <section className="lab-section">
          <div className="lab-sectitle"><span className="lab-kicker">05</span><h2 className="lab-h2">Signature & steps</h2></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "center" }}>
            <div className="lab-card" style={{ background: "var(--bg-secondary)" }}>
              <span className="lab-kicker">Abstract systemic</span>
              <div style={{ marginTop: 12 }}><NodeGraph /></div>
            </div>
            <div>
              <div className="lab-steps">
                {["Brief", "Generate", "Human review", "Ship"].map((s, i) => (
                  <span key={s} className={`lab-step ${i === 2 ? "active" : ""}`}>{s}</span>
                ))}
              </div>
              <p className="lab-small lab-muted" style={{ marginTop: 16 }}>Ilustración de línea fina, monocroma, con 1 nodo azul. El paso activo en negro.</p>
            </div>
          </div>
        </section>

        {/* nav + logo */}
        <section className="lab-section">
          <div className="lab-sectitle"><span className="lab-kicker">06</span><h2 className="lab-h2">Nav, logo & strip</h2></div>
          <div className="lab-nav lab-tickframe" style={{ padding: "16px 20px" }}>
            <span style={{ height: 20, width: 70, display: "inline-block" }}><NoonWordmark /></span>
            <div className="links">
              <a className="active">Work</a><a>Services</a><a>Approach</a><a>Contact</a>
            </div>
            <button className="lab-btn lab-btn-primary" style={{ padding: "8px 16px" }}>Start a build</button>
          </div>

          <div style={{ display: "flex", gap: 48, alignItems: "center", marginTop: 36, flexWrap: "wrap" }}>
            <span style={{ height: 34, width: 120, display: "inline-block" }}><NoonWordmark /></span>
            <span style={{ height: 40, width: 38, display: "inline-block" }}><NoonMark /></span>
          </div>

          <p className="lab-small lab-muted" style={{ margin: "36px 0 14px" }}>Logo strip — honesto (built with), no clientes falsos:</p>
          <div className="lab-strip">
            {["Next.js", "Stripe", "Vercel", "Postgres", "Anthropic", "Resend"].map((n) => (
              <span key={n} style={{ fontWeight: 600, fontSize: 18 }}>{n}</span>
            ))}
          </div>
        </section>

        <div style={{ padding: "40px 0 80px", display: "flex", alignItems: "center", gap: 8 }}>
          <Plus size={13} className="lab-muted" />
          <span className="lab-small lab-muted">Galería v1 · toggleá tema y fuente arriba. Söhne se agrega cuando me pases los archivos.</span>
        </div>
      </div>
    </div>
  );
}
