"use client";

import { ReactNode } from "react";

type GradientGlowProps = {
  children: ReactNode;
  className?: string;
  glowColor?: string;
  glowOpacity?: number;
  glowSize?: "sm" | "md" | "lg";
  animate?: boolean;
};

const glowSizes = {
  sm: "blur-xl",
  md: "blur-2xl",
  lg: "blur-3xl",
};

export function GradientGlow({
  children,
  className = "",
  glowColor = "rgba(18, 0, 197, 0.15)",
  glowOpacity = 0,
  glowSize = "md",
  animate = true,
}: GradientGlowProps) {
  return (
    <div className={`group relative ${className}`}>
      {/* Glow layer */}
      <div
        className={`pointer-events-none absolute -inset-4 rounded-3xl transition-opacity duration-500 ${
          glowSizes[glowSize]
        } ${animate ? "group-hover:opacity-100" : ""}`}
        style={{
          backgroundColor: glowColor,
          opacity: glowOpacity,
        }}
        aria-hidden="true"
      />
      {/* Content */}
      <div className="relative">{children}</div>
    </div>
  );
}

type GlowCardProps = {
  children: ReactNode;
  className?: string;
  glowColor?: string;
  borderGlow?: boolean;
};

export function GlowCard({
  children,
  className = "",
  glowColor = "rgba(18, 0, 197, 0.5)",
  borderGlow = true,
}: GlowCardProps) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl transition-all duration-500 ${className}`}
    >
      {/* Animated border glow */}
      {borderGlow && (
        <div
          className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background: `linear-gradient(135deg, ${glowColor}, transparent 50%, ${glowColor})`,
          }}
          aria-hidden="true"
        />
      )}
      {/* Inner content with background */}
      <div className="relative h-full rounded-2xl bg-card">{children}</div>
    </div>
  );
}
