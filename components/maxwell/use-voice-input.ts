"use client";

/**
 * Dictation for the three composers (the home hero, the signed-in launcher and
 * the studio chat), which since launch have shown a Mic entry disabled under
 * "Voice input is not available yet."
 *
 * Built on the browser's own speech recognition — no audio ever leaves the
 * device for us, no API key, no per-minute cost. Chrome, Edge and Safari
 * implement it; Firefox does not. That is the whole reason `supported` is part
 * of the contract: a browser that can't do this must say so, not fail silently
 * on click.
 *
 * It DICTATES INTO the composer rather than sending: speech is a faster way to
 * type, not a second way to submit. The client still reads what they said and
 * presses send — which matters, because recognition mishears, and a misheard
 * brief is worse than a slowly typed one.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocale } from "next-intl";

/**
 * The slice of the Web Speech API we use. Typed locally because it isn't in
 * TypeScript's DOM lib — it never became a W3C standard, only a de-facto one.
 */
type SpeechRecognitionAlternative = { transcript: string };
type SpeechRecognitionResult = {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { readonly length: number; [index: number]: SpeechRecognitionResult };
};
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Recognition wants a full BCP-47 tag, and the quality difference is real: "es"
 * alone leaves the engine guessing at a variety. These are the two we serve.
 */
const RECOGNITION_LANG: Record<string, string> = {
  es: "es-ES",
  en: "en-US",
};

/** Browser support can't change mid-session, so there is nothing to subscribe to. */
const subscribeToNothing = () => () => {};

export type VoiceInputState = {
  /** false → the browser has no speech recognition. Keep the entry disabled. */
  supported: boolean;
  listening: boolean;
  /** Set when something went wrong, already phrased for a person to read. */
  error: string | null;
  /** Starts if idle, stops if listening. */
  toggle: () => void;
  stop: () => void;
  clearError: () => void;
};

export function useVoiceInput({
  onTranscript,
  messages,
}: {
  /** Called with each FINAL chunk of speech, to append to the composer. */
  onTranscript: (text: string) => void;
  /** Error copy, passed in so this stays free of any message namespace. */
  messages: { denied: string; noSpeech: string; failed: string };
}): VoiceInputState {
  const locale = useLocale();
  // Whether the browser can do this at all. Read through useSyncExternalStore
  // rather than set from an effect: it is a value that never changes, and this
  // is the API built for exactly that — it answers `false` on the server (so
  // the first paint doesn't offer a button that turns out to be dead) and the
  // real answer on the client, with no extra render and no hydration mismatch.
  const supported = useSyncExternalStore(
    subscribeToNothing,
    () => getRecognitionCtor() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // The callback is read at event time, so a re-render with a new closure
  // doesn't need to tear down and rebuild the recogniser mid-sentence. Assigned
  // in an effect, not during render: React forbids mutating a ref while
  // rendering, and here it would also mean a discarded render could leave the
  // live recogniser calling into a closure that never committed.
  const onTranscriptRef = useRef(onTranscript);
  const messagesRef = useRef(messages);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    messagesRef.current = messages;
  });

  // Never leave the microphone open behind a closing dialog or a route change.
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (recognitionRef.current) {
      stop();
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = RECOGNITION_LANG[locale] ?? RECOGNITION_LANG.en;
    // continuous → a long brief isn't cut off at the first pause.
    recognition.continuous = true;
    // We only append FINAL chunks, so interim results are off: streaming them
    // into the box makes the text jump around and rewrite itself as the engine
    // changes its mind, which is unreadable while you're still talking.
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      let chunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) chunk += result[0].transcript;
      }
      const text = chunk.trim();
      if (text) onTranscriptRef.current(text);
    };

    recognition.onerror = (event) => {
      // "aborted" is our own stop() unwinding — not something to report.
      if (event.error === "aborted") return;
      const m = messagesRef.current;
      setError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? m.denied
          : event.error === "no-speech"
            ? m.noSpeech
            : m.failed,
      );
      recognitionRef.current = null;
      setListening(false);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setError(null);
      setListening(true);
    } catch {
      // start() throws if a recogniser is already running in this tab.
      setError(messagesRef.current.failed);
      recognitionRef.current = null;
      setListening(false);
    }
  }, [locale, stop]);

  const clearError = useCallback(() => setError(null), []);

  return { supported, listening, error, toggle, stop, clearError };
}

/**
 * Append dictated speech to whatever is already typed, with exactly one space
 * between — someone can type half a sentence, dictate the rest, and get a
 * sentence rather than "halfthe rest".
 */
export function appendTranscript(current: string, addition: string): string {
  const base = current.trimEnd();
  if (!base) return addition;
  return `${base} ${addition}`;
}
