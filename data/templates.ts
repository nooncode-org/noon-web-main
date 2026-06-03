export const templateCategories = [
  "SaaS",
  "Dashboards",
  "Internal tools",
  "AI assistants",
  "Marketplaces",
  "Booking platforms",
  "E-commerce",
  "Mobile apps",
] as const;

export const templatePrinciples = [
  {
    title: "Templates are structured starting points",
    description:
      "At Noon, a template is not a generic theme or canned product. It is a reusable baseline that accelerates scoping, architecture, and the first delivery decisions.",
  },
  {
    title: "They reduce blank-page time, not project judgment",
    description:
      "A template helps teams align faster on a likely software shape. It does not remove the need to define business logic, roles, workflows, or integration boundaries.",
  },
  {
    title: "The final build still gets shaped around the real problem",
    description:
      "Noon uses templates when they make delivery clearer. If the process, logic, or model does not fit the baseline cleanly, the project should move into a more custom path.",
  },
] as const;

export const templateSelectionGuides = [
  {
    title: "Use Templates when you want a fast, credible starting point",
    description:
      "This is the right route when the software category is already familiar and the main need is to accelerate scoping, not to decide whether the problem deserves software at all.",
  },
  {
    title: "Do not use Templates when the problem is still ambiguous",
    description:
      "If the operational pain, users, or system boundaries are still unclear, Solutions is the better route. Forcing a template too early creates false certainty.",
  },
  {
    title: "Do not expect a boxed product",
    description:
      "A template can speed up structure and delivery, but it is still the beginning of a custom software engagement. It is not a downloadable app or a fixed SKU.",
  },
];

