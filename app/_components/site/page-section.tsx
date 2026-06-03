import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageSectionProps = {
  id?: string;
  eyebrow?: string;
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
  align?: "left" | "center";
  children: ReactNode;
};

export function PageSection({
  id,
  eyebrow,
  title,
  description,
  className,
  align = "left",
  children,
}: PageSectionProps) {
  const centered = align === "center";
  return (
    <section id={id} className={cn("site-section relative", className)}>
      <div className="site-shell">
        {(eyebrow || title || description) && (
          <div className={cn("mb-8 lg:mb-10", centered ? "mx-auto max-w-2xl text-center" : "max-w-3xl")}>
            {eyebrow && (
              <span className={cn("site-meta-label mb-4 inline-flex items-center gap-3 font-mono text-muted-foreground", centered && "justify-center")}>
                {centered ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : <span className="h-px w-8 bg-foreground/30" />}
                {eyebrow}
              </span>
            )}
            {title && <h2 className="site-section-title mb-4">{title}</h2>}
            {description && (
              <p className="site-section-copy text-muted-foreground">{description}</p>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
