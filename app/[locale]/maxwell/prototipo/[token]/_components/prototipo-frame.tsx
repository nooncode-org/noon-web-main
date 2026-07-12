/**
 * app/[locale]/maxwell/prototipo/[token]/_components/prototipo-frame.tsx
 *
 * Renders the prototipo artifact returned by the App signed-read endpoint.
 * Prefers the live `deployedUrl` (Vercel preview build). Falls back to the
 * `generatedHtml` srcdoc when the deploy is not available. Both render in a
 * sandboxed iframe so any script in the artifact runs in an isolated origin
 * and cannot reach NoonWeb cookies.
 *
 * Per the D-slice plan §10 risk 3: some v0-deployed artifacts may set CSP
 * `frame-ancestors` that blocks iframe embedding. The "Abrir en nueva pestaña"
 * fallback link is always rendered so the client can escape the iframe if it
 * appears blank.
 */

import { getTranslations } from "next-intl/server";

import type { PrototipoRenderData } from "@/lib/maxwell/prototipo-render-types";

type Props = {
  data: PrototipoRenderData;
};

export async function PrototipoFrame({ data }: Props) {
  const t = await getTranslations("prototipo.frame");
  const { prototype, workspace, leadContext } = data;
  const hasDeployedUrl = Boolean(prototype.deployedUrl);
  const hasGeneratedHtml = Boolean(prototype.generatedHtml);
  const iframeTitle = t("iframeTitle", {
    business: leadContext.businessName,
    version: workspace.version,
  });

  return (
    <section
      aria-label={t("previewAria")}
      className="rounded-2xl border border-border bg-card overflow-hidden"
    >
      <header className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.24em] text-muted-foreground">
            {t("version", { version: workspace.version })}
          </p>
          <h2 className="mt-1 text-sm font-medium text-foreground">
            {leadContext.businessName} — {leadContext.projectTypeLabel}
          </h2>
        </div>
        {hasDeployedUrl && (
          <a
            href={prototype.deployedUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("openInNewTab")}
          </a>
        )}
      </header>
      <div className="bg-background">
        {hasDeployedUrl ? (
          <iframe
            title={iframeTitle}
            src={prototype.deployedUrl ?? undefined}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            className="block h-[70vh] w-full border-0"
            loading="lazy"
          />
        ) : hasGeneratedHtml ? (
          <iframe
            title={iframeTitle}
            srcDoc={prototype.generatedHtml ?? undefined}
            sandbox="allow-scripts"
            className="block h-[70vh] w-full border-0"
            loading="lazy"
          />
        ) : (
          <div className="flex h-[40vh] items-center justify-center px-6 text-center text-sm text-muted-foreground">
            <p>{t("notReady")}</p>
          </div>
        )}
      </div>
    </section>
  );
}
