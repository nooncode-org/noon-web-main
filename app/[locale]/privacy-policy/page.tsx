import type { Metadata } from "next";
import { LegalDocumentPage } from "@/app/_components/site/legal-document-page";
import { privacyPolicyDocument } from "@/data/legal-documents";

export const metadata: Metadata = {
  title: "Privacy Policy | Noon",
  description: privacyPolicyDocument.summary,
  alternates: { canonical: "/en/privacy-policy" },
};

type PrivacyPolicyPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function PrivacyPolicyPage({ params }: PrivacyPolicyPageProps) {
  const { locale } = await params;

  return <LegalDocumentPage document={privacyPolicyDocument} locale={locale} />;
}
