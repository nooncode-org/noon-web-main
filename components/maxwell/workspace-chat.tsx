"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ChangeEvent } from "react";
import { Paperclip, ArrowUp, Search, Sparkles, ImageIcon, Plus, ListChecks, X, Camera } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReviewOverlay, ReviewThumb, type ReviewMark } from "@/components/maxwell/workspace-review-overlay";

/**
 * Hand a ready-to-send message to the chat composer from elsewhere in the
 * portal — e.g. the settings panel, where a locked action points the client at
 * their Noon team instead of dead-ending on a disabled button.
 *
 * Held in a module variable rather than passed as an event payload so it works
 * in BOTH orders: if the chat is already mounted the listener picks it up; if
 * the caller had to switch tabs first, the freshly-mounted chat drains it on
 * mount. Without that, the message is lost in the tab-switch race.
 */
const PREFILL_EVENT = "noon:chat-prefill";
let pendingPrefill: string | null = null;

export function prefillWorkspaceChat(text: string) {
  pendingPrefill = text;
  window.dispatchEvent(new Event(PREFILL_EVENT));
}

/**
 * Jump to the Chat tab AND leave `message` typed in the composer — the portal's
 * "talk to a human about this" bridge (settings' locked actions, the Domains
 * dialogs). Drives the real tab button; the prefill survives the mount race.
 */
export function goToWorkspaceChat(message: string) {
  document
    .querySelector<HTMLButtonElement>(
      'nav[aria-label="Workspace sections"] [role="tab"][data-tabid="chat"]',
    )
    ?.click();
  prefillWorkspaceChat(message);
}

/**
 * WorkspaceChat — the client portal's single communication surface ("a chat with
 * Noon"). Replaces the old Support tab (Requests form + Messages) AND the old
 * Brand-assets tab: sharing files (logo, references, screenshots) is just an
 * attachment here. Maxwell (AI) and any Noon dev participate; a dev shows their
 * name + photo when they reply.
 *
 * A message can be FORMALIZED into a tracked request (type + priority) that
 * carries a client-visible status (received → in progress → done) WITHOUT leaving
 * the chat: 90% is conversation, the trackable things get tracked. The "+" menu
 * exposes the three side-affordances: Photo, File, and Track as request.
 *
 * Front-only mock (logic later): a real thread + persistence, Maxwell's engine,
 * dev identity from the App, the attachment backend, and the formalize flow are
 * all deferred. Sending just appends the client message locally so the surface
 * feels alive.
 */

export type RequestStatus = "received" | "in_progress" | "done";
export type RequestPriority = "Low" | "Normal" | "High";

export type ChatMsg = {
  id: string;
  from: "client" | "maxwell" | "dev";
  devName?: string;
  text: string;
  at: string;
  /** `href` (real mode) makes the chip a link — e.g. a Noon-delivered material. */
  attachment?: { name: string; image?: boolean; href?: string };
  review?: ReviewMark;
  request?: { label: string; priority?: RequestPriority; status: RequestStatus };
  /** Real mode: the tracked request this message created — enables Reply. */
  requestId?: string;
};

export type ChatSendResult = { ok: true } | { ok: false; error: string };

/**
 * Real-thread wiring (the live workspace page). The mock preview passes nothing
 * and keeps the seeded front-only behavior. All fields are serializable /
 * server-action references, so the server page can hand them straight over.
 */
export type RealThread = {
  /** Server-merged thread: comments + team updates + materials + requests. */
  messages: ChatMsg[];
  /** Plain message → the team (client-comment outbox). */
  send: (body: string) => Promise<ChatSendResult>;
  /** Formalize as a tracked request; absent until the project is App-mapped. */
  formalize?: (input: {
    type: "adjustment" | "bug";
    clientPriority: "low" | "normal" | "high";
    body: string;
  }) => Promise<ChatSendResult>;
  /**
   * Share a file with the team. Rides the existing per-request attachment
   * pipeline: the file becomes a `material` request ("Material / file") with the
   * note as its body. Absent when uploads aren't available for this project.
   */
  attach?: (form: FormData) => Promise<ChatSendResult>;
  /** Client-side mirror of the server's upload rules, for a fail-fast message. */
  attachLimits?: { maxBytes: number; mimes: readonly string[] };
  /** Clarification reply linked to an existing request (B.5a). */
  reply?: (input: { requestId: string; body: string }) => Promise<ChatSendResult>;
  /** Replaces the mock's Maxwell promise line (no Maxwell backend yet). */
  expectationLine: string;
};

