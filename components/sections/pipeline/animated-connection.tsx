"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface AnimatedConnectionProps {
  direction?: "horizontal" | "vertical";
  isActive?: boolean;
  delay?: number;
  className?: string;
}

export function AnimatedConnection({
  direction = "horizontal",
  isActive = false,
  delay = 0,
  className = "",
}: AnimatedConnectionProps) {
  const [particles, setParticles] = useState<number[]>([]);

  useEffect(() => {
    if (!isActive) return;
    // Generate particles while active; clearing them is done in the cleanup
    // below (on deactivate/unmount) to avoid a synchronous setState in the
    // effect body, which can trigger cascading renders.
    const interval = setInterval(() => {
      setParticles((prev) => {
        const newParticles = [...prev, Date.now()];
        // Keep only last 5 particles
        return newParticles.slice(-5);
      });
    }, 400);
    return () => {
      clearInterval(interval);
      setParticles([]);
    };
  }, [isActive]);

  const isHorizontal = direction === "horizontal";
  const lineLength = isHorizontal ? 80 : 60;

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{
        width: isHorizontal ? lineLength : 2,
        height: isHorizontal ? 2 : lineLength,
      }}
    >
      {/* Base line */}
      <motion.div
        className="absolute"
        style={{
          width: isHorizontal ? "100%" : 2,
          height: isHorizontal ? 2 : "100%",
          background: isActive
            ? "linear-gradient(90deg, rgba(18, 0, 197, 0.1), rgba(18, 0, 197, 0.4), rgba(18, 0, 197, 0.1))"
            : "rgba(255, 255, 255, 0.1)",
        }}
        initial={{ scaleX: isHorizontal ? 0 : 1, scaleY: isHorizontal ? 1 : 0 }}
        animate={{ scaleX: 1, scaleY: 1 }}
        transition={{
          duration: 0.6,
          delay,
          ease: [0.22, 1, 0.36, 1],
        }}
      />

      {/* Flowing particles */}
      {particles.map((id, index) => (
        <motion.div
          key={id}
          className="absolute rounded-full"
          style={{
            width: 6,
            height: 6,
            background: "rgba(18, 0, 197, 0.9)",
            boxShadow: "0 0 10px rgba(18, 0, 197, 0.6), 0 0 20px rgba(18, 0, 197, 0.3)",
            [isHorizontal ? "left" : "top"]: 0,
          }}
          initial={{
            [isHorizontal ? "x" : "y"]: 0,
            opacity: 0,
            scale: 0.5,
          }}
          animate={{
            [isHorizontal ? "x" : "y"]: lineLength,
            opacity: [0, 1, 1, 0],
            scale: [0.5, 1, 1, 0.5],
          }}
          transition={{
            duration: 0.8,
            ease: "linear",
            delay: index * 0.1,
          }}
        />
      ))}

      {/* Glow effect when active */}
      {isActive && (
        <motion.div
          className="absolute"
          style={{
            width: isHorizontal ? "100%" : 8,
            height: isHorizontal ? 8 : "100%",
            background: isHorizontal
              ? "linear-gradient(90deg, transparent, rgba(18, 0, 197, 0.2), transparent)"
              : "linear-gradient(180deg, transparent, rgba(18, 0, 197, 0.2), transparent)",
            filter: "blur(4px)",
          }}
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
    </div>
  );
}

// Branching connection for when pipeline splits
export function BranchConnection({
  isActive = false,
  delay = 0,
}: {
  isActive?: boolean;
  delay?: number;
}) {
  return (
    <svg
      width="120"
      height="100"
      viewBox="0 0 120 100"
      fill="none"
      className="overflow-visible"
    >
      {/* Top branch */}
      <motion.path
        d="M0 50 Q30 50 60 10 L120 10"
        stroke={isActive ? "rgba(18, 0, 197, 0.5)" : "rgba(255, 255, 255, 0.1)"}
        strokeWidth="2"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      />
      {/* Middle branch */}
      <motion.path
        d="M0 50 L120 50"
        stroke={isActive ? "rgba(18, 0, 197, 0.5)" : "rgba(255, 255, 255, 0.1)"}
        strokeWidth="2"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: delay + 0.1, ease: [0.22, 1, 0.36, 1] }}
      />
      {/* Bottom branch */}
      <motion.path
        d="M0 50 Q30 50 60 90 L120 90"
        stroke={isActive ? "rgba(18, 0, 197, 0.5)" : "rgba(255, 255, 255, 0.1)"}
        strokeWidth="2"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: delay + 0.2, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* Animated particles on paths when active */}
      {isActive && (
        <>
          <motion.circle
            r="3"
            fill="rgba(18, 0, 197, 0.9)"
            filter="url(#glow)"
            initial={{ offsetDistance: "0%" }}
            animate={{ offsetDistance: "100%" }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            style={{ offsetPath: "path('M0 50 Q30 50 60 10 L120 10')" }}
          />
          <motion.circle
            r="3"
            fill="rgba(18, 0, 197, 0.9)"
            filter="url(#glow)"
            initial={{ offsetDistance: "0%" }}
            animate={{ offsetDistance: "100%" }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear", delay: 0.2 }}
            style={{ offsetPath: "path('M0 50 L120 50')" }}
          />
          <motion.circle
            r="3"
            fill="rgba(18, 0, 197, 0.9)"
            filter="url(#glow)"
            initial={{ offsetDistance: "0%" }}
            animate={{ offsetDistance: "100%" }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear", delay: 0.4 }}
            style={{ offsetPath: "path('M0 50 Q30 50 60 90 L120 90')" }}
          />
        </>
      )}

      {/* SVG filter for glow effect */}
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}
