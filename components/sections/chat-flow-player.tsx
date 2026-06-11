"use client";

import { useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { ChatFlow } from "@/remotion/chat-flow";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useHasMounted } from "@/hooks/use-has-mounted";

// Live, in-site Remotion player for the ChatFlow composition — vector-crisp,
// responsive, no rendered video file. Plays only while in the viewport (perf),
// and honors prefers-reduced-motion by holding the final frame (no motion),
// matching the site's motion baseline. Client-only: rendered after mount so the
// browser-only player never runs on the server.
export function ChatFlowPlayer({ className = "" }: { className?: string }) {
  const mounted = useHasMounted();
  const playerRef = useRef<PlayerRef>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();

  useEffect(() => {
    if (!mounted) return;
    const player = playerRef.current;
    const box = boxRef.current;
    if (!player || !box) return;
    if (reduce) {
      player.seekTo(299); // static end frame — the delivered/“reviewed” state
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) player.play();
        else player.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(box);
    return () => io.disconnect();
  }, [mounted, reduce]);

  return (
    <div
      ref={boxRef}
      className={`relative overflow-hidden rounded-[14px] border border-foreground/12 ${className}`}
      style={{ aspectRatio: "1280 / 720" }}
    >
      {mounted ? (
        <Player
          ref={playerRef}
          component={ChatFlow}
          durationInFrames={300}
          fps={30}
          compositionWidth={1280}
          compositionHeight={720}
          loop
          initiallyMuted
          style={{ width: "100%", height: "100%" }}
        />
      ) : null}
    </div>
  );
}
