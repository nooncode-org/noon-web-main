/**
 * lib/maxwell/proposal-rules.ts
 *
 * Reglas comerciales vigentes de Noon para propuestas generadas por Maxwell.
 * Esta es la fuente de verdad: el prompt de propuesta las refleja y esta capa
 * las valida programaticamente.
 *
 * DECISIONES CERRADAS:
 * - Pago unico y Membresia son las dos modalidades principales visibles.
 * - Pago flexible es la opcion secundaria visible y siempre requiere agente.
 * - Toda propuesta pasa por revision humana antes de llegar al cliente.
 * - No se activa workspace sin pago confirmado.
 * - "Payment under verification" no activa el proyecto.
 * - Cambios sobre propuesta enviada crean nueva version; no se edita encima.
 * - Vigencia de la propuesta: 15 dias desde la primera apertura real del enlace.
 * - Precio exacto en la propuesta; no usar rangos tipo "desde".
 * - Membresia incluye: hosting, base de datos basica, soporte, actualizaciones
 *   menores y avance gradual del proyecto.
 */

import type { StudioSession, StudioVersion } from "./repositories";

// ============================================================================
// Modalidades de pago
// ============================================================================

export const PAYMENT_MODALITIES = {
  /** Modalidad principal 1: pago unico de activacion. */
  SINGLE_PAYMENT: "single_payment",
  /** Modalidad principal 2: fee de activacion + mensualidad. */
  MEMBERSHIP: "membership",
} as const;

export type PaymentModality = (typeof PAYMENT_MODALITIES)[keyof typeof PAYMENT_MODALITIES];

// ============================================================================
// Categorias de proyecto
// ============================================================================

export const PROJECT_CATEGORIES = {
  landing: "Web básica / Landing / Corporate",
  ecommerce: "E-commerce",
  webapp: "Web App / Sistema",
  mobile: "Mobile",
  saas_ai: "SaaS / AI / Automation",
} as const;

export type ProjectCategory = keyof typeof PROJECT_CATEGORIES;

// ============================================================================
// Tiers de complejidad
// ============================================================================

export const COMPLEXITY_TIERS = {
  bajo: "Bajo",
  medio: "Medio",
  alto: "Alto",
} as const;

export type ComplexityTier = keyof typeof COMPLEXITY_TIERS;

// ============================================================================
// Tabla de precios oficial - 5 categorias x 3 tiers
// Precios exactos en USD. No usar rangos.
//
// activation -> fee unico para arrancar el proyecto
// monthly    -> cuota mensual de membresia
// ============================================================================

export const PRICING_TABLE: Record<
  ProjectCategory,
  Record<ComplexityTier, { activation: number; monthly: number }>
> = {
  landing: {
    bajo: { activation: 49, monthly: 25 },
    medio: { activation: 79, monthly: 32 },
    alto: { activation: 129, monthly: 49 },
  },
  ecommerce: {
    bajo: { activation: 79, monthly: 39 },
    medio: { activation: 129, monthly: 55 },
    alto: { activation: 199, monthly: 79 },
  },
  webapp: {
    bajo: { activation: 99, monthly: 49 },
    medio: { activation: 179, monthly: 69 },
    alto: { activation: 279, monthly: 109 },
  },
  mobile: {
    bajo: { activation: 129, monthly: 49 },
    medio: { activation: 199, monthly: 69 },
    alto: { activation: 299, monthly: 109 },
  },
  saas_ai: {
    bajo: { activation: 129, monthly: 69 },
    medio: { activation: 229, monthly: 99 },
    alto: { activation: 349, monthly: 149 },
  },
};

export type ProposalCommercialProfile = {
  category: ProjectCategory;
  tier: ComplexityTier;
  pricing: { activation: string; monthly: string };
  /** Raw recurring monthly (USD) for the membership modality — the numeric
   *  counterpart of `pricing.monthly`. Persisted at checkout when the client
   *  picks membership (M0); never charged automatically yet. */
  monthlyAmountUsd: number;
  membershipRecommended: boolean;
};

