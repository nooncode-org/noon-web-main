/**
 * lib/maxwell/style-packs.ts
 *
 * Bloque 11 — Maxwell Quality Layer.
 *
 * Catalogue of 24 visual style families with 3 manually-curated reference URLs
 * each (72 references total). The classifier picks one pack per studio
 * session; the brief builder then injects the references into the v0 prompt
 * so the generated prototype has explicit aesthetic direction.
 *
 * Source of truth for the URL list: docs/maxwell/quality-layer.md (handoff
 * doc from PM) + the original `maxwell-style-packs.md` catalogue. Each URL
 * was approved manually after `web_fetch`-verification — DO NOT add new ones
 * without that same vetting (the goal is "design references", not "any tech
 * site").
 *
 * Why TypeScript constant and not a DB table:
 *   - 72 rows × 3 columns is small enough to ship in-bundle.
 *   - Editing requires PR review (visual-direction debates), not an ops
 *     migration.
 *   - `getStylePackById()` is sync — no DB call on every prototype build.
 *
 * Pack IDs are kebab-case so they match the `style_pack_id TEXT` column in
 * `studio_session` (migration 20260517_014).
 */

export type StyleReference = {
  /** Bare URL — no protocol prefix needed; we add `https://` lazily if v0 ever requires it. */
  url: string;
  /** Optional one-line hint shown to v0 next to the URL. Helps anchor what to look at. */
  v0Hint?: string;
};

export type StylePack = {
  /** Kebab-case id stored in DB. Stable across catalogue edits. */
  id: string;
  /** Human-readable name (also injected into the prompt). */
  name: string;
  /** Short prose description of the aesthetic feel — used in the prompt's "Feel:" line. */
  feel: string;
  /** Exactly 3 references. The classifier expects this shape; tests guard the cardinality. */
  refs: [StyleReference, StyleReference, StyleReference];
};

