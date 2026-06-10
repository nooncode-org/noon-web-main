// Eyebrow — the hairline meta-label that opens a section (dash + mono label).
// Single source for the treatment; sections were hand-rolling identical copies
// of this span, which drifted apart one tweak at a time. Server-safe (no hooks).
export function Eyebrow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`site-meta-label inline-flex items-center gap-3 font-mono text-muted-foreground ${className}`}
    >
      <span className="h-px w-8 bg-foreground/30" />
      {children}
    </span>
  );
}
