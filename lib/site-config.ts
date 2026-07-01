export const siteRoutes = {
  home: "/",
  maxwell: "/maxwell",
  maxwellStudio: "/maxwell/studio",
  upgrade: "/upgrade",
  services: "/services",
  work: "/work",
  opportunities: "/opportunities",
  templates: "/templates",
  about: "/about",
  contact: "/contact",
  privacyPolicy: "/privacy-policy",
  termsAndConditions: "/terms-and-conditions",
  cookiesPolicy: "/cookies-policy",
  legalNotice: "/legal-notice",
  howItWorksHref: "/services",
  homeTemplatesSection: "/#explore-what-you-can-build",
  servicesWhatWeBuild: "/services#what-we-build",
  aboutTechnologySection: "/about#technology",
  // Legacy routes kept for redirect references.
  solutions: "/solutions",
  capabilities: "/capabilities",
  whatWeBuild: "/what-we-build",
  technologyWeUse: "/technology-we-use",
  aboutNoon: "/about-noon",
} as const;

export type PrimaryNavigationItem = {
  name: string;
  href: string;
  match: string[];
};

export const primaryNavigation: PrimaryNavigationItem[] = [
  {
    name: "Services",
    href: siteRoutes.services,
    match: [siteRoutes.services, siteRoutes.upgrade],
  },
  {
    name: "About",
    href: siteRoutes.about,
    match: [siteRoutes.about],
  },
  {
    name: "Contact",
    href: siteRoutes.contact,
    match: [siteRoutes.contact],
  },
];

export type FooterLink = {
  name: string;
  href?: string;
};

export const footerLinkGroups: Record<string, FooterLink[]> = {
  Site: [
    { name: "Services", href: siteRoutes.services },
    { name: "Upgrade", href: siteRoutes.upgrade },
    { name: "Templates", href: siteRoutes.templates },
    { name: "Opportunities", href: siteRoutes.opportunities },
    { name: "About", href: siteRoutes.about },
    { name: "Contact", href: siteRoutes.contact },
  ],
  Legal: [
    { name: "Privacy Policy", href: siteRoutes.privacyPolicy },
    { name: "Terms and Conditions", href: siteRoutes.termsAndConditions },
    { name: "Cookies Policy", href: siteRoutes.cookiesPolicy },
    { name: "Legal Notice", href: siteRoutes.legalNotice },
  ],
};

export const footerSocialLinks: FooterLink[] = [
  { name: "TikTok", href: "https://www.tiktok.com/@nooncode.dev" },
  {
    name: "Facebook",
    href: "https://www.facebook.com/people/Noon-Development-Agency/61571938881520/",
  },
  { name: "Instagram", href: "https://www.instagram.com/nooncode.dev" },
];

function withSearchParams(path: string, params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const search = searchParams.toString();
  return search ? `${path}?${search}` : path;
}

type ContactHrefOptions =
  | string
  | {
      inquiry?: string;
      draft?: string;
      source?: string;
    };

export function getStartWithMaxwellHref(prompt?: string) {
  return withSearchParams(siteRoutes.maxwellStudio, { prompt });
}

/** Maxwell Studio without a prompt — hub for saved conversations (requires sign-in). */
export function getMaxwellStudioHubHref(): string {
  return siteRoutes.maxwellStudio;
}

export function getContactHref(options?: ContactHrefOptions) {
  if (typeof options === "string" || typeof options === "undefined") {
    return withSearchParams(siteRoutes.contact, { inquiry: options });
  }

  return withSearchParams(siteRoutes.contact, options);
}

export function getTemplateHref(slug: string) {
  return `${siteRoutes.templates}/${slug}`;
}
