export function normalizeInternalRedirect(
  value: string | null | undefined,
  fallback = "/maxwell",
) {
  if (!value) return fallback;

  const candidate = value.trim();
  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//")) return fallback;

  return candidate;
}

export function buildSignInHref(redirectTo: string) {
  const params = new URLSearchParams({ redirectTo });
  return `/signin?${params.toString()}`;
}
