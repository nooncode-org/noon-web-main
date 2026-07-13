export type SiteTone = {
  accent: string;
  border: string;
  surface: string;
  mutedSurface: string;
  strongSurface: string;
  shadow: string;
  contrast: string;
};

type ToneOptions = {
  borderAlpha?: number;
  surfaceAlpha?: number;
  mutedSurfaceAlpha?: number;
  strongSurfaceAlpha?: number;
  shadowAlpha?: number;
  contrast?: string;
};

function createTone(
  accent: string,
  rgb: readonly [number, number, number],
  options: ToneOptions = {}
): SiteTone {
  const [red, green, blue] = rgb;
  const rgba = (alpha: number) => `rgba(${red}, ${green}, ${blue}, ${alpha})`;

  return {
    accent,
    border: rgba(options.borderAlpha ?? 0.28),
    surface: rgba(options.surfaceAlpha ?? 0.12),
    mutedSurface: rgba(options.mutedSurfaceAlpha ?? 0.08),
    strongSurface: rgba(options.strongSurfaceAlpha ?? 0.18),
    shadow: rgba(options.shadowAlpha ?? 0.24),
    contrast: options.contrast ?? "#ffffff",
  };
}

export const siteTones = {
  brand: createTone("#0056fd", [0, 86, 253], {
    borderAlpha: 0.34,
    surfaceAlpha: 0.14,
    mutedSurfaceAlpha: 0.08,
    strongSurfaceAlpha: 0.22,
    shadowAlpha: 0.28,
  }),
  brandStructural: createTone("#3347ef", [51, 71, 239], {
    borderAlpha: 0.32,
    surfaceAlpha: 0.14,
    mutedSurfaceAlpha: 0.08,
    strongSurfaceAlpha: 0.2,
    shadowAlpha: 0.26,
  }),
  brandLifted: createTone("#6a63f2", [106, 99, 242], {
    borderAlpha: 0.3,
    surfaceAlpha: 0.14,
    mutedSurfaceAlpha: 0.08,
    strongSurfaceAlpha: 0.2,
    shadowAlpha: 0.26,
  }),
  brandDeep: createTone("var(--foreground)", [128, 128, 128], {
    borderAlpha: 0.22,
    surfaceAlpha: 0.1,
    mutedSurfaceAlpha: 0.06,
    strongSurfaceAlpha: 0.16,
    shadowAlpha: 0.2,
    contrast: "var(--background)",
  }),
  client: createTone("#6b8cff", [107, 140, 255], {
    borderAlpha: 0.32,
    surfaceAlpha: 0.15,
    mutedSurfaceAlpha: 0.1,
    strongSurfaceAlpha: 0.22,
    shadowAlpha: 0.26,
  }),
  gateway: createTone("#2cc49a", [44, 196, 154], {
    borderAlpha: 0.32,
    surfaceAlpha: 0.15,
    mutedSurfaceAlpha: 0.1,
    strongSurfaceAlpha: 0.22,
    shadowAlpha: 0.26,
  }),
  services: createTone("#f0a127", [240, 161, 39], {
    borderAlpha: 0.32,
    surfaceAlpha: 0.15,
    mutedSurfaceAlpha: 0.1,
    strongSurfaceAlpha: 0.22,
    shadowAlpha: 0.26,
  }),
  data: createTone("#b277ff", [178, 119, 255], {
    borderAlpha: 0.32,
    surfaceAlpha: 0.16,
    mutedSurfaceAlpha: 0.1,
    strongSurfaceAlpha: 0.23,
    shadowAlpha: 0.27,
  }),
} as const;

export const siteStatusTones = {
  success: siteTones.gateway,
  availability: siteTones.brandStructural,
  focus: siteTones.brand,
} as const;

export const siteChromeDots = {
  red: "#ff6f6a",
  amber: "#f1b53d",
  green: "#35c983",
} as const;

