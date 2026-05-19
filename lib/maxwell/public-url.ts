function normalizeBaseUrl(candidate: string | null | undefined): string | null {
  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.replace(/\/+$/, "");
  }

  return `https://${trimmed.replace(/\/+$/, "")}`;
}

export function resolvePublicBaseUrl(request?: Request): string | null {
  const envCandidate =
    normalizeBaseUrl(process.env.MAXWELL_PUBLIC_BASE_URL) ??
    normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
    normalizeBaseUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeBaseUrl(process.env.VERCEL_URL);

  if (envCandidate) {
    return envCandidate;
  }

  if (!request) {
    return null;
  }

  return new URL(request.url).origin;
}

export function buildPublicProposalUrl(publicToken: string, request?: Request): string {
  const baseUrl = resolvePublicBaseUrl(request);
  if (!baseUrl) {
    throw new Error(
      "A public base URL is required. Set MAXWELL_PUBLIC_BASE_URL or NEXT_PUBLIC_SITE_URL."
    );
  }

  return new URL(`/maxwell/proposal/${publicToken}`, baseUrl).toString();
}

/**
 * Build the client-facing workspace URL used by the B8 #3 "Workspace
 * ready" email. The site uses next-intl with `localePrefix: "always"`
 * (`i18n/routing.ts`), so every URL must include the locale segment.
 *
 * Locale handling: when no locale is passed we default to `"en"`. The
 * email content is currently English-only (B8 templates) and the
 * workspace UI auto-detects browser language after the client lands;
 * forcing `/en/...` in the link avoids a 404 if the locale segment is
 * missing while keeping the door open to per-recipient localisation
 * later (we can pass `session.language` here once the email template
 * supports it).
 */
export function buildWorkspaceUrl(
  sessionId: string,
  options: { locale?: string; request?: Request } = {},
): string {
  const baseUrl = resolvePublicBaseUrl(options.request);
  if (!baseUrl) {
    throw new Error(
      "A public base URL is required. Set MAXWELL_PUBLIC_BASE_URL or NEXT_PUBLIC_SITE_URL."
    );
  }

  const locale = options.locale?.trim() || "en";
  return new URL(`/${locale}/maxwell/workspace/${sessionId}`, baseUrl).toString();
}