// ============================================================================
// Casos donde NO se ofrece Membresia automaticamente
// ============================================================================

const MEMBERSHIP_EXCLUDED_PATTERNS: RegExp[] = [
  /\bmarketplace\b/i,
  /\bmulti[\s-]?vendor\b/i,
  /\blegacy\b/i,
  /\boffline[\s-]?sync\b/i,
  /\boffline\b.*\bsync\b/i,
  /\bHIPAA\b/i,
  /\bGDPR\b.*\bregulat/i,
  /\bregulat.*\bcomplian/i,
  /\bcomplian.*\bregulat/i,
  /\bmigraci(?:on|\u00f3n)\s+(masiva|pesada|de\s+datos)\b/i,
  /\bdata\s+migration\b/i,
  /\bheavy\s+migration\b/i,
  /\bblockchain\b/i,
  /\bcrypto\b/i,
  /\bweb3\b/i,
  /\bsmart\s+contract\b/i,
  /\bgame\s+dev/i,
  /\bgaming\b/i,
  /\bjuego\b/i,
];

export function isMembershipContraindicated(text: string | null): boolean {
  if (!text) return false;
  return MEMBERSHIP_EXCLUDED_PATTERNS.some((re) => re.test(text));
}

// ============================================================================
// Resolvers - categoria y tier desde hints de la sesion
// ============================================================================

export function resolveProjectCategory(hint: string | null): ProjectCategory {
  if (!hint) return "webapp";
  const h = hint.toLowerCase();

  if (
    h.includes("mobile") ||
    h.includes("móvil") ||
    h.includes("movil") ||
    h.includes("ios") ||
    h.includes("android") ||
    h.includes("app móvil") ||
    h.includes("app movil")
  ) {
    return "mobile";
  }

  if (
    /\b(ai|ia|saas|llm|nlp|chatbot|gpt|bot)\b/i.test(hint) ||
    h.includes("intelig") ||
    h.includes("automat") ||
    h.includes("machine learn")
  ) {
    return "saas_ai";
  }

  if (
    h.includes("ecommerce") ||
    h.includes("e-commerce") ||
    h.includes("tienda") ||
    h.includes("shop") ||
    h.includes("store") ||
    h.includes("ventas online") ||
    h.includes("carrito") ||
    h.includes("checkout") ||
    h.includes("marketplace")
  ) {
    return "ecommerce";
  }

  if (
    (h.includes("landing") ||
      h.includes("corporate") ||
      h.includes("brochure") ||
      h.includes("portafolio") ||
      h.includes("portfolio") ||
      h.includes("blog") ||
      h.includes("sitio web") ||
      h.includes("website") ||
      h.includes("presentaci")) &&
    !h.includes("app") &&
    !h.includes("sistema") &&
    !h.includes("plataforma")
  ) {
    return "landing";
  }

  return "webapp";
}

export function resolveComplexityTier(hint: string | null): ComplexityTier {
  if (!hint) return "medio";
  const h = hint.toLowerCase();

  if (
    h.includes("alto") ||
    h.includes("high") ||
    h.includes("enterprise") ||
    h.includes("platform") ||
    h.includes("complex") ||
    h.includes("advanced") ||
    h.includes("avanzado") ||
    h.includes("large") ||
    h.includes("grande")
  ) {
    return "alto";
  }

  if (
    h.includes("bajo") ||
    h.includes("low") ||
    h.includes("simple") ||
    h.includes("basic") ||
    h.includes("small") ||
    h.includes("pequeño") ||
    h.includes("básico") ||
    h.includes("sencillo") ||
    h.includes("starter")
  ) {
    return "bajo";
  }

  return "medio";
}

export function formatPricing(
  category: ProjectCategory,
  tier: ComplexityTier
): { activation: string; monthly: string } {
  const row = PRICING_TABLE[category][tier];
  return {
    activation: `$${row.activation} USD`,
    monthly: `$${row.monthly} USD/mes`,
  };
}

