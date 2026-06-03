"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface PipelineNodeProps {
  label: string;
  sublabel?: string;
  principle?: string;
  icon?: ReactNode;
  delay?: number;
  children: ReactNode;
  fullWidth?: boolean;
}

// Theme-aware, square, single-accent pipeline node. No hover/click chrome —
// the only motion lives INSIDE each card's mockup (typing, loading, etc.).
// The card itself just fades up once on view.
export function PipelineNode({
  label,
  sublabel,
  principle,
  icon,
  delay = 0,
  children,
  fullWidth = false,
}: PipelineNodeProps) {
  return (
    <motion.div
      className={fullWidth ? "w-full" : "w-[300px]"}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.32, 0.72, 0, 1] }}
    >
      <div className="overflow-hidden border border-foreground/10 bg-card/60 backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-foreground/10 px-3 py-2">
          {icon && (
            <span
              className="flex h-6 w-6 items-center justify-center rounded-[8px] text-primary"
              style={{ backgroundColor: "rgba(18,0,197,0.10)" }}
            >
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium text-foreground">{label}</p>
            {sublabel && <p className="truncate text-[10px] text-muted-foreground">{sublabel}</p>}
          </div>
        </div>

        {/* Mockup — the card's own contextual animation lives here */}
        <div className="h-52 p-3">{children}</div>

        {/* Principle caption (approved brand copy — replaces invented stats) */}
        {principle && (
          <div className="border-t border-foreground/10 px-3 py-2">
            <p className="text-[11px] leading-snug text-foreground">{principle}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
