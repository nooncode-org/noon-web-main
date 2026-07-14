import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { normalizeInternalRedirect } from "@/lib/auth/redirect";
import { AuthMethodsScreen } from "../auth-methods";
import "@/app/_components/site/legal-rd.css";
import "../signin-rd.css";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirectTo?: string }>;
};

export default async function SignInPage({ params, searchParams }: Props) {
  const [{ locale }, { redirectTo: rawRedirectTo }, session] = await Promise.all([
    params,
    searchParams,
    auth(),
  ]);

  const redirectTo = normalizeInternalRedirect(rawRedirectTo, `/${locale}`);
  if (session?.user?.email) {
    redirect(redirectTo);
  }

  return <AuthMethodsScreen mode="signin" locale={locale} redirectTo={rawRedirectTo} />;
}