export function resolveProposalCommercialProfile(
  session: Pick<StudioSession, "projectType" | "goalSummary" | "complexityHint" | "initialPrompt">
): ProposalCommercialProfile {
  const category = resolveProjectCategory(session.projectType ?? session.goalSummary);
  const tier = resolveComplexityTier(session.complexityHint);
  const pricing = formatPricing(category, tier);
  const membershipRecommended = !isMembershipContraindicated(
    [session.initialPrompt, session.goalSummary, session.projectType].filter(Boolean).join(" ")
  );

  return {
    category,
    tier,
    pricing,
    monthlyAmountUsd: PRICING_TABLE[category][tier].monthly,
    membershipRecommended,
  };
}

// ============================================================================
// Validacion de propuesta generada
// ============================================================================

export const PROPOSAL_FORBIDDEN_PATTERNS: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /\b(\d+)\s*%\s*(off|discount|descuento)\b/i,
    reason: "Descuento porcentual - no hay descuentos por defecto",
  },
  {
    pattern: /\bphase[\s-]?(1|2|3|one|two|three)\s+payment\b/i,
    reason: "Pago por fases como opcion principal",
  },
  {
    pattern: /\bpago\s+por\s+fase(s)?\b/i,
    reason: "Pago por fases como opcion principal",
  },
  {
    pattern: /\bpago\s+por\s+etapas\b/i,
    reason: "Usar 'Pago flexible' en vez de 'pago por etapas' como opcion secundaria",
  },
  {
    pattern: /\binstallment(s)?\b/i,
    reason: "Plan de pagos en cuotas mencionado como opcion principal",
  },
  {
    pattern: /\bstaged\s+payment(s)?\b/i,
    reason: "Usar 'Pago flexible' en vez de 'staged payments' como opcion secundaria",
  },
  {
    pattern: /\b(repository|repo|github|gitlab|código)\s+(access|acceso|delivery|entrega)\b/i,
    reason: "Entrega tecnica implicita antes del pago",
  },
  {
    pattern: /\bdesde\s+\$\d/i,
    reason: "Rango 'desde $X' - la propuesta debe mostrar precio exacto",
  },
  {
    pattern: /\$\d[\d,]*\s*[–\-]\s*\$\d/,
    reason: "Rango de precio - la propuesta debe mostrar precio exacto",
  },
];

export type ProposalDraftValidationOptions = {
  membershipRecommended?: boolean;
  requireFlexibleOption?: boolean;
};

export function validateProposalDraft(
  content: string,
  options: ProposalDraftValidationOptions = {}
): string[] {
  const warnings = PROPOSAL_FORBIDDEN_PATTERNS
    .filter(({ pattern }) => pattern.test(content))
    .map(({ reason }) => `[REVIEW FLAG] ${reason}`);

  if (options.requireFlexibleOption !== false && !/\b(Pago flexible|Flexible payment)\b/i.test(content)) {
    warnings.push("[REVIEW FLAG] Falta la opcion secundaria visible de Pago flexible.");
  }

  if (options.membershipRecommended && !/\b(Membresia|Membres\u00eda|Membership)\b/i.test(content)) {
    warnings.push("[REVIEW FLAG] Falta la opcion principal de Membresia en la propuesta.");
  }

  return warnings;
}

// ============================================================================
// Construccion de contexto rico para el prompt de propuesta
// ============================================================================