export const STYLE_PACKS: readonly StylePack[] = [
  {
    id: "warm-artisanal",
    name: "Warm & Artisanal",
    feel: "Bakery / vineyard / artisanal warmth with editorial typography.",
    refs: [
      { url: "poilane.com", v0Hint: "Bakery editorial / claro / tipográfico" },
      { url: "fabriquebakery.com", v0Hint: "Escandinavo / video hero" },
      { url: "darioush.com", v0Hint: "Winery neoclásico persa" },
    ],
  },
  {
    id: "premium-experiential",
    name: "Premium & Experiential",
    feel: "Luxury hospitality / fine dining / icon jewelry — ultra-minimal and considered.",
    refs: [
      { url: "aman.com", v0Hint: "Hotel/resort ultra-minimal" },
      { url: "noma.dk", v0Hint: "Fine dining / poético escandinavo" },
      { url: "tiffany.com", v0Hint: "Joyería / luxury brand" },
    ],
  },
  {
    id: "clean-professional",
    name: "Clean & Professional",
    feel: "Architecture / design / consultancy with B&W minimal identity.",
    refs: [
      { url: "snohetta.com", v0Hint: "Arquitectura / B&W minimal" },
      { url: "lippincott.com", v0Hint: "Brand consultancy / light clean" },
      { url: "pentagram.com", v0Hint: "Design partnership / ultra minimal" },
    ],
  },
  {
    id: "trust-care",
    name: "Trust & Care",
    feel: "Functional medicine / digital pharmacy / mental wellness — calming and reassuring.",
    refs: [
      { url: "parsleyhealth.com", v0Hint: "Medicina funcional moderna" },
      { url: "alto.com", v0Hint: "Farmacia digital / Framer" },
      { url: "headspace.com", v0Hint: "Salud mental / wellness" },
    ],
  },
  {
    id: "mind-wellness",
    name: "Mind & Wellness",
    feel: "Personal development / editorial lifestyle / mindful movement.",
    refs: [
      { url: "mindvalley.com", v0Hint: "Personal development / coaching" },
      { url: "mindbodygreen.com", v0Hint: "Wellness editorial / lifestyle" },
      { url: "theclass.com", v0Hint: "Somatic / mindful movement" },
    ],
  },
  {
    id: "energy-performance",
    name: "Energy & Performance",
    feel: "Luxury gym / performance wearables / boutique HIIT — bold and athletic.",
    refs: [
      { url: "equinox.com", v0Hint: "Luxury gym" },
      { url: "whoop.com", v0Hint: "Performance tech / athlete tracking" },
      { url: "barrys.com", v0Hint: "Boutique HIIT" },
    ],
  },
  {
    id: "beauty-lifestyle",
    name: "Beauty & Lifestyle",
    feel: "Beauty editorial / skincare studio / salon + DTC.",
    refs: [
      { url: "glossier.com", v0Hint: "Beauty brand editorial / pink minimal" },
      { url: "heydayskincare.com", v0Hint: "Skincare studio / booking-first" },
      { url: "madison-reed.com", v0Hint: "Hair salon + DTC / dual model" },
    ],
  },
  {
    id: "education-community",
    name: "Education & Community",
    feel: "Premium learning platforms — from masterclass to gamified consumer.",
    refs: [
      { url: "masterclass.com", v0Hint: "Premium / dark editorial" },
      { url: "maven.com", v0Hint: "Profesional / live cohorts" },
      { url: "duolingo.com", v0Hint: "Consumer / gamificado / accesible" },
    ],
  },
  {
    id: "tech-digital",
    name: "Tech & Digital",
    feel: "SaaS infrastructure / developer tools / deploy — gold-standard craft.",
    refs: [
      { url: "stripe.com", v0Hint: "Fintech infra / gradient icónico" },
      { url: "linear.app", v0Hint: "Dev tool / dark ultra-minimal / AI era" },
      { url: "vercel.com", v0Hint: "Deploy infra / developer-first / tier-1 craft" },
    ],
  },
  {
    id: "commerce-retail",
    name: "Commerce & Retail",
    feel: "E-commerce DTC lifestyle / travel accessories / sustainable fashion.",
    refs: [
      { url: "mejuri.com", v0Hint: "Joyería fina DTC / everyday / video hero" },
      { url: "awaytravel.com", v0Hint: "Travel accessories / lifestyle premium" },
      { url: "everlane.com", v0Hint: "Moda sostenible / editorial / minimal" },
    ],
  },
  {
    id: "hospitality-travel",
    name: "Hospitality & Travel",
    feel: "Global marketplace / bespoke agency / boutique hotels.",
    refs: [
      { url: "airbnb.com", v0Hint: "Marketplace global / search-first" },
      { url: "blacktomato.com", v0Hint: "Agencia bespoke / editorial" },
      { url: "designhotels.com", v0Hint: "Hoteles de autor / booking + magazine" },
    ],
  },
  {
    id: "events-celebrations",
    name: "Events & Celebrations",
    feel: "Weddings all-in-one / premium invitations / Gen Z events.",
    refs: [
      { url: "zola.com", v0Hint: "Wedding all-in-one / planning-first" },
      { url: "paperlesspost.com", v0Hint: "Invitaciones premium / design-forward" },
      { url: "partiful.com", v0Hint: "Events Gen Z / visual-first / Framer" },
    ],
  },
  {
    id: "local-services",
    name: "Local Services",
    feel: "Gig economy / pro matching / property management.",
    refs: [
      { url: "taskrabbit.com", v0Hint: "Marketplace gig-economy / booking inmediato" },
      { url: "thumbtack.com", v0Hint: "Match con pros locales" },
      { url: "tidy.com", v0Hint: "AI + humans / property management moderno" },
    ],
  },
  {
    id: "real-estate",
    name: "Real Estate",
    feel: "Premium brokerage / leading marketplace / digital proptech.",
    refs: [
      { url: "compass.com", v0Hint: "Premium brokerage / editorial" },
      { url: "zillow.com", v0Hint: "Marketplace líder / search-first" },
      { url: "opendoor.com", v0Hint: "iBuyer proptech / sell-first" },
    ],
  },
  {
    id: "automotive",
    name: "Automotive",
    feel: "EV manufacturer / adventure EV / automotive e-commerce.",
    refs: [
      { url: "tesla.com", v0Hint: "EV manufacturer / dark minimal" },
      { url: "rivian.com", v0Hint: "Adventure EV / storytelling" },
      { url: "carvana.com", v0Hint: "E-commerce automotriz / 360°" },
    ],
  },
  {
    id: "entertainment-media",
    name: "Entertainment & Media",
    feel: "Music streaming / curated cinema / independent media.",
    refs: [
      { url: "spotify.com", v0Hint: "Streaming musical / dark verde / immersive" },
      { url: "mubi.com", v0Hint: "Cine curado / editorial" },
      { url: "substack.com", v0Hint: "Media independiente / writer-first" },
    ],
  },
  {
    id: "creative-design-services",
    name: "Creative & Design Services",
    feel: "World-class design agencies / identity / motion / WebGL.",
    refs: [
      { url: "studiodumbar.com", v0Hint: "Identity / motion / sound" },
      { url: "obys.agency", v0Hint: "Concept-driven / tipográfico / modernista" },
      { url: "dogstudio.co", v0Hint: "Art + design + tech / WebGL inmersivo" },
    ],
  },
  {
    id: "sustainability-environment",
    name: "Sustainability & Environment",
    feel: "Activist brand / climatetech B2B / eco-friendly retail.",
    refs: [
      { url: "patagonia.com", v0Hint: "Marca activista / editorial" },
      { url: "watershed.com", v0Hint: "Sustainability AI platform / B2B" },
      { url: "allbirds.com", v0Hint: "Retail eco-friendly / B Corp" },
    ],
  },
  {
    id: "logistics-transport",
    name: "Logistics & Transport",
    feel: "Supply-chain tech / multi-carrier SaaS / urban mobility.",
    refs: [
      { url: "flexport.com", v0Hint: "Supply chain tech / AI" },
      { url: "goshippo.com", v0Hint: "Multi-carrier shipping SaaS / clean" },
      { url: "uber.com", v0Hint: "Movilidad urbana / B&W minimal" },
    ],
  },
  {
    id: "industrial-manufacturing",
    name: "Industrial & Manufacturing",
    feel: "Defense tech / industrial 3D printing / aerospace manufacturing.",
    refs: [
      { url: "anduril.com", v0Hint: "Defense tech / dark cinematic" },
      { url: "formlabs.com", v0Hint: "3D printing industrial / product-forward" },
      { url: "spacex.com", v0Hint: "Aerospace manufacturing / dark B&W / full-bleed" },
    ],
  },
  {
    id: "finance-fintech",
    name: "Finance & Fintech",
    feel: "Consumer investing / international payments / crypto exchange.",
    refs: [
      { url: "robinhood.com", v0Hint: "Investing consumer / dark bold" },
      { url: "wise.com", v0Hint: "Pagos internacionales / bright green / transparency" },
      { url: "coinbase.com", v0Hint: "Cripto exchange / blue clean" },
    ],
  },
  {
    id: "government-public",
    name: "Government & Public",
    feel: "Ideas media / free public education / investigative journalism.",
    refs: [
      { url: "ted.com", v0Hint: "Nonprofit ideas / editorial rojo" },
      { url: "khanacademy.org", v0Hint: "Educación pública libre / joyful" },
      { url: "propublica.org", v0Hint: "Periodismo de investigación / bold editorial" },
    ],
  },
  {
    id: "pets-animals",
    name: "Pets & Animals",
    feel: "Leading pet e-commerce / tech-forward vet clinic / DTC subscription.",
    refs: [
      { url: "chewy.com", v0Hint: "E-commerce líder de mascotas / search-first" },
      { url: "modernanimal.com", v0Hint: "Vet clinic tech-forward / video hero" },
      { url: "bark.co", v0Hint: "DTC subscription / playful / cultura pop" },
    ],
  },
  {
    id: "art-culture",
    name: "Art & Culture",
    feel: "Contemporary global gallery / auction house / art media.",
    refs: [
      { url: "hauserwirth.com", v0Hint: "Galería global contemporánea / imagen-first" },
      { url: "sothebys.com", v0Hint: "Casa de subastas / luxury editorial" },
      { url: "frieze.com", v0Hint: "Art media + fairs / Pentagram rebrand" },
    ],
  },
];

/** Look up by id. Returns undefined on miss so callers can apply a default. */
export function getStylePackById(id: string): StylePack | undefined {
  return STYLE_PACKS.find((p) => p.id === id);
}

/**
 * Look up by name (case-insensitive). Useful when the classifier returns a
 * human-readable name instead of an id — keeps the LLM contract loose.
 */
export function getStylePackByName(name: string): StylePack | undefined {
  const needle = name.trim().toLowerCase();
  return STYLE_PACKS.find((p) => p.name.toLowerCase() === needle);
}
