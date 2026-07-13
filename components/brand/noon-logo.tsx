// Noon brand marks, theme-adaptive via currentColor (black in light, white in
// dark — set the color on a parent). Source: owner SVGs (Recurso 16 = wordmark,
// Recurso 1 = isotipo), cleaned to single-color paths.

export function NoonWordmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 657 153.39"
      className={className}
      fill="currentColor"
      role="img"
      aria-label="noon"
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

export function NoonMark({
  className,
  height,
  width,
}: {
  className?: string;
  height?: number;
  width?: number;
}) {
  return (
    <svg
      viewBox="0 0 236.53 250.16"
      className={className}
      height={height}
      width={width}
      fill="currentColor"
      role="img"
      aria-label="Noon"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M186.4,46.24c0-25.31-20.44-46.24-46.24-46.24H46.24C20.44,0,0,20.93,0,46.24V204.41H50.13V46.24H186.4Z" />
      <path d="M186.4,204.41H50.13c0,25.31,20.44,45.75,45.75,45.75h94.91c25.31,0,45.75-20.44,45.75-45.75V46.24h-50.13V204.41Z" />
      <rect x="106.85" y="58.16" width="22.48" height="73.57" />
      <rect x="101.74" y="115.38" width="32.7" height="32.7" rx="3.35" ry="3.35" />
    </svg>
  );
}
