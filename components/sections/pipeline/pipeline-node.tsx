"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface PipelineNodeProps {
  label: string;
  sublabel?: string;
  icon?: ReactNode;
  isActive?: boolean;
  isComplete?: boolean;
  delay?: number;
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function PipelineNode({
  label,
  sublabel,
  icon,
  isActive = false,
  isComplete = false,
  delay = 0,
  children,
  className = "",
  size = "md",
}: PipelineNodeProps) {
  const sizes = {
    sm: { width: "w-36", height: "h-28", mockupHeight: "h-16" },
    md: { width: "w-48", height: "h-36", mockupHeight: "h-24" },
    lg: { width: "w-56", height: "h-44", mockupHeight: "h-32" },
  };

  const { width, height, mockupHeight } = sizes[size];

  return (
    <motion.div
      className={`relative ${width} ${className}`}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {/* Glow effect when active */}
      {isActive && (
        <motion.div
          className="absolute -inset-2 rounded-2xl"
          style={{
            background: "radial-gradient(circle at center, rgba(18, 0, 197, 0.15) 0%, transparent 70%)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Main card */}
      <motion.div
        className={`relative ${height} rounded-xl border bg-black/40 backdrop-blur-sm overflow-hidden transition-colors duration-300 ${
          isActive
            ? "border-primary/40 shadow-lg shadow-primary/10"
            : isComplete
            ? "border-emerald-500/30"
            : "border-white/10"
        }`}
        whileHover={{ scale: 1.02, y: -2 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            {icon && (
              <div
                className={`w-5 h-5 rounded flex items-center justify-center transition-colors duration-300 ${
                  isActive ? "bg-primary/20 text-primary" : "bg-white/10 text-gray-400"
                }`}
              >
                {icon}
              </div>
            )}
            <div>
              <p className="text-[11px] font-medium text-white">{label}</p>
              {sublabel && <p className="text-[9px] text-gray-500">{sublabel}</p>}
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-1">
            {isComplete ? (
              <motion.div
                className="flex items-center gap-1 text-emerald-400"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </motion.div>
            ) : isActive ? (
              <motion.div
                className="w-2 h-2 rounded-full bg-primary"
                animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            ) : (
              <div className="w-2 h-2 rounded-full bg-white/20" />
            )}
          </div>
        </div>

        {/* Mockup container */}
        <div className={`${mockupHeight} p-2`}>{children}</div>
      </motion.div>
    </motion.div>
  );
}

// Simplified node for the AI models row
export function MiniPipelineNode({
  label,
  color,
  icon,
  isActive = false,
  delay = 0,
  children,
}: {
  label: string;
  color: string;
  icon?: ReactNode;
  isActive?: boolean;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <motion.div
      className="relative w-36"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Glow */}
      {isActive && (
        <motion.div
          className="absolute -inset-1 rounded-xl"
          style={{
            background: `radial-gradient(circle at center, ${color}20 0%, transparent 70%)`,
          }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      <div
        className={`relative h-28 rounded-lg border bg-black/50 backdrop-blur-sm overflow-hidden transition-all duration-300 ${
          isActive ? `border-[${color}]/40` : "border-white/5"
        }`}
        style={{ borderColor: isActive ? `${color}40` : undefined }}
      >
        {/* Header */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-white/5">
          {icon}
          <span className="text-[10px] font-medium text-gray-300">{label}</span>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-28px)] p-1.5">{children}</div>
      </div>
    </motion.div>
  );
}
