/**
 * Static, marketing-safe data for the embedded Maxwell demo.
 * No network, no auth, no persistence — pure props for the studio components.
 */
import type { ChatMessage } from "@/components/maxwell/studio-shell";

export const DEMO_PROJECT_NAME = "Client order portal";
export const DEMO_VIEWER_EMAIL = "you@yourcompany.com";

// A short, realistic scoping conversation that ends with the prototype ready.
// The studio renders these via `<StudioChatPane messages={...} phase="prototype_ready" />`.
export const DEMO_MESSAGES: ChatMessage[] = [
  {
    id: "demo-user-1",
    role: "user",
    type: "chat",
    content:
      "Build a client portal where customers can track their orders in real time, with sign-in and a scoped view per company.",
    createdAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
  },
  {
    id: "demo-assistant-1",
    role: "assistant",
    type: "chat",
    content:
      "Got it. Mapped the scope:\n\n• Authenticated sign-in (Google + email magic link)\n• Order list scoped per client account\n• Real-time status (shipped · in transit · delivered)\n• Lightweight admin view for Noon ops\n\nHere's a working first version on the right — sign in as `client@acme.com / demo` and you'll see the scoped order list. Want anything adjusted before we move to the formal proposal?",
    createdAt: new Date(Date.now() - 1000 * 60 * 3.5).toISOString(),
    durationMs: 9_400,
  },
];
