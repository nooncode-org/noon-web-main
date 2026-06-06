import { auth, isGoogleAuthConfigured, getDevBypassEmail } from "@/auth";

export type AuthenticatedViewer = {
  email: string;
  name: string | null;
  image: string | null;
};

export async function getAuthenticatedViewer(): Promise<AuthenticatedViewer | null> {
  // Dev bypass: when Google OAuth is not configured and DEV_VIEWER_EMAIL is
  // set in .env.local, return a fake viewer so API routes work locally.
  // getDevBypassEmail() returns null in production (NODE_ENV=production).
  if (!isGoogleAuthConfigured()) {
    const devEmail = getDevBypassEmail();
    if (devEmail) return { email: devEmail, name: "Dev User", image: null };
    return null;
  }

  const session = await auth();
  const user = session?.user;
  const email = user?.email?.trim().toLowerCase();
  if (!email) return null;

  return {
    email,
    name: user?.name?.trim() ?? null,
    image: user?.image?.trim() ?? null,
  };
}