export const templates = [
  {
    slug: "client-portal-saas",
    name: "Client Portal SaaS",
    category: "SaaS",
    summary:
      "A production-ready foundation for service businesses that need authenticated users, accounts, billing, and delivery workflows.",
    bestFit: ["Client-facing SaaS", "Subscription services", "Account-based software"],
    includes: ["Auth and account structure", "Billing-ready dashboard", "Core app shell", "Admin management flows"],
    extensions: ["Usage-based billing", "Permissions", "Client messaging", "Analytics layers"],
    useWhen:
      "The product category is already clear and the main need is to move faster on a customer-facing SaaS foundation without reinventing the baseline app structure.",
    notIdealWhen:
      "The team is still validating whether the business should be SaaS at all, or when the logic is so specialized that the category is not a meaningful baseline.",
    baselinePromise:
      "Gives the project a credible starting point for accounts, product navigation, and operator workflows so the custom work can focus on differentiation.",
    prompt: "Use the Client Portal SaaS template as a starting point for our software.",
  },
  {
    slug: "operations-command-center",
    name: "Operations Command Center",
    category: "Dashboards",
    summary:
      "A central dashboard for teams that need live visibility across orders, tasks, approvals, and reporting.",
    bestFit: ["Ops reporting", "Team dashboards", "Executive visibility"],
    includes: ["Dashboard layout", "KPI modules", "Operational lists", "Role-based views"],
    extensions: ["Custom reports", "Alerts", "Automation triggers", "Data connectors"],
    useWhen:
      "The business already knows it needs a centralized operational surface and wants to speed up the move from fragmented tools into one control layer.",
    notIdealWhen:
      "The real need is not visibility but a deeper workflow system, or when there is no agreed source of truth yet behind the dashboard itself.",
    baselinePromise:
      "Provides a fast baseline for layout, KPI modules, operational visibility, and role-based structure so the scope can focus on the right data and process logic.",
    prompt: "Use the Operations Command Center template as a starting point for our dashboard.",
  },
  {
    slug: "approval-workflow-tool",
    name: "Approval Workflow Tool",
    category: "Internal tools",
    summary:
      "An internal operational tool for approvals, assignments, escalations, and process visibility.",
    bestFit: ["Internal approvals", "Ops routing", "Admin workflows"],
    includes: ["Role-based actions", "Status flows", "Queues and filters", "Audit-friendly structure"],
    extensions: ["Notification logic", "SLA layers", "AI routing", "Reporting"],
    useWhen:
      "The process already behaves like a structured workflow with queues, decisions, and ownership, and the team needs a faster way into a real internal tool.",
    notIdealWhen:
      "The process is still mostly informal, or when the actual need is a broader operations platform rather than a narrower approval-oriented system.",
    baselinePromise:
      "Creates a strong base for workflow states, assignments, escalation paths, and operator interfaces so the custom work can focus on the true business rules.",
    prompt: "Use the Approval Workflow Tool template as a starting point for our internal operations tool.",
  },
  {
    slug: "customer-support-ai-assistant",
    name: "Customer Support AI Assistant",
    category: "AI assistants",
    summary:
      "A structured base for AI-assisted support with escalation paths, human handoff, and operational visibility.",
    bestFit: ["Support automation", "Internal assistants", "Helpdesk acceleration"],
    includes: ["Chat interface", "Conversation states", "Escalation handoff", "Ops-friendly console"],
    extensions: ["Knowledge retrieval", "Multi-channel delivery", "Analytics", "CRM sync"],
    useWhen:
      "The support model is already understood and the team wants to accelerate the product and operational shell around an assistant rather than starting from zero.",
    notIdealWhen:
      "The business still needs to define whether AI should exist in the workflow at all, or when data, fallback, and operations are too undefined for a template to help.",
    baselinePromise:
      "Provides a reliable starting point for assistant UX, handoff states, and operator visibility so the harder customization work can focus on knowledge, channels, and risk.",
    prompt: "Use the Customer Support AI Assistant template as a starting point for our AI assistant.",
  },
  {
    slug: "multi-vendor-marketplace",
    name: "Multi-Vendor Marketplace",
    category: "Marketplaces",
    summary:
      "A marketplace starting point with vendor onboarding, catalog structure, and buyer-seller operational flows.",
    bestFit: ["Service marketplaces", "Product marketplaces", "B2B matching platforms"],
    includes: ["Buyer and seller roles", "Catalog flows", "Vendor management", "Transaction foundations"],
    extensions: ["Escrow logic", "Reviews", "Dispute workflows", "Logistics orchestration"],
    useWhen:
      "The project is definitively a marketplace and the team wants to accelerate the common structural pieces instead of re-scoping roles and transaction flows from scratch.",
    notIdealWhen:
      "The business model is still undecided, the two-sided behavior is not validated, or the product is really a directory, booking tool, or ops system wearing marketplace language.",
    baselinePromise:
      "Accelerates the hardest common baseline pieces of a marketplace so custom work can focus on the model, trust layer, and operational edge cases.",
    prompt: "Use the Multi-Vendor Marketplace template as a starting point for our marketplace.",
  },
  {
    slug: "reservation-platform",
    name: "Reservation Platform",
    category: "Booking platforms",
    summary:
      "A booking-oriented foundation for businesses that need scheduling, availability, and managed reservations.",
    bestFit: ["Hospitality", "Services scheduling", "Booking operations"],
    includes: ["Calendar logic", "Availability management", "Reservation flows", "Operator dashboard"],
    extensions: ["Payments", "Reminders", "Capacity rules", "Customer accounts"],
    useWhen:
      "The project is clearly booking-oriented and the key need is to accelerate the scheduling and operator baseline without pretending the rest of the workflow is generic.",
    notIdealWhen:
      "Availability is not the true core of the business or when the product is actually an operations platform with booking as a small feature.",
    baselinePromise:
      "Gets the project quickly into calendar, reservation, and operator structures so the custom effort can focus on business-specific rules and service logic.",
    prompt: "Use the Reservation Platform template as a starting point for our booking software.",
  },
  {
    slug: "commerce-operations-storefront",
    name: "Commerce Operations Storefront",
    category: "E-commerce",
    summary:
      "A commerce-ready foundation combining storefront flows with operational management and order oversight.",
    bestFit: ["Digital commerce", "Operational storefronts", "Catalog businesses"],
    includes: ["Catalog structure", "Cart and checkout base", "Order management", "Operational dashboard"],
    extensions: ["Subscriptions", "Bundles", "Vendor logic", "Fulfillment automation"],
    useWhen:
      "The project is a commerce business that needs both storefront behavior and stronger operational control than a theme-driven shop usually provides.",
    notIdealWhen:
      "A standard commerce stack already solves the business well enough or when the real need is a marketplace or subscription product rather than a storefront.",
    baselinePromise:
      "Combines customer-facing commerce structure with operational oversight so the team can focus custom work on order logic, fulfillment, and business-specific flows.",
    prompt: "Use the Commerce Operations Storefront template as a starting point for our e-commerce product.",
  },
  {
    slug: "field-service-mobile-app",
    name: "Field Service Mobile App",
    category: "Mobile apps",
    summary:
      "A mobile starting point for operators and field teams who need tasks, statuses, and lightweight operational workflows.",
    bestFit: ["Field teams", "Internal mobile tools", "Service operations"],
    includes: ["Mobile navigation shell", "Task flows", "Status updates", "Operator views"],
    extensions: ["Offline states", "Maps", "Media capture", "Supervisor dashboard"],
    useWhen:
      "The team already knows the work must live in a mobile experience and needs a strong baseline for operator flows, task handling, and field execution.",
    notIdealWhen:
      "Mobile is only a secondary channel or when the real problem is back-office coordination, not field execution itself.",
    baselinePromise:
      "Provides a focused mobile baseline for operator workflows so the team can spend custom effort on offline behavior, supervision, and field-specific constraints.",
    prompt: "Use the Field Service Mobile App template as a starting point for our mobile app.",
  },
] as const;

export type TemplateItem = (typeof templates)[number];
