"use client";

import { useMemo } from "react";

// Deterministic pseudo-random in [0, 1) from a seed. Replaces Math.random()
// so particle values are computed purely during render (react-hooks/purity)
// and stay stable across re-renders instead of changing on every render.
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

type Particle = {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
};

type FloatingParticlesProps = {
  count?: number;
  className?: string;
  color?: string;
  minSize?: number;
  maxSize?: number;
  minDuration?: number;
  maxDuration?: number;
};

export function FloatingParticles({
  count = 30,
  className = "",
  color = "currentColor",
  minSize = 2,
  maxSize = 6,
  minDuration = 15,
  maxDuration = 30,
}: FloatingParticlesProps) {
  // Deterministic seeded values mean SSR and client render identically, so no
  // client-only `mounted` gate is needed (it previously existed only to avoid
  // a hydration mismatch from Math.random).
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: count }, (_, i) => {
      const seed = i * 6;
      return {
        id: i,
        x: seededRandom(seed + 1) * 100,
        y: seededRandom(seed + 2) * 100,
        size: minSize + seededRandom(seed + 3) * (maxSize - minSize),
        duration: minDuration + seededRandom(seed + 4) * (maxDuration - minDuration),
        delay: seededRandom(seed + 5) * -maxDuration,
        opacity: 0.1 + seededRandom(seed + 6) * 0.3,
      };
    });
  }, [count, minSize, maxSize, minDuration, maxDuration]);

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            backgroundColor: color,
            opacity: particle.opacity,
            animation: `particle-float ${particle.duration}s ease-in-out infinite`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes particle-float {
          0%,
          100% {
            transform: translateY(0) translateX(0);
          }
          25% {
            transform: translateY(-30px) translateX(15px);
          }
          50% {
            transform: translateY(-10px) translateX(-10px);
          }
          75% {
            transform: translateY(-40px) translateX(5px);
          }
        }
      `}</style>
    </div>
  );
}