const REQUEST_STATUS: Record<RequestStatus, { label: string; chip: string }> = {
  received: { label: "Received", chip: "border-border text-muted-foreground" },
  in_progress: { label: "In progress", chip: "border-[#0056fd]/25 bg-[#0056fd]/10 text-[#0056fd]" },
  done: { label: "Done", chip: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600" },
};

const SEED: ChatMsg[] = [
  {
    id: "m1",
    from: "maxwell",
    text: "Hi! I'm Maxwell, Noon's assistant. Ask me anything about your project — I'll answer what I can right away and loop in your Noon dev for anything hands-on.",
    at: "9:58",
  },
  // Brand sharing lives in the chat now (folded in from the old Brand-assets tab):
  // the client just attaches their kit and the team builds with it.
  {
    id: "m2",
    from: "client",
    text: "Great! Here's our brand kit to start — logo, colors, and fonts. 🎨",
    at: "9:59",
    attachment: { name: "brand-kit.zip" },
  },
  {
    id: "m3",
    from: "maxwell",
    text: "Perfect — I've shared these with your Noon team. They'll build with your brand from day one.",
    at: "9:59",
  },
  { id: "m4", from: "client", text: "Quick one — is my site live yet?", at: "10:21" },
  {
    id: "m5",
    from: "maxwell",
    text: "Yes! It's live at opsdash.nooncode.dev since yesterday. 🎉",
    at: "10:21",
  },
  {
    id: "m6",
    from: "client",
    text: "Amazing. Can we make the header logo a bit bigger?",
    at: "10:23",
  },
  {
    id: "m7",
    from: "maxwell",
    text: "Got it — logged it for the team as a change so it's tracked.",
    at: "10:23",
    request: { label: "Change", priority: "Normal", status: "in_progress" },
  },
  {
    id: "m8",
    from: "dev",
    devName: "Carlos",
    text: "On it — I'll bump the logo size and you'll see it in the next version 👍",
    at: "10:31",
  },
  {
    id: "m9",
    from: "client",
    text: "Perfect. Also this blue on the CTA looks a bit off:",
    at: "10:34",
    attachment: { name: "cta-color.png", image: true },
  },
  {
    id: "m10",
    from: "maxwell",
    text: "Thanks for the screenshot — I've shared it with Carlos.",
    at: "10:34",
  },
  // Noon → client handoff, also in the chat (replaces the old "From your Noon team"
  // deliverables list).
  {
    id: "m11",
    from: "dev",
    devName: "Carlos",
    text: "Here's your getting-started guide so you can run the dashboard yourself.",
    at: "10:40",
    attachment: { name: "getting-started-guide.pdf" },
  },
];

// A brand-new client's chat opens with just Maxwell's greeting — the fresh
// (empty) state, before any back-and-forth (?state=new in the preview).
const FRESH_SEED: ChatMsg[] = [SEED[0]];

// One-time buyer's chat (owner 2026-07-22): SUPPORT + questions only — NOT a
// change/updates pipeline. It still handles the brand-kit handoff, "is it live?",
// hosting/domain, and file handoffs; but when they ask for a CHANGE, Maxwell
// draws the line and points to a membership (which is what buys ongoing work).
// No "Change · in progress" chip, no dev "I'll ship it in the next version".
const ONETIME_SEED: ChatMsg[] = [
  {
    id: "t1",
    from: "maxwell",
    text: "Hi! I'm Maxwell, Noon's assistant. Ask me anything about your project — how something works, your files, your hosting or domain. I'll answer what I can and loop in your Noon team when it needs a person.",
    at: "9:58",
  },
  {
    id: "t2",
    from: "client",
    text: "Great! Here's our brand kit — logo, colors, and fonts. 🎨",
    at: "9:59",
    attachment: { name: "brand-kit.zip" },
  },
  {
    id: "t3",
    from: "maxwell",
    text: "Perfect — I've shared these with your Noon team so your build reflects your brand.",
    at: "9:59",
  },
  { id: "t4", from: "client", text: "Quick one — is my site live yet?", at: "10:21" },
  {
    id: "t5",
    from: "maxwell",
    text: "Yes! It's live at opsdash.nooncode.dev since yesterday. 🎉",
    at: "10:21",
  },
  {
    id: "t6",
    from: "client",
    text: "Amazing. Can we make the header logo a bit bigger?",
    at: "10:23",
  },
  {
    id: "t7",
    from: "maxwell",
    text: "Your project is a one-time build, so it ships as delivered — I can't queue new changes here. For tweaks and new features whenever you want them, a membership puts your team back on it. Want me to show you how it works?",
    at: "10:23",
  },
  {
    id: "t8",
    from: "dev",
    devName: "Carlos",
    text: "And here's your getting-started guide so you can run everything yourself. 👍",
    at: "10:40",
    attachment: { name: "getting-started-guide.pdf" },
  },
];

function Avatar({ msg }: { msg: ChatMsg }) {
  if (msg.from === "maxwell") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0056fd]/12 text-[#0056fd]">
        <Sparkles className="h-4 w-4" strokeWidth={1.75} />
      </span>
    );
  }
  // dev — a photo in real life; here the initial.
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-foreground">
      {(msg.devName ?? "N").charAt(0)}
    </span>
  );
}