export function buildProposalContext(
  session: StudioSession,
  messages: { role: "user" | "assistant"; content: string }[],
  versions: StudioVersion[]
): string {
  const commercialProfile = resolveProposalCommercialProfile(session);
  const { category, tier, pricing } = commercialProfile;
  const noMembership = !commercialProfile.membershipRecommended;

  const lines: string[] = [];

  lines.push("## Session context");
  lines.push(`- Initial request: "${session.initialPrompt}"`);
  if (session.goalSummary) lines.push(`- Goal summary: ${session.goalSummary}`);
  if (session.projectType) lines.push(`- Project type: ${session.projectType}`);
  if (session.complexityHint) lines.push(`- Complexity: ${session.complexityHint}`);
  lines.push(`- Category resolved: ${PROJECT_CATEGORIES[category]}`);
  lines.push(`- Tier resolved: ${COMPLEXITY_TIERS[tier]}`);
  lines.push(`- Language used: ${session.language}`);
  lines.push(`- Prototype versions generated: ${versions.length}`);
  lines.push(`- Corrections used: ${session.correctionsUsed} of ${session.maxCorrections}`);
  lines.push("");

  if (versions.length > 0) {
    lines.push("## Prototype iteration history");
    for (const version of versions) {
      const label = version.source === "initial"
        ? "Initial prototype"
        : `Correction (v${version.versionNumber})`;

      lines.push(
        version.changeSummary
          ? `- v${version.versionNumber} [${label}]: ${version.changeSummary}`
          : `- v${version.versionNumber} [${label}]`
      );
    }
    lines.push("");
  }

  lines.push("## Full conversation");
  for (const message of messages) {
    lines.push(`**${message.role === "user" ? "Client" : "Maxwell"}:** ${message.content}`);
  }
  lines.push("");

  lines.push("## Pricing for this proposal");
  lines.push(`Category: ${PROJECT_CATEGORIES[category]} | Tier: ${COMPLEXITY_TIERS[tier]}`);
  lines.push(`- Activation fee (Pago unico OR Membresia activation): ${pricing.activation}`);
  if (!noMembership) {
    lines.push(`- Membresia mensual: ${pricing.monthly}`);
    lines.push(
      `  Membership line: "Incluye hosting, base de datos basica, soporte, actualizaciones menores y avance gradual del proyecto."`
    );
    lines.push(`- Mark the recommended modality with label "Recomendado".`);
    lines.push(`- Investment section must visibly include: Pago unico, Membresia - Recomendado, and Pago flexible (opcion secundaria).`);
  } else {
    lines.push(`- NOTE: Membership is NOT recommended for this type of project. Offer Pago unico only.`);
  }
  lines.push(
    `- Secondary option wording: "Pago flexible" only. Never use "pago por fases", "pago por etapas", or "installments" as the visible label.`
  );
  lines.push(
    `- If staged execution needs to be mentioned, frame it as a secondary, agent-led path. Never make it the main or recommended option.`
  );
  lines.push("");

  lines.push("IMPORTANT:");
  lines.push(`- Show the EXACT price. Do NOT use ranges like "desde $X" or "$X - $Y".`);
  lines.push(`- Do NOT add any discount percentage for single payment.`);
  lines.push(`- Do NOT present phase-based or installment payments as a primary option.`);
  lines.push(`- Proposal validity: 15 days from first real link opening (not from send date).`);
  lines.push(
    `- The formal proposal is delivered by email after review. For normal cases, once approved, formal send usually happens in under 20 minutes.`
  );
  lines.push(`- Sent proposals are versioned. Do NOT describe editing an already sent proposal in place.`);
  lines.push(`- Project activates ONLY upon confirmed payment. "Under verification" does NOT activate the project.`);
  lines.push(
    `- If Pago flexible is mentioned, say that each agreed stage advances after the corresponding payment confirmation and unpaid future stages remain paused.`
  );
  lines.push(
    `- Describe the post-payment journey: Noon client workspace, approved proposal, approved prototype or available progress, Latest Update summary, materials, client comments, Noon agent contact, Project Manager handoff, Noon development team, QA, deployment, and formal delivery.`
  );
  lines.push(`- Official workspace states to mention: Active, In Preparation, In Development, In Review, Delivered.`);
  lines.push("");

  lines.push("## Your task");
  lines.push(
    "Generate the full formal proposal following the structure defined in your system prompt. " +
      "Use the conversation above to extract scope, deliverables, exclusions, and the correct commercial framing. " +
      "Use the EXACT pricing above for the Investment section - do not invent or adjust figures. " +
      `Write the proposal in ${session.language === "es" ? "Spanish" : "English"} unless the conversation clearly used a different language.`
  );

  return lines.join("\n");
}
