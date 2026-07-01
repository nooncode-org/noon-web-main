import { z } from "zod";

export const contactInbox = "noon.message@gmail.com";

export const contactInquiryDetails = {
  general: {
    label: "General question",
    subject: "General question",
  },
  "new-project": {
    label: "Project request",
    subject: "Project request",
  },
  seller: {
    label: "Seller application",
    subject: "Seller application",
  },
  developer: {
    label: "Developer application",
    subject: "Developer application",
  },
  investor: {
    label: "Investor or next product interest",
    subject: "Investor interest",
  },
  "next-product": {
    label: "Investor or next product interest",
    subject: "Next product interest",
  },
  solutions: {
    label: "Solutions inquiry",
    subject: "Solutions inquiry",
  },
  capabilities: {
    label: "Capabilities inquiry",
    subject: "Capabilities inquiry",
  },
  "what-we-build": {
    label: "What we build inquiry",
    subject: "What we build inquiry",
  },
  technology: {
    label: "Technology inquiry",
    subject: "Technology inquiry",
  },
  templates: {
    label: "Templates inquiry",
    subject: "Templates inquiry",
  },
  about: {
    label: "Company inquiry",
    subject: "Company inquiry",
  },
  legal: {
    label: "Legal inquiry",
    subject: "Legal inquiry",
  },
} as const;

export type ContactInquiryKey = keyof typeof contactInquiryDetails;

export const contactTypeOptions = ["new-project", "general", "partnership"] as const;
export type ContactTypeOption = (typeof contactTypeOptions)[number];

export const contactTypeLabels: Record<ContactTypeOption, string> = {
  "new-project": "Project request",
  general: "General question",
  partnership: "Partnership or collaboration",
};

export const contactTypeToInquiryMap: Record<ContactTypeOption, readonly ContactInquiryKey[]> = {
  "new-project": [
    "solutions",
    "capabilities",
    "what-we-build",
    "technology",
    "templates",
    "new-project",
  ],
  general: ["general", "about", "legal"],
  partnership: ["seller", "developer", "investor", "next-product"],
};

function capitalizeSegment(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatContactSource(source?: string) {
  if (!source) {
    return undefined;
  }

  return source
    .split("-")
    .map((segment) => capitalizeSegment(segment))
    .join(" ");
}

export function normalizeContactInquiry(value?: string): ContactInquiryKey | undefined {
  if (!value) {
    return undefined;
  }

  return value in contactInquiryDetails ? (value as ContactInquiryKey) : undefined;
}

export function getContactInquiryDetail(inquiry?: string) {
  return contactInquiryDetails[normalizeContactInquiry(inquiry) ?? "general"];
}

export function getContactTypeOption(inquiry: ContactInquiryKey): ContactTypeOption {
  if (contactTypeToInquiryMap["new-project"].includes(inquiry)) {
    return "new-project";
  }

  if (contactTypeToInquiryMap.general.includes(inquiry)) {
    return "general";
  }

  return "partnership";
}

/**
 * The curated, human-readable intents shown in the contact form's single
 * "What's this about?" dropdown. Each maps to one underlying inquiry key, so the
 * API / email contract is unchanged and deep-links (?inquiry=...) keep working —
 * we only curate what is *shown*, not the routing taxonomy.
 */
export const primaryContactIntents: { value: ContactInquiryKey; label: string }[] = [
  { value: "new-project", label: "A new project or build" },
  { value: "solutions", label: "Help with an existing product" },
  { value: "general", label: "A general question" },
  { value: "investor", label: "Partnership or investment" },
  { value: "developer", label: "Joining the team" },
];

/**
 * Resolve any inquiry key to the primary intent shown in the dropdown. An exact
 * match returns itself; anything else (e.g. a deep-linked `templates` or
 * `capabilities`) maps to the primary intent sharing its contact type, so the
 * Select always has a matching option to display.
 */
export function resolvePrimaryIntent(inquiry: ContactInquiryKey): ContactInquiryKey {
  if (primaryContactIntents.some((intent) => intent.value === inquiry)) {
    return inquiry;
  }

  const type = getContactTypeOption(inquiry);
  const match = primaryContactIntents.find(
    (intent) => getContactTypeOption(intent.value) === type
  );

  return match?.value ?? "general";
}

const contactSubmissionShape = {
  inquiry: z.enum(Object.keys(contactInquiryDetails) as [ContactInquiryKey, ...ContactInquiryKey[]]),
  contactType: z.enum(contactTypeOptions),
  name: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .max(120, "Keep the name under 120 characters."),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(320, "Keep the email under 320 characters."),
  brief: z
    .string()
    .trim()
    .min(10, "Add a little more detail about what you need.")
    .max(4000, "Keep the message under 4000 characters."),
  budget: z
    .string()
    .trim()
    .max(120, "Keep the budget range under 120 characters.")
    .optional()
    .default(""),
  timeline: z
    .string()
    .trim()
    .max(120, "Keep the timeline under 120 characters.")
    .optional()
    .default(""),
  source: z
    .string()
    .trim()
    .max(120, "Keep the source under 120 characters.")
    .optional()
    .default(""),
  country: z
    .string()
    .trim()
    .max(100, "Keep the country under 100 characters.")
    .optional()
    .default(""),
} satisfies z.ZodRawShape;

const contactSubmissionBaseSchema = z.object(contactSubmissionShape);

type ContactSubmissionRoutingFields = {
  inquiry: ContactInquiryKey;
  contactType: ContactTypeOption;
};

function validateContactSubmissionRouting(
  value: ContactSubmissionRoutingFields,
  ctx: z.RefinementCtx
) {
  const allowedInquiryPaths = contactTypeToInquiryMap[value.contactType];
  if (!allowedInquiryPaths.includes(value.inquiry)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["inquiry"],
      message: "Choose an inquiry path that matches the selected contact type.",
    });
  }
}

export const contactSubmissionSchema = contactSubmissionBaseSchema.superRefine(
  validateContactSubmissionRouting
);

export type ContactSubmissionInput = z.infer<typeof contactSubmissionSchema>;

export const contactSubmissionRequestSchema = contactSubmissionBaseSchema
  .extend({
    companyWebsite: z
      .string()
      .trim()
      .max(200, "Keep the company website under 200 characters.")
      .optional()
      .default(""),
    startedAt: z.coerce.number().int().positive("Invalid form start time.").optional(),
  })
  .superRefine(validateContactSubmissionRouting);

export type ContactSubmissionRequestInput = z.infer<typeof contactSubmissionRequestSchema>;
