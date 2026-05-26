interface NoonLogoProps {
  variant?: "wordmark" | "icon" | "lockup";
  className?: string;
  height?: number;
}

// The logo is above-the-fold on every public surface (header, signin, landing).
// next/image's default lazy-load + intersection observer wrapper would hurt
// LCP for an asset that is always visible immediately. Static PNG with
// explicit width/height + zero JS overhead is the intentional choice.
// The picture+source variant for the wordmark also needs raw <img> to drive
// the dark-mode srcSet swap without a custom Image loader.

function LogoIcon({ height, className }: { height: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo-icon.png" alt="" height={height} width={height} className={className} />
  );
}

function LogoWordmark({ height, className }: { height: number; className?: string }) {
  const width = Math.round(height * (6163 / 1441));
  return (
    <picture>
      <source srcSet="/logo-wordmark-dark.png" media="(prefers-color-scheme: dark)" />
      <img src="/logo-wordmark.png" alt="Noon" height={height} width={width} className={className} />
    </picture>
  );
}

export function NoonLogo({ variant = "lockup", className = "", height = 32 }: NoonLogoProps) {
  if (variant === "icon") {
    return <LogoIcon height={height} className={className} />;
  }

  if (variant === "wordmark") {
    return <LogoWordmark height={height} className={className} />;
  }

  // lockup: icon + wordmark side by side
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoIcon height={height} />
      <LogoWordmark height={height} />
    </span>
  );
}
