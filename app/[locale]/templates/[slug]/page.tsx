import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SitePageFrame } from "@/app/_components/site/site-page-frame";
import { SiteCtaBlock } from "@/app/_components/site/site-cta-block";
import { templates } from "@/data/templates";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { getContactHref, getStartWithMaxwellHref, siteRoutes } from "@/lib/site-config";

import { routing } from "@/i18n/routing";

type TemplateDetailPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    templates.map((template) => ({ locale, slug: template.slug }))
  );
}

export async function generateMetadata({ params }: TemplateDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const template = templates.find((item) => item.slug === slug);

  if (!template) {
    return {
      title: "Template Not Found | Noon",
    };
  }

  return {
    title: `${template.name} | Noon Templates`,
    description: template.summary,
  };
}

export default async function TemplateDetailPage({ params }: TemplateDetailPageProps) {
  const { locale, slug } = await params;
  const template = templates.find((item) => item.slug === slug);

  if (!template) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "templates.detail.cta" });
  const viewer = await getAuthenticatedViewer();

  return (
    <SitePageFrame viewer={viewer}>
      <div className="mx-auto w-full max-w-5xl px-6 py-12 lg:py-20">
        {/* Back link */}
        <Link
          href={siteRoutes.templates}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          All templates
        </Link>

        {/* Hero */}
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 mb-16">
          {/* Image */}
          <div className="relative aspect-video overflow-hidden border border-border bg-secondary/40">
            {template.image && (
              <Image
                src={template.image}
                alt={template.name}
                fill
                className="object-cover"
                priority
              />
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col justify-center">
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
              {template.category}
            </span>
            <h1 className="text-3xl font-medium tracking-tight text-foreground lg:text-4xl mb-4">
              {template.name}
            </h1>
            <p className="site-hero-copy mb-6 text-muted-foreground">
              {template.summary}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-8">
              {template.bestFit.map((fit) => (
                <span
                  key={fit}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-secondary/40 text-muted-foreground"
                >
                  {fit}
                </span>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-11 rounded-full px-6 text-sm">
                <Link href={getStartWithMaxwellHref(template.prompt)}>
                  Use this template
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 rounded-full px-6 text-sm">
                <Link href={getContactHref({ inquiry: "templates", source: `template-${template.slug}` })}>
                  Contact Noon
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid gap-6 lg:grid-cols-3 mb-16">
          {/* Included */}
          <div className="border border-border bg-card p-6">
            <h2 className="text-sm font-medium text-foreground mb-4">Included in baseline</h2>
            <ul className="space-y-3">
              {template.includes.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Extensions */}
          <div className="border border-border bg-card p-6">
            <h2 className="text-sm font-medium text-foreground mb-4">Typical extensions</h2>
            <ul className="space-y-3">
              {template.extensions.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span className="h-4 w-4 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* When to use */}
          <div className="border border-border bg-card p-6">
            <h2 className="text-sm font-medium text-foreground mb-4">Best fit</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-foreground mb-2">
                  <Check className="h-3.5 w-3.5" />
                  Use when
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {template.useWhen}
                </p>
              </div>
              <div className="pt-4 border-t border-border">
                <div className="flex items-center gap-2 text-xs font-medium text-foreground mb-2">
                  <X className="h-3.5 w-3.5" />
                  Not ideal when
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {template.notIdealWhen}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Promise */}
        <div className="border border-border bg-secondary/20 p-6 lg:p-8 mb-16">
          <h2 className="text-sm font-medium text-foreground mb-3">What this baseline delivers</h2>
          <p className="site-section-copy text-muted-foreground">
            {template.baselinePromise}
          </p>
        </div>

      </div>

      <SiteCtaBlock
        title={t("headline")}
        description={t("description")}
        primaryAction={{
          label: t("startWithMaxwell"),
          href: getStartWithMaxwellHref(template.prompt),
        }}
        secondaryAction={{
          label: t("browseAll"),
          href: siteRoutes.templates,
        }}
      />
    </SitePageFrame>
  );
}
