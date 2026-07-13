import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { NoonWordmark } from "@/components/brand/noon-logo";
import "@/app/_components/site/legal-rd.css";

export default function Loading() {
  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} lgl-rd`}>
      <header className="lgl-nav">
        <div className="lgl-nav-inner">
          <span className="lgl-nav-logo" aria-label="Noon">
            <span style={{ height: 20, display: "inline-flex" }}>
              <NoonWordmark />
            </span>
          </span>
        </div>
      </header>

      <div className="lgl-frame" aria-hidden />

      <main
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "var(--text-muted)",
                display: "inline-block",
                animation: "nf-pulse 1.2s ease-in-out infinite",
                animationDelay: `${i * 180}ms`,
              }}
            />
          ))}
        </div>
      </main>

      <style>{`
        @keyframes nf-pulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
