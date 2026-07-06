import type { Metadata } from "next";
import { LegalDocumentPage } from "@/app/_components/site/legal-document-page";
import { termsAndConditionsDocument } from "@/data/legal-documents";

export const metadata: Metadata = {
  title: "Terms and Conditions | Noon",
  description: termsAndConditionsDocument.summary,
  alternates: { canonical: "/en/terms-and-conditions" },
};

type TermsAndConditionsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function TermsAndConditionsPage({ params }: TermsAndConditionsPageProps) {
  const { locale } = await params;

  return <LegalDocumentPage document={termsAndConditionsDocument} locale={locale} />;
}
