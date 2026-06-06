interface NoonLogoProps {
  variant?: "wordmark" | "icon" | "lockup";
  className?: string;
  height?: number;
}

// The logo is above-the-fold on every public surface (header, signin, landing),
// so both variants avoid next/image's lazy-load wrapper to protect LCP.
// - Wordmark: inline SVG with fill=currentColor — one official vector that
//   adapts to light/dark automatically (no PNG srcSet swap), stays crisp at any
//   size, and costs zero network requests since it ships inline in the HTML.
// - Icon: static PNG with explicit width/height (no vector source yet).

function LogoIcon({ height, className }: { height: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo-icon.png" alt="" height={height} width={height} className={className} />
  );
}

function LogoWordmark({ height, className }: { height: number; className?: string }) {
  const width = Math.round(height * (657 / 153.39));
  return (
    <svg
      role="img"
      aria-label="Noon"
      viewBox="0 0 657 153.39"
      height={height}
      width={width}
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M281.68,28.4c0-15.2-12.28-27.77-27.77-27.77h-56.41c-15.49,0-27.77,12.57-27.77,27.77V123.4h30.11V28.4h81.84Z" />
      <path d="M281.68,123.4h-81.84c0,15.2,12.28,27.48,27.48,27.48h57c15.2,0,27.48-12.28,27.48-27.48V28.4h-30.11V123.4Z" />
      <path d="M458.82,28.4c0-15.2-12.28-27.77-27.77-27.77h-56.41c-15.49,0-27.77,12.57-27.77,27.77V123.4h30.11V28.4h81.84Z" />
      <path d="M458.82,123.4h-81.84c0,15.2,12.28,27.48,27.48,27.48h57c15.2,0,27.48-12.28,27.48-27.48V28.4h-30.11V123.4Z" />
      <path d="M629.52,.63h-47.65c-15.2,0-27.48,12.57-27.48,27.77h72.49v122.48h30.11V28.4c0-15.2-12.28-27.77-27.48-27.77Z" />
      <rect x="524" y="28.4" width="30.4" height="122.48" />
      <path d="M247.4,69.95V35.56h-13.5v34.4c-1.72,.15-3.07,1.57-3.07,3.32v12.94c0,1.85,1.5,3.35,3.35,3.35h12.94c1.85,0,3.35-1.5,3.35-3.35v-12.94c0-1.75-1.35-3.18-3.07-3.32Z" />
      <rect y="26.31" width="31.04" height="125.04" />
      <path d="M106.77,0H58.13c-15.52,0-28.05,12.83-28.05,28.35H104.08v125.04h30.74V28.35c0-15.52-12.53-28.35-28.05-28.35Z" />
    </svg>
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
