"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signInWithEmailAction, type EmailSignInState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="lgl-btn lgl-btn-primary sic-btn">
      {pending ? "Sending link…" : "Continue with Email"}
    </button>
  );
}

/**
 * Email (magic-link) form. Primary UX is the inline "we sent it" state via
 * useActionState — no route change, keeps the user in the signin context. The
 * /signin/check-email page is only a safety net for direct /api/auth entries.
 */
export function EmailSignInForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction] = useActionState<EmailSignInState, FormData>(
    signInWithEmailAction,
    { status: "idle" },
  );

  if (state.status === "sent") {
    return (
      <div className="sic-form">
        <p className="sic-sent" role="status">
          We sent a sign-in link to <strong>{state.email}</strong>. Open it from
          your inbox to continue — it&apos;s valid for 15 minutes.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="sic-form">
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
      <input
        type="email"
        name="email"
        required
        className="sic-input"
        placeholder="name@work-email.com"
        autoComplete="email"
        aria-label="Email address"
      />
      <SubmitButton />
      {state.status === "error" ? (
        <p className="sic-error" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
