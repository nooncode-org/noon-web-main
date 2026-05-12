import Stripe from "stripe";

const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

let stripeClient: Stripe | null = null;

export class StripeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeConfigError";
  }
}

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new StripeConfigError("STRIPE_SECRET_KEY is not configured.");
  }

  stripeClient ??= new Stripe(secretKey);
  return stripeClient;
}

export function getStripeWebhookSecret() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new StripeConfigError("STRIPE_WEBHOOK_SECRET is not configured.");
  }
  return webhookSecret;
}

export function toStripeMinorUnit(amount: number, currency: string) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new RangeError("Stripe amount must be greater than zero.");
  }

  const normalizedCurrency = currency.trim().toLowerCase();
  const multiplier = ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency) ? 1 : 100;
  return Math.round(amount * multiplier);
}

export function fromStripeMinorUnit(amount: number | null | undefined, currency: string) {
  if (amount == null) return null;
  const normalizedCurrency = currency.trim().toLowerCase();
  const divisor = ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency) ? 1 : 100;
  return amount / divisor;
}

export function getStripeObjectId(value: string | { id?: string } | null | undefined) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id ?? null;
}
