import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SiteCtaAction = {
  label: string;
  href: string;
};

type SiteCtaBlockProps = {
  title: ReactNode;
  description?: ReactNode;
  primaryAction?: SiteCtaAction;
  secondaryAction?: SiteCtaAction;
  accentColor?: string;
  className?: string;
  blockHref?: string;
};

export function SiteCtaBlock({
  title,
  description,
  primaryAction,
  secondaryAction,
  accentColor = "#ffffff",
  className = "",
  blockHref,
}: SiteCtaBlockProps) {
  const content = (
    <div
      className={cn(
        "site-primary-action relative flex min-h-[168px] items-center justify-center overflow-hidden px-6 py-10 text-center sm:min-h-[176px] lg:px-12 lg:py-12",
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute right-0 top-0 h-[400px] w-[400px] translate-x-1/3 -translate-y-1/3 rounded-full opacity-[0.12] blur-[80px] transition-opacity duration-300 ease-out",
          blockHref && "group-hover:opacity-[0.16]",
        )}
        style={{ background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)` }}
      />
      <div className="relative z-10">
        <h2
          className={cn(
            "site-section-title",
            description || primaryAction || secondaryAction ? "mb-4" : "translate-y-1",
          )}
        >
          {title}
        </h2>
        {description ? (
          <p
            className={cn(
              "site-section-copy mx-auto max-w-md text-white/75",
              (primaryAction || secondaryAction) && "mb-8",
            )}
          >
            {description}
          </p>
        ) : null}
        {primaryAction || secondaryAction ? (
          <div className="flex flex-wrap justify-center gap-4">
            {primaryAction ? (
              <Link
                href={primaryAction.href}
                className="group/btn inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-[#1200c5] transition-colors duration-300 ease-out hover:bg-white/90 active:bg-white/80"
              >
                {primaryAction.label}
                <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover/btn:translate-x-0.5" />
              </Link>
            ) : null}
            {secondaryAction ? (
              <Link
                href={secondaryAction.href}
                className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                {secondaryAction.label}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <section className={cn("site-section-lg relative", className)}>
      <div className="site-shell">
        {blockHref ? (
          <Link
            href={blockHref}
            className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {content}
          </Link>
        ) : (
          content
        )}
      </div>
    </section>
  );
}
