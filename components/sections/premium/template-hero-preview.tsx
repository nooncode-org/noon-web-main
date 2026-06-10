"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { ArrowRight, Code2, Database, FileCode2, Folder, Layers, Lock, Palette } from "lucide-react";
import { EASE } from "@/lib/motion";

// ============================================================================
// TemplateHeroPreview — /templates intro. The copy promises "real software,
// not mockups," so the visual proves it: the actual project structure of a
// production template on Noon's real stack — not a fabricated, cycling app
// dashboard (the old version faked screens + `app.yourcompany.com`, with
// rounded-2xl, shadows, gradients and macOS dots). Square, flat, single-accent,
// theme-aware.
// ============================================================================

const FEATURES: { icon: typeof Code2; label: string }[] = [
  { icon: Code2, label: "Production code" },
  { icon: Database, label: "Database ready" },
  { icon: Lock, label: "Auth included" },
  { icon: Palette, label: "Customizable" },
  { icon: Layers, label: "Scalable" },
];

const TREE: { depth: number; name: string; kind: "root" | "dir" | "file" }[] = [
  { depth: 0, name: "client-portal/", kind: "root" },
  { depth: 1, name: "app/", kind: "dir" },
  { depth: 2, name: "(auth)/", kind: "dir" },
  { depth: 2, name: "dashboard/", kind: "dir" },
  { depth: 2, name: "api/", kind: "dir" },
  { depth: 1, name: "components/", kind: "dir" },
  { depth: 1, name: "lib/", kind: "dir" },
  { depth: 2, name: "db.ts", kind: "file" },
  { depth: 2, name: "auth.ts", kind: "file" },
  { depth: 1, name: "tests/", kind: "dir" },
  { depth: 1, name: "package.json", kind: "file" },
];

const STACK = [
  { src: "/figma/logos/logo-nextjs.svg", alt: "Next.js" },
  { src: "/figma/logos/logo-typescript.svg", alt: "TypeScript" },
  { src: "/figma/logos/logo-supabase.svg", alt: "Supabase" },
];

interface TemplatePreviewProps {
  className?: string;
}

export function TemplateHeroPreview({ className = "" }: TemplatePreviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section ref={ref} className={`py-16 ${className}`}>
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left — text */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <span className="site-meta-label mb-4 inline-flex items-center gap-2 font-mono text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Production-ready
            </span>

            <h2 className="site-section-title mb-4">
              Start with a <span className="text-muted-foreground">solid foundation.</span>
            </h2>

            <p className="site-section-copy max-w-md text-muted-foreground">
              Every template is a complete, production-ready codebase. Not wireframes, not
              mockups — real software you can deploy and customize.
            </p>

            <div className="mt-8 flex flex-wrap gap-2.5">
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <motion.span
                    key={f.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.4, delay: 0.25 + i * 0.08, ease: EASE }}
                    className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-card/50 px-3 py-1.5 text-[13px] text-muted-foreground"
                  >
                    <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
                    {f.label}
                  </motion.span>
                );
              })}
            </div>

            <div className="mt-8 inline-flex items-center gap-2 text-sm text-primary">
              <span>Browse templates below</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </motion.div>

          {/* Right — the actual project structure (proof it's real code) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.15, ease: EASE }}
          >
            <div className="overflow-hidden border border-foreground/10 bg-card/40">
              {/* window chrome — neutral */}
              <div className="flex items-center gap-2 border-b border-foreground/10 px-4 py-2.5">
                <span className="flex gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-foreground/15" />
                  <span className="h-2 w-2 rounded-full bg-foreground/15" />
                  <span className="h-2 w-2 rounded-full bg-foreground/15" />
                </span>
                <span className="ml-1 font-mono text-[11px] text-muted-foreground/70">client-portal</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground/45">main</span>
              </div>

              {/* file tree */}
              <div className="p-4 sm:p-5">
                {TREE.map((node, i) => {
                  const isFile = node.kind === "file";
                  return (
                    <motion.div
                      key={`${node.name}-${i}`}
                      className="flex items-center gap-2 py-[3px] font-mono text-[12px]"
                      style={{ paddingLeft: node.depth * 18 }}
                      initial={{ opacity: 0, x: -6 }}
                      animate={inView ? { opacity: 1, x: 0 } : {}}
                      transition={{ duration: 0.3, delay: 0.25 + i * 0.05, ease: EASE }}
                    >
                      {isFile ? (
                        <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground/45" strokeWidth={1.75} />
                      ) : (
                        <Folder className="h-3.5 w-3.5 shrink-0 text-primary/70" strokeWidth={1.75} />
                      )}
                      <span
                        className={
                          node.kind === "root"
                            ? "font-medium text-foreground"
                            : isFile
                              ? "text-muted-foreground"
                              : "text-foreground/85"
                        }
                      >
                        {node.name}
                      </span>
                    </motion.div>
                  );
                })}
              </div>

              {/* stack footer */}
              <div className="flex items-center gap-3 border-t border-foreground/10 bg-foreground/[0.02] px-4 py-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/45">
                  Stack
                </span>
                {STACK.map((s) => (
                  <Image
                    key={s.alt}
                    src={s.src}
                    width={16}
                    height={16}
                    alt={s.alt}
                    unoptimized
                    className="h-4 w-4 opacity-80 dark:invert"
                  />
                ))}
                <span className="ml-auto font-mono text-[10px] text-muted-foreground/45">real code</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