// The attachment chip lives inside two very different bubbles, so its frame is
// context-aware: a glassy white inset reads on the blue client bubble; on the
// secondary Maxwell/dev bubble a token border+bg reads in BOTH light and dark
// (the old white/black alphas went invisible on the light gray). max-w-full +
// min-w-0 keep a long filename truncating inside the bubble instead of spilling.
function Attachment({
  name,
  image,
  href,
  onAccent,
}: {
  name: string;
  image?: boolean;
  href?: string;
  onAccent?: boolean;
}) {
  const inner = (
    <>
      {image ? (
        <ImageIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      ) : (
        <Paperclip className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      )}
      <span className="min-w-0 truncate">{name}</span>
    </>
  );
  const frame = `mt-2 inline-flex max-w-full items-center gap-2 rounded-[6px] border px-2.5 py-1.5 text-xs ${
    onAccent ? "border-white/25 bg-white/12" : "border-border bg-background/70"
  }`;
  // A real deliverable (material) carries its URL — the chip opens it.
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={`${frame} underline-offset-2 hover:underline`}>
        {inner}
      </a>
    );
  }
  return <span className={frame}>{inner}</span>;
}

// A formalized request, shown as a status chip. Priority is surfaced only when it
// deviates from Normal (Low/High) — the actionable signal — to keep the chip calm.
function RequestChip({ request }: { request: NonNullable<ChatMsg["request"]> }) {
  const rs = REQUEST_STATUS[request.status];
  const pri = request.priority && request.priority !== "Normal" ? ` · ${request.priority}` : "";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${rs.chip}`}
    >
      {request.label}
      {pri} · {rs.label}
    </span>
  );
}

function MessageRow({
  msg,
  onReply,
}: {
  msg: ChatMsg;
  /** Real mode: start a clarification reply linked to this message's request. */
  onReply?: (requestId: string, label: string) => void;
}) {
  if (msg.from === "client") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%]">
          <div className="rounded-[12px] rounded-tr-sm bg-[#0056fd] px-3.5 py-2 text-sm leading-relaxed text-white">
            {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
            {msg.review && <ReviewThumb rects={msg.review.rects} host={msg.review.host} onAccent />}
            {msg.attachment && (
              <Attachment
                name={msg.attachment.name}
                image={msg.attachment.image}
                href={msg.attachment.href}
                onAccent
              />
            )}
          </div>
          {/* Request chip sits BELOW the blue bubble (its muted palette can't read
              on blue) — alongside the timestamp. */}
          <div className="mt-1 flex items-center justify-end gap-2">
            {msg.request && <RequestChip request={msg.request} />}
            {msg.requestId && onReply && (
              <button
                type="button"
                onClick={() => onReply(msg.requestId!, msg.request?.label ?? "this request")}
                className="text-[10px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
              >
                Reply
              </button>
            )}
            <p className="text-[10px] text-muted-foreground">{msg.at}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
      <Avatar msg={msg} />
      <div className="max-w-[80%]">
        <p className="mb-1 text-[11px] font-medium text-muted-foreground">
          {msg.from === "maxwell" ? "Maxwell" : msg.devName ? `${msg.devName} · Noon` : "Your Noon team"}
        </p>
        <div className="rounded-[12px] rounded-tl-sm bg-secondary/50 px-3.5 py-2 text-sm leading-relaxed">
          {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
          {msg.review && <ReviewThumb rects={msg.review.rects} host={msg.review.host} />}
          {msg.attachment && (
            <Attachment
              name={msg.attachment.name}
              image={msg.attachment.image}
              href={msg.attachment.href}
            />
          )}
          {msg.request && (
            <span className="mt-2 block">
              <RequestChip request={msg.request} />
            </span>
          )}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">{msg.at}</p>
      </div>
    </div>
  );
}

export function WorkspaceChat({
  fresh = false,
  oneTime = false,
  siteUrl,
  real,
  readOnly,
}: {
  fresh?: boolean;
  /**
   * One-time buyer's chat: support + questions only, not a change/updates
   * pipeline (owner 2026-07-22). Swaps the seeded conversation + the expectation
   * line; mock-only (the real thread passes its own `real.messages`).
   */
  oneTime?: boolean;
  /** The client's live site — enables "+" → Review site (absent = no site yet). */
  siteUrl?: string;
  /** Live-thread wiring (the real workspace page); absent = the seeded mock. */
  real?: RealThread;
  /**
   * The conversation stays fully readable but takes no new messages (a membership
   * that has ended). The composer is replaced by this note rather than disabled:
   * a greyed-out box invites clicking and explains nothing.
   */
  readOnly?: { note: string };
} = {}) {
  // Seeded ONCE: the action's revalidatePath re-renders the page mid-session,
  // but re-seeding would duplicate our optimistic sends (the server list now
  // contains them under new ids). Fresh data lands on the next visit.
  const [messages, setMessages] = useState<ChatMsg[]>(
    real ? real.messages : fresh ? FRESH_SEED : oneTime ? ONETIME_SEED : SEED,
  );
  const [isPending, startTransition] = useTransition();
  const [sendError, setSendError] = useState<string | null>(null);
  // Real mode: a pending clarification reply, linked to a tracked request.
  const [replyTo, setReplyTo] = useState<{ requestId: string; label: string } | null>(null);
  const [draft, setDraft] = useState("");
  // Staged attachment (from the "+" → Photo/File) — shown above the composer,
  // sent with the next message.
  const [attach, setAttach] = useState<{ name: string; image?: boolean } | null>(null);
  // Real mode: the actual File behind the staged chip, uploaded on send.
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  // Formalize mode: a non-null type means the next message is tracked as a request.
  const [reqType, setReqType] = useState<"Change" | "Bug" | null>(null);
  const [reqPriority, setReqPriority] = useState<RequestPriority>("Normal");
  // Thread search (audit P1-6) — when the chat IS the project timeline,
  // "what did we say about the logo?" must not mean scrolling. WhatsApp-style:
  // the query filters the visible thread; clearing restores it.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // Drain a message handed over by prefillWorkspaceChat — once on mount (the
  // caller switched tabs to get here) and on every later call (already open).
  useEffect(() => {
    function drain() {
      if (pendingPrefill == null) return;
      setDraft(pendingPrefill);
      pendingPrefill = null;
      // Next frame: the caller's dialog is still unmounting this tick, and
      // focusing before it goes away just loses the focus again.
      requestAnimationFrame(() => composerRef.current?.focus());
    }
    drain();
    window.addEventListener(PREFILL_EVENT, drain);
    return () => window.removeEventListener(PREFILL_EVENT, drain);
  }, []);

  function onPick(image: boolean) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) {
        // Fail fast on the client with the SAME rules the server enforces — a
        // 10 MB upload that dies server-side is a slow way to say "too big".
        const limits = real?.attachLimits;
        if (limits) {
          if (f.size > limits.maxBytes) {
            setSendError(
              `That file is too large (max ${Math.round(limits.maxBytes / 1024 / 1024)} MB).`,
            );
            e.target.value = "";
            return;
          }
          if (!limits.mimes.includes(f.type)) {
            setSendError("That file type isn't allowed.");
            e.target.value = "";
            return;
          }
        }
        setSendError(null);
        setAttach({ name: f.name, image });
        setPickedFile(f);
      }
      e.target.value = ""; // allow re-picking the same file
    };
  }

  const canSend = Boolean(draft.trim() || attach);

  // A short "h:mm" stamp for optimistic sends, matching the seeded format.
  const nowStamp = () =>
    new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date());

  // Every attachment shared in the thread, newest last — feeds the Files
  // dropdown in the toolbar so "where's that zip?" never means scrolling.
  const threadFiles = messages
    .filter((m) => m.attachment)
    .map((m) => ({
      msgId: m.id,
      name: m.attachment!.name,
      who: m.from === "client" ? "You" : m.from === "maxwell" ? "Maxwell" : (m.devName ?? "Noon"),
      at: m.at,
    }));

  // Matches text AND attachment names, so "brand" finds brand-kit.zip too.
  const q = searchQuery.trim().toLowerCase();
  const visibleMessages = q
    ? messages.filter(
        (m) =>
          m.text.toLowerCase().includes(q) ||
          m.attachment?.name.toLowerCase().includes(q),
      )
    : messages;

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery("");
  }

  function send() {
    if (!canSend || isPending) return;
    const text = draft.trim();

    if (real) {
      // Optimistic append + the matching real transport: a file share, a
      // clarification reply (linked to its request), a formalized request, or a
      // plain message. On failure the bubble is rolled back and the draft (and
      // the staged file) restored — no silent message-into-the-void.
      const optimistic: ChatMsg = {
        id: `local-${Date.now()}`,
        from: "client",
        text,
        at: nowStamp(),
        attachment: attach ?? undefined,
        request:
          !replyTo && reqType
            ? { label: reqType, priority: reqPriority, status: "received" }
            : undefined,
      };
      const routedReply = replyTo;
      const routedType = reqType;
      const routedPriority = reqPriority;
      const routedFile = pickedFile;
      const routedAttach = attach;
      setMessages((prev) => [...prev, optimistic]);
      setDraft("");
      setSendError(null);
      setReplyTo(null);
      setReqType(null);
      setReqPriority("Normal");
      setAttach(null);
      setPickedFile(null);
      startTransition(async () => {
        let result: ChatSendResult;
        if (routedFile && real.attach) {
          const form = new FormData();
          form.set("file", routedFile);
          form.set("note", text);
          result = await real.attach(form);
        } else if (routedReply) {
          result = await real.reply!({ requestId: routedReply.requestId, body: text });
        } else if (routedType && real.formalize) {
          result = await real.formalize({
            type: routedType === "Bug" ? "bug" : "adjustment",
            clientPriority: routedPriority.toLowerCase() as "low" | "normal" | "high",
            body: text,
          });
        } else {
          result = await real.send(text);
        }
        if (!result.ok) {
          setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
          setDraft(text);
          setAttach(routedAttach);
          setPickedFile(routedFile);
          setSendError(result.error);
        }
      });
      return;
    }

    // Front-only mock: append locally so the surface feels alive.
    setMessages((prev) => [
      ...prev,
      {
        id: `c${prev.length}`,
        from: "client",
        text,
        at: "now",
        attachment: attach ?? undefined,
        request: reqType ? { label: reqType, priority: reqPriority, status: "received" } : undefined,
      },
    ]);
    setDraft("");
    setAttach(null);
    setReqType(null);
    setReqPriority("Normal");
  }

  // Reply affordance (real mode): the composer targets one request until sent
  // or cancelled. Mutually exclusive with formalize mode.
  function startReply(requestId: string, label: string) {
    setReplyTo({ requestId, label });
    setReqType(null);
    composerRef.current?.focus();
  }

  return (
    // Centered reading column (not full-bleed 1280px) so it reads like the
    // studio chat: the thread fills the tab height, the composer pins to the
    // bottom, and both share the same bounds. Wide (v0-style composer width).
    <div className="mx-auto flex h-[calc(100vh-10rem)] w-full max-w-[980px] flex-col">
      {/* Review-site overlay — opened from the "+" menu. It carries its own note
          input + Send, so on Send it posts the marked areas + note STRAIGHT to
          the chat (owner-approved flow 2026-07-20) — no composer staging. */}
      {reviewOpen && siteUrl && (
        <ReviewOverlay
          siteUrl={siteUrl}
          embed={Boolean(real)}
          onClose={() => setReviewOpen(false)}
          onAttach={(mark) => {
            if (real) {
              // The wire message carries the marked-area context in text (the
              // thumb itself is client-side until real capture lands, #27).
              const wire = `${mark.note}\n\n[Marked ${
                mark.rects.length > 1 ? `${mark.rects.length} areas` : "an area"
              } on ${mark.host}]`;
              const optimistic: ChatMsg = {
                id: `local-${Date.now()}`,
                from: "client",
                text: mark.note,
                review: mark,
                at: nowStamp(),
              };
              setMessages((prev) => [...prev, optimistic]);
              setSendError(null);
              startTransition(async () => {
                const result = await real.send(wire);
                if (!result.ok) {
                  setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
                  setSendError(result.error);
                }
              });
            } else {
              setMessages((prev) => [
                ...prev,
                { id: `c${prev.length}`, from: "client", text: mark.note, review: mark, at: "now" },
              ]);
            }
            setReviewOpen(false);
          }}
        />
      )}

      {/* Thread toolbar — the reply-time promise (audit P0-1: explicit
          expectations) + search (P1-6) + the Files collector (P1-5: attachments
          shared in the thread stay retrievable without scrolling for them). */}
      <div className="flex items-center justify-between gap-3 pb-2">
        {searchOpen ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" strokeWidth={1.75} />
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeSearch();
              }}
              placeholder="Search this conversation"
              aria-label="Search this conversation"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/50"
            />
            {q && (
              <span className="shrink-0 text-[11px] text-muted-foreground/70">
                {visibleMessages.length} {visibleMessages.length === 1 ? "match" : "matches"}
              </span>
            )}
            <button
              type="button"
              aria-label="Close search"
              onClick={closeSearch}
              className="shrink-0 rounded-[6px] p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground/70">
            {real?.expectationLine ??
              (oneTime
                ? "Maxwell answers instantly · your Noon team helps with questions about your project"
                : "Maxwell answers instantly · your Noon team replies within 24h")}
          </p>
        )}
        {!searchOpen && (
          <button
            type="button"
            aria-label="Search this conversation"
            onClick={() => setSearchOpen(true)}
            className="ml-auto inline-flex shrink-0 items-center rounded-[6px] border border-border p-1.5 text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        )}
        {!searchOpen && threadFiles.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-[6px] border border-border px-2.5 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground data-[state=open]:bg-secondary/40"
              >
                <Paperclip className="h-3.5 w-3.5" strokeWidth={1.75} />
                Files
                <span className="text-muted-foreground/60">{threadFiles.length}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-[6px]">
              {threadFiles.map((f) => (
                <DropdownMenuItem
                  key={f.msgId}
                  onSelect={() => {
                    document
                      .getElementById(`wsmsg-${f.msgId}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[13px]">{f.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {f.who} · {f.at}
                    </span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div
        role="log"
        aria-label="Conversation with Noon"
        className="flex-1 space-y-4 overflow-y-auto pb-4"
      >
        {q && visibleMessages.length === 0 && (
          <p className="py-8 text-center text-[13px] text-muted-foreground">
            No messages match &ldquo;{searchQuery.trim()}&rdquo;
          </p>
        )}
        {/* A real thread opens honestly empty — no seeded Maxwell greeting. */}
        {!q && real && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-1 py-10 text-center">
            <p className="text-sm font-medium">Say hello 👋</p>
            <p className="text-[13px] text-muted-foreground">
              Messages here reach your Noon team directly.
            </p>
          </div>
        )}
        {visibleMessages.map((m) => (
          // The id anchors the Files dropdown's jump-to-message.
          <div key={m.id} id={`wsmsg-${m.id}`}>
            <MessageRow msg={m} onReply={real?.reply ? startReply : undefined} />
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Hidden pickers driven by the "+" menu. */}
      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={onPick(true)} />
      <input ref={fileInputRef} type="file" className="hidden" onChange={onPick(false)} />

      {/* Reply banner (real mode) — the next send is a clarification reply
          linked to its tracked request, not a new thread message. */}
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-[10px] border border-border bg-secondary/30 px-2.5 py-2 text-[12px]">
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            Replying to <span className="font-medium text-foreground">{replyTo.label}</span>
          </span>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            aria-label="Cancel reply"
            className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>
      )}

      {/* Send failure — the optimistic bubble was rolled back; the draft is
          restored so nothing the client typed is lost. */}
      {sendError && (
        <p role="alert" className="mb-2 text-[12px] leading-relaxed text-red-600">
          {sendError}
        </p>
      )}

      {/* Staged request bar — set the type + priority; the next send is tracked. */}
      {reqType && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-[10px] border border-[#0056fd]/20 bg-[#0056fd]/[0.04] px-2.5 py-2 text-[12px]">
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <ListChecks className="h-3.5 w-3.5 text-[#0056fd]" strokeWidth={1.75} />
            Track as request
          </span>
          <div className="flex overflow-hidden rounded-[6px] border border-border">
            {(["Change", "Bug"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setReqType(t)}
                className={`px-2.5 py-0.5 transition-colors ${
                  reqType === t ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <label className="inline-flex items-center gap-1.5 text-muted-foreground">
            Priority
            <Select value={reqPriority} onValueChange={(v) => setReqPriority(v as RequestPriority)}>
              <SelectTrigger
                aria-label="Request priority"
                className="h-auto gap-1 rounded-[6px] border-border bg-transparent px-2 py-0.5 text-[12px] font-medium text-foreground shadow-none data-[size=default]:h-auto"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-[7rem]">
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="High">High</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <button
            type="button"
            onClick={() => setReqType(null)}
            aria-label="Cancel tracking as request"
            className="ml-auto rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>
      )}

      {/* Staged attachment preview. */}
      {attach && (
        <div className="mb-2 flex items-center gap-2 rounded-[10px] border border-border bg-secondary/30 px-2.5 py-2 text-[12px]">
          {attach.image ? (
            <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          ) : (
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          )}
          <span className="min-w-0 flex-1 truncate">{attach.name}</span>
          <button
            type="button"
            onClick={() => {
              setAttach(null);
              setPickedFile(null);
            }}
            aria-label="Remove attachment"
            className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>
      )}

      {/* Read-only: the thread above stays scrollable and searchable; only the
          ability to add to it goes away, with the reason in its place. */}
      {readOnly ? (
        <p className="shrink-0 rounded-[12px] border border-border bg-secondary/30 px-4 py-3 text-center text-[13px] leading-relaxed text-muted-foreground">
          {readOnly.note}
        </p>
      ) : (
      <>
      {/* Composer — slim SINGLE row (v0-style): "+" (left), the input inline,
          the arrow-up send (right). Buttons pin to the bottom (items-end) so they
          stay put as the input grows. Same buttons/surface as the studio chat. */}
      <div className="flex shrink-0 items-end gap-2 rounded-[12px] bg-[#f9f9f9] px-2 py-1.5 shadow-[0_-1px_0_0_#0000000f,-1px_0_0_0_#0000000f,1px_0_0_0_#0000000f] dark:bg-[#131313] dark:shadow-[0_-1px_0_0_#ffffff14,-1px_0_0_0_#ffffff14,1px_0_0_0_#ffffff14]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Add"
              title="Attach a file, photo, or track a request"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-foreground transition-opacity hover:opacity-70 data-[state=open]:opacity-70"
            >
              <Plus className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" sideOffset={8} className="w-52 rounded-[10px]">
            {/* Review site — mark an exact area on the client's live site and send
                it here, so Maxwell + the dev know precisely what's meant. Only when
                there's a live site to review. */}
            {siteUrl && (
              <DropdownMenuItem
                onSelect={() => {
                  // Let Radix close the menu (no preventDefault — that kept it
                  // open above the overlay), and mount the overlay after the
                  // menu's ~150ms exit animation so its ghost never overlaps.
                  setTimeout(() => setReviewOpen(true), 160);
                }}
              >
                <Camera className="h-4 w-4" strokeWidth={1.75} />
                Review site
              </DropdownMenuItem>
            )}
            {/* Sharing a file rides the request-scoped attachment pipeline (it
                becomes a "Material / file" request), so the picker only shows
                when that path is actually available for this project. */}
            {(!real || real.attach) && (
              <>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    photoInputRef.current?.click();
                  }}
                >
                  <ImageIcon className="h-4 w-4" strokeWidth={1.75} />
                  Photo
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }}
                >
                  <Paperclip className="h-4 w-4" strokeWidth={1.75} />
                  File
                </DropdownMenuItem>
              </>
            )}
            {(!real || real.formalize) && (
              <DropdownMenuItem
                onSelect={() => {
                  setReplyTo(null);
                  setReqType((t) => t ?? "Change");
                }}
              >
                <ListChecks className="h-4 w-4" strokeWidth={1.75} />
                Track as request
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <textarea
          ref={composerRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="Message Noon…"
          aria-label="Message Noon"
          className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-sm leading-relaxed text-foreground outline-none [field-sizing:content] placeholder:text-muted-foreground/55"
        />
        <button
          type="button"
          onClick={send}
          disabled={!canSend || isPending}
          aria-label="Send message"
          title="Send message"
          className="group flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#0056fd] text-white transition-colors hover:bg-[#0047e0] disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowUp className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
        </button>
      </div>
      </>
      )}
    </div>
  );
}
