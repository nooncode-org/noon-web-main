"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  sessionId: string;
  alreadyAnswered: { question: string; answer: string }[];
  onComplete: () => void;
};

const MAX_QUESTIONS = 5;

export function UpgradeQuestions({ sessionId, alreadyAnswered, onComplete }: Props) {
  const t = useTranslations("upgradeTool");
  const [questions, setQuestions] = useState<string[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [answered, setAnswered] = useState<{ question: string; answer: string }[]>(
    alreadyAnswered
  );
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch questions once on mount
  useEffect(() => {
    async function fetchQuestions() {
      try {
        const res = await fetch(`/api/upgrade/${sessionId}/question`);
        const data = await res.json();
        if (res.ok) setQuestions(data.questions ?? []);
        else setError(data.message ?? "Could not load questions.");
      } catch {
        setError("Connection error. Please try again.");
      } finally {
        setLoadingQuestions(false);
      }
    }
    fetchQuestions();
  }, [sessionId]);

  // Scroll to bottom when answered list grows
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    inputRef.current?.focus();
  }, [answered.length]);

  const currentIndex = answered.length;
  const currentQuestion = questions[currentIndex] ?? null;
  const allAnswered =
    !loadingQuestions &&
    questions.length > 0 &&
    answered.length >= Math.min(questions.length, MAX_QUESTIONS);

  async function submitAnswer(answerText: string) {
    if (!currentQuestion || !answerText.trim()) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/upgrade/${sessionId}/question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: currentQuestion, answer: answerText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? "Failed to save answer."); return; }
      setAnswered((prev) => [...prev, { question: currentQuestion, answer: answerText.trim() }]);
      setCurrentAnswer("");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSkip() {
    // Skip remaining questions and move to analysis
    onComplete();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (currentAnswer.trim() && !isSubmitting) submitAnswer(currentAnswer);
    }
  }

  if (loadingQuestions) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Preparing questions based on your website…
      </div>
    );
  }

  if (error && questions.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={handleSkip}>
          Skip questions and start audit
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          A few quick questions
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {answered.length} of {Math.min(questions.length, MAX_QUESTIONS)} answered
        </p>
      </div>

      {/* Chat thread */}
      <div className="space-y-4">
        {answered.map((qa, i) => (
          <div key={i} className="space-y-2">
            {/* Question bubble */}
            <div className="flex">
              <div className="rounded-xl rounded-tl-sm bg-muted px-4 py-2.5 max-w-prose">
                <p className="text-sm text-foreground">{qa.question}</p>
              </div>
            </div>
            {/* Answer bubble */}
            <div className="flex justify-end">
              <div className="rounded-xl rounded-tr-sm bg-foreground px-4 py-2.5 max-w-prose">
                <p className="text-sm text-background">{qa.answer}</p>
              </div>
            </div>
          </div>
        ))}

        {/* Current question */}
        {!allAnswered && currentQuestion && (
          <div className="flex">
            <div className="rounded-xl rounded-tl-sm bg-muted px-4 py-2.5 max-w-prose">
              <p className="text-sm text-foreground">{currentQuestion}</p>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Input area or completion */}
      {allAnswered ? (
        <div className="space-y-3 pt-2">
          <p className="text-sm text-muted-foreground">
            All questions answered. Ready to start the audit.
          </p>
          <Button onClick={onComplete} className="gap-2">
            Start audit
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : currentQuestion ? (
        <div className="space-y-2">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("answerPlaceholder")}
              rows={2}
              maxLength={1000}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none transition-shadow"
            />
            <button
              type="button"
              onClick={() => submitAnswer(currentAnswer)}
              disabled={!currentAnswer.trim() || isSubmitting}
              className="absolute right-3 bottom-3 rounded-md p-1.5 text-foreground disabled:opacity-30 hover:bg-muted transition-colors"
              aria-label={t("submitAnswer")}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Press Enter to submit · Shift+Enter for new line
            </p>
            <button
              type="button"
              onClick={handleSkip}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <SkipForward className="h-3 w-3" />
              Skip remaining questions
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
