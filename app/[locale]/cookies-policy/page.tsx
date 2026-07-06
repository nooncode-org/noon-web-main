import type { Metadata } from "next";
import { LegalDocumentPage } from "@/app/_components/site/legal-document-page";
import { cookiesPolicyDocument } from "@/data/legal-documents";

export const metadata: Metadata = {
  title: "Cookies Policy | Noon",
  description: cookiesPolicyDocument.summary,
  alternates: { canonical: "/en/cookies-policy" },
};

type CookiesPolicyPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CookiesPolicyPage({ params }: CookiesPolicyPageProps) {
  const { locale } = await params;

  return <LegalDocumentPage document={cookiesPolicyDocument} locale={locale} />;
}
