// Shared brand-logo renderer: paints an SVG logo via CSS mask so it inherits a
// single color (theme-aware when color="fg"). Used for monochrome "built-on"
// strips and brand-colored ecosystem grids alike.
export function MaskLogo({
  src,
  color = "fg",
  alt,
  className = "",
}: {
  src: string;
  color?: string;
  alt: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={alt}
      className={className}
      style={{
        backgroundColor: color === "fg" ? "var(--color-foreground)" : color,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}
