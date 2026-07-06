import type { Metadata } from "next";
import { LegalDocumentPage } from "@/app/_components/site/legal-document-page";
import { legalNoticeDocument } from "@/data/legal-documents";

export const metadata: Metadata = {
  title: "Legal Notice | Noon",
  description: legalNoticeDocument.summary,
  alternates: { canonical: "/en/legal-notice" },
};

type LegalNoticePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function LegalNoticePage({ params }: LegalNoticePageProps) {
  const { locale } = await params;

  return <LegalDocumentPage document={legalNoticeDocument} locale={locale} />;
}
