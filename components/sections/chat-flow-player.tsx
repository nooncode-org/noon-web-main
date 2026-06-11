"use client";

import dynamic from "next/dynamic";
import { ChatFlow } from "@/remotion/chat-flow";

// Remotion's <Player> plays the ChatFlow composition LIVE in the browser (no
// rendered video file) — vector-crisp text, responsive, autoplay + loop. Loaded
// client-only (ssr:false) because the player touches browser APIs.
const Player = dynamic(() => import("@remotion/player").then((m) => m.Player), {
  ssr: false,
  loading: () => <div style={{ position: "absolute", inset: 0, background: "#0b0d12" }} />,
});

export function ChatFlowPlayer({ className = "" }: { className?: string }) {
  return (
    // Fixed-aspect wrapper gives the box a real height; the player fills it
    // (height:auto collapses because the composition is absolutely positioned).
    <div
      className={`relative overflow-hidden rounded-[14px] border border-foreground/12 ${className}`}
      style={{ aspectRatio: "1280 / 720" }}
    >
      <Player
        component={ChatFlow}
        durationInFrames={300}
        fps={30}
        compositionWidth={1280}
        compositionHeight={720}
        autoPlay
        loop
        initiallyMuted
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
