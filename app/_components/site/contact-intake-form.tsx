"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Link as LocaleLink } from "@/lib/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, LoaderCircle, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageCard } from "@/app/_components/site/page-card";
import { cn } from "@/lib/utils";
import {
  contactInbox,
  contactTypeLabels,
  formatContactSource,
  getContactInquiryDetail,
  getContactTypeOption,
  normalizeContactInquiry,
  primaryContactIntents,
  resolvePrimaryIntent,
  type ContactInquiryKey,
  type ContactTypeOption,
} from "@/lib/contact";
import { getStartWithMaxwellHref, siteRoutes } from "@/lib/site-config";
import { countries } from "@/lib/countries";
import { siteStatusTones, siteTones } from "@/lib/site-tones";

type ContactIntakeFormProps = {
  initialInquiry?: string;
  initialDraft?: string;
  initialSource?: string;
  layout?: "split" | "stacked";
  showGuidance?: boolean;
};

type SubmissionState = "idle" | "loading" | "success" | "error";

type ContactFieldErrors = Partial<
  Record<"name" | "email" | "brief" | "budget" | "timeline" | "inquiry" | "contactType" | "country", string[]>
>;

export function ContactIntakeForm({
  initialInquiry,
  initialDraft = "",
  initialSource,
  layout = "split",
  showGuidance = true,
}: ContactIntakeFormProps) {
  const t = useTranslations("contactForm");
  const resolvedInitialInquiry: ContactInquiryKey | null = initialInquiry
    ? resolvePrimaryIntent(normalizeContactInquiry(initialInquiry) ?? "general")
    : null;
  const advancedOptionsId = "contact-advanced-options";
  const [inquiry, setInquiry] = useState<ContactInquiryKey | "">(
    resolvedInitialInquiry ?? ""
  );
  const [contactType, setContactType] = useState<ContactTypeOption>(
    resolvedInitialInquiry ? getContactTypeOption(resolvedInitialInquiry) : "general"
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [projectBrief, setProjectBrief] = useState(initialDraft);
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [country, setCountry] = useState("");
  const [startedAt] = useState(() => Date.now());
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submittedLeadId, setSubmittedLeadId] = useState<string | null>(null);

  const formattedSource = formatContactSource(initialSource);
  const selectedInquiry = getContactInquiryDetail(inquiry || "general");
  const trimmedProjectBrief = projectBrief.trim();
  const maxwellHref = useMemo(
    () => getStartWithMaxwellHref(trimmedProjectBrief || undefined),
    [trimmedProjectBrief]
  );

  function clearSubmissionStatus() {
    if (submissionState === "idle") {
      return;
    }

    setSubmissionState("idle");
    setStatusMessage(null);
    setSubmittedLeadId(null);
  }

  function updateIntent(nextInquiry: ContactInquiryKey) {
    setInquiry(nextInquiry);
    setContactType(getContactTypeOption(nextInquiry));
    clearSubmissionStatus();
  }

  function clearFieldError(field: keyof ContactFieldErrors) {
    if (!fieldErrors[field]) {
      return;
    }

    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmissionState("loading");
    setStatusMessage(null);
    setFieldErrors({});
    setSubmittedLeadId(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inquiry: inquiry || "general",
          contactType: inquiry ? contactType : "general",
          name,
          email,
          brief: projectBrief,
          budget,
          timeline,
          source: initialSource,
          companyWebsite,
          country,
          startedAt,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            message?: string;
            fieldErrors?: ContactFieldErrors;
            lead?: { id: string };
          }
        | null;

      if (!response.ok) {
        setSubmissionState("error");
        setStatusMessage(
          payload?.message ??
            "Your inquiry could not be sent right now. Please try again in a moment."
        );
        setFieldErrors(payload?.fieldErrors ?? {});
        return;
      }

      setSubmissionState("success");
      setStatusMessage("Your message has been sent to Noon. We'll review it and get back to you as soon as possible.");
      setSubmittedLeadId(payload?.lead?.id ?? null);
    } catch {
      setSubmissionState("error");
      setStatusMessage(
        `Your inquiry could not be sent right now. Please try again in a moment or contact us directly at ${contactInbox}.`
      );
    }
  }

  return (
    <div
      className={cn(
        "grid w-full gap-5",
        showGuidance && (layout === "stacked" ? "2xl:grid-cols-[1.08fr_0.92fr]" : "xl:grid-cols-[1.1fr_0.9fr]")
      )}
    >
      <form
        onSubmit={handleSubmit}
        className="liquid-glass-card min-w-0 w-full rounded-none p-5"
      >
        <span className="mb-5 inline-flex items-center gap-2 rounded-[8px] border border-foreground/10 bg-secondary/50 px-3 py-1 text-xs font-mono text-muted-foreground">
          <Sparkles className="h-3 w-3" style={{ color: siteTones.brand.accent }} />
          {t("badge")}
        </span>

        {submissionState === "success" && statusMessage ? (
          <div
            className="mb-6 rounded-[8px] p-4"
            style={{
              border: `1px solid ${siteStatusTones.success.border}`,
              backgroundColor: siteStatusTones.success.surface,
            }}
            aria-live="polite"
          >
            <p className="text-sm font-medium text-foreground">{t("received")}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{statusMessage}</p>
            {submittedLeadId ? (
              <p className="mt-3 text-xs font-mono uppercase tracking-[0.12em] text-muted-foreground">
                {t("reference", { id: submittedLeadId.slice(0, 8) })}
              </p>
            ) : null}
          </div>
        ) : null}

        {submissionState === "error" && statusMessage ? (
          <div className="mb-6 rounded-[8px] border border-destructive/20 bg-destructive/5 p-4" aria-live="polite">
            <p className="text-sm font-medium text-foreground">{t("wentWrong")}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{statusMessage}</p>
          </div>
        ) : null}

        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "-10000px",
            top: "auto",
            width: "1px",
            height: "1px",
            overflow: "hidden",
          }}
        >
          <Label htmlFor="contact-company-website">{t("companyWebsite")}</Label>
          <Input
            id="contact-company-website"
            name="companyWebsite"
            autoComplete="off"
            tabIndex={-1}
            value={companyWebsite}
            onChange={(event) => setCompanyWebsite(event.target.value)}
            placeholder={t("companyWebsitePlaceholder")}
          />
        </div>

        <div className="space-y-4">
          <section className="space-y-3">
            <div>
              {/* Figma /contact form step indicator (01 Route / 02 Contact /
                 03 Context) rendered as an outlined pill, replacing the plain
                 mono text. */}
              <span className="inline-flex items-center gap-2 rounded-[8px] border border-foreground/15 bg-secondary/40 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                <span className="font-medium text-foreground">01</span> Route
              </span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-intent">{t("aboutWhat")}</Label>
              <Select value={inquiry || undefined} onValueChange={(value) => updateIntent(value as ContactInquiryKey)}>
                <SelectTrigger
                  id="contact-intent"
                  className="w-full rounded-[8px]"
                  aria-invalid={Boolean(fieldErrors.inquiry?.length)}
                >
                  <SelectValue placeholder={t("chooseOne")} />
                </SelectTrigger>
                <SelectContent>
                  {primaryContactIntents.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.inquiry?.[0] ? (
                <p className="text-xs text-destructive">{fieldErrors.inquiry[0]}</p>
              ) : null}
            </div>
          </section>

          <section className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-[8px] border border-foreground/15 bg-secondary/40 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
              <span className="font-medium text-foreground">02</span> Contact
            </span>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact-name">{t("fullName")}</Label>
                <Input
                  id="contact-name"
                  name="fullName"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    clearFieldError("name");
                    clearSubmissionStatus();
                  }}
                  placeholder={t("fullNamePlaceholder")}
                  className="h-11 rounded-[8px]"
                  aria-invalid={Boolean(fieldErrors.name?.length)}
                />
                {fieldErrors.name?.[0] ? (
                  <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-email">{t("email")}</Label>
                <Input
                  id="contact-email"
                  name="email"
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    clearFieldError("email");
                    clearSubmissionStatus();
                  }}
                  placeholder={t("emailPlaceholder")}
                  className="h-11 rounded-[8px]"
                  aria-invalid={Boolean(fieldErrors.email?.length)}
                />
                {fieldErrors.email?.[0] ? (
                  <p className="text-xs text-destructive">{fieldErrors.email[0]}</p>
                ) : null}
              </div>
            </div>
          </section>

          <div className="space-y-2">
            <Label htmlFor="contact-country">{t("country")}</Label>
            <Select value={country || undefined} onValueChange={(value) => { setCountry(value); clearSubmissionStatus(); }}>
              <SelectTrigger id="contact-country" className="w-full rounded-[8px]">
                <SelectValue placeholder={t("countryPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.country?.[0] ? (
              <p className="text-xs text-destructive">{fieldErrors.country[0]}</p>
            ) : null}
          </div>

          <section className="space-y-3">
            <div>
              <span className="inline-flex items-center gap-2 rounded-[8px] border border-foreground/15 bg-secondary/40 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
                <span className="font-medium text-foreground">03</span> Context
              </span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-brief">{t("tellUsMore")}</Label>
              <Textarea
                id="contact-brief"
                name="brief"
                autoComplete="off"
                value={projectBrief}
                onChange={(event) => {
                  setProjectBrief(event.target.value);
                  clearFieldError("brief");
                  clearSubmissionStatus();
                }}
                placeholder={t("briefPlaceholder")}
                className="min-h-[118px] rounded-[8px] px-4 py-3 leading-relaxed lg:min-h-[126px]"
                aria-invalid={Boolean(fieldErrors.brief?.length)}
              />
              {fieldErrors.brief?.[0] ? (
                <p className="text-xs text-destructive">{fieldErrors.brief[0]}</p>
              ) : null}
            </div>
          </section>
        </div>

        <div className="mt-4">
          <button
            type="button"
            className="text-sm font-medium text-foreground transition-colors hover:text-foreground/80"
            onClick={() => setShowAdvancedOptions((value) => !value)}
            aria-expanded={showAdvancedOptions}
            aria-controls={advancedOptionsId}
          >
            {showAdvancedOptions ? "Hide advanced options" : "View advanced options"}
          </button>
        </div>

        {showAdvancedOptions ? (
          <div
            id={advancedOptionsId}
            className="mt-4 grid gap-4 rounded-[8px] border border-border bg-background/55 p-4 md:grid-cols-2"
          >
            <div className="space-y-2">
              <Label htmlFor="contact-budget">{t("budget")}</Label>
              <Input
                id="contact-budget"
                name="budgetRange"
                autoComplete="off"
                value={budget}
                onChange={(event) => {
                  setBudget(event.target.value);
                  clearFieldError("budget");
                  clearSubmissionStatus();
                }}
                placeholder="e.g. 15k-30k USD"
                className="h-11 rounded-[8px]"
                aria-invalid={Boolean(fieldErrors.budget?.length)}
              />
              {fieldErrors.budget?.[0] ? (
                <p className="text-xs text-destructive">{fieldErrors.budget[0]}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-timeline">{t("timeline")}</Label>
              <Input
                id="contact-timeline"
                name="timeline"
                autoComplete="off"
                value={timeline}
                onChange={(event) => {
                  setTimeline(event.target.value);
                  clearFieldError("timeline");
                  clearSubmissionStatus();
                }}
                placeholder="e.g. This quarter"
                className="h-11 rounded-[8px]"
                aria-invalid={Boolean(fieldErrors.timeline?.length)}
              />
              {fieldErrors.timeline?.[0] ? (
                <p className="text-xs text-destructive">{fieldErrors.timeline[0]}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col items-start gap-4 sm:flex-row">
          <Button
            type="submit"
            size="lg"
            className="h-11 rounded-full px-6 text-sm"
            disabled={submissionState === "loading"}
          >
            {submissionState === "loading" ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                {t("sending")}
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                {t("send")}
              </>
            )}
          </Button>
          {trimmedProjectBrief ? (
            <Button asChild size="lg" variant="outline" className="h-11 rounded-[8px] px-6 text-sm">
              <Link href={maxwellHref}>
                {t("continueMaxwell")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </div>

        <p className="site-hero-copy mt-3 text-muted-foreground">
          We only use your details to respond to you. See our{" "}
          <LocaleLink className="underline-offset-4 hover:underline" href={siteRoutes.privacyPolicy}>
            Privacy Policy
          </LocaleLink>{" "}
          for how your data is handled.
        </p>

        <p className="site-hero-copy mt-3 text-muted-foreground">
          Prefer email instead? You can still reach Noon directly at{" "}
          <a className="underline-offset-4 hover:underline" href={`mailto:${contactInbox}`}>
            {contactInbox}
          </a>
          .
        </p>
      </form>

      {showGuidance ? (
        <div className="min-w-0 grid gap-6">
          <PageCard
            eyebrow={t("routingEyebrow")}
            title={selectedInquiry.label}
            description={t("routingDescription")}
            tone={siteTones.brand}
          >
            <div className="space-y-3 text-sm text-muted-foreground" aria-live="polite">
              <p>
                <span className="font-medium text-foreground">{t("contactTypeLabel")}</span>{" "}
                {contactTypeLabels[contactType]}
              </p>
              <p>
                <span className="font-medium text-foreground">{t("subjectLabel")}</span> {selectedInquiry.subject}
              </p>
              {formattedSource ? (
                <p>
                  <span className="font-medium text-foreground">{t("sourceLabel")}</span> {formattedSource}
                </p>
              ) : null}
            </div>
          </PageCard>

          <PageCard
            eyebrow={t("nextEyebrow")}
            title={t("nextTitle")}
            description={t("nextDescription")}
            tone={siteStatusTones.success}
          >
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>{t("nextFit")}</p>
              <p>{t("nextOptional")}</p>
              {trimmedProjectBrief ? (
                <p>
                  If you came from Maxwell, your current prompt can still travel back with you without losing context.
                </p>
              ) : null}
            </div>
          </PageCard>
        </div>
      ) : null}
    </div>
  );
}
