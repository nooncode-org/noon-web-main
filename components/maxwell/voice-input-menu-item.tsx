"use client";

/**
 * The "Voice input" entry that lives in all three composer menus (the home
 * hero, the signed-in launcher, the studio chat). One component so the three
 * can't drift — they had drifted already as three copies of a disabled button.
 *
 * The menu deliberately stays OPEN while dictating: closing it would hide the
 * only control that stops the microphone, and an input you can't stop is worse
 * than one that never started.
 */

import { Mic } from "lucide-react";
import { useTranslations } from "next-intl";
import { appendTranscript, useVoiceInput } from "@/components/maxwell/use-voice-input";

export function VoiceInputMenuItem({
  value,
  onChange,
  className,
  iconClassName,
  errorClassName = "px-4 pb-2 text-[11px] leading-snug text-red-500",
}: {
  /** Whatever is currently typed — dictation is appended to it, never replaces it. */
  value: string;
  onChange: (next: string) => void;
  /** The host menu's own item styling, so this looks native in each composer. */
  className: string;
  iconClassName: string;
  errorClassName?: string;
}) {
  const t = useTranslations("voice");
  const { supported, listening, error, toggle } = useVoiceInput({
    onTranscript: (text) => onChange(appendTranscript(value, text)),
    messages: {
      denied: t("denied"),
      noSpeech: t("noSpeech"),
      failed: t("failed"),
    },
  });

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={!supported}
        // A browser without speech recognition says why, rather than offering a
        // button that does nothing.
        title={supported ? undefined : t("unsupported")}
        aria-pressed={listening}
        className={supported ? className : `${className} cursor-not-allowed opacity-60`}
      >
        <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
          <Mic className={iconClassName} />
          {listening && (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-red-500 motion-safe:animate-pulse"
            />
          )}
        </span>
        {listening ? t("listening") : t("label")}
      </button>
      {error && <p className={errorClassName}>{error}</p>}
    </>
  );
}
