import { useTranslations } from "next-intl";
import Link from "next/link";
import type { UpgradeSession, UpgradeSessionStatus } from "@/lib/upgrade/types";

type Props = {
  sessions: UpgradeSession[];
};

const STATUS_LABEL: Record<UpgradeSessionStatus, string> = {
  pending: "Pending",
  crawling: "Scanning…",
  crawl_done: "Awaiting answers",
  analyzing: "Analyzing…",
  audit_ready: "Audit ready",
  generating: "Generating…",
  version_ready: "Version ready",
  transferred: "In Maxwell",
  proposal_sent: "Proposal sent",
  archived: "Archived",
  error: "Error",
};

const STATUS_DOT: Record<UpgradeSessionStatus, string> = {
  pending: "bg-muted-foreground",
  crawling: "bg-blue-500 animate-pulse",
  crawl_done: "bg-yellow-500",
  analyzing: "bg-blue-500 animate-pulse",
  audit_ready: "bg-green-500",
  generating: "bg-blue-500 animate-pulse",
  version_ready: "bg-green-600",
  transferred: "bg-purple-500",
  proposal_sent: "bg-purple-500",
  archived: "bg-muted-foreground/50",
  error: "bg-destructive",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function UpgradeSessionList({ sessions }: Props) {
  const t = useTranslations("upgradeTool");
  const visible = sessions.filter((s) => s.status !== "archived");
  if (visible.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="text-sm font-medium text-muted-foreground mb-3">{t("previousAudits")}</h2>
      <ul className="space-y-2">
        {visible.map((s) => (
          <li key={s.id}>
            <Link
              href={`/upgrade/${s.id}`}
              className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3 hover:bg-muted/50 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[s.status as UpgradeSessionStatus] ?? "bg-muted-foreground"}`}
                />
                <span className="text-sm text-foreground truncate group-hover:text-foreground">
                  {s.websiteUrlRaw}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                <span>{STATUS_LABEL[s.status as UpgradeSessionStatus] ?? s.status}</span>
                <span className="hidden sm:inline">{formatDate(s.lastActivityAt)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
