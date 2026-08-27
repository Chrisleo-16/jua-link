// ---------------------------------------------------------------------------
// Domain types for JuaLink.
//
// This file is the single source of truth for the order lifecycle. The SMS
// webhook, the USSD handler, the customer tracker, and the admin dashboard
// all import from here — so a status can never drift between surfaces.
// ---------------------------------------------------------------------------

/** Full internal order lifecycle. Not all of these are shown to customers. */
export const ORDER_STATUSES = [
  "PENDING_ARTISAN_CONFIRMATION", // just created, SMS sent to artisan, awaiting reply
  "ACCEPTED", // artisan replied 1 / ACCEPT
  "DECLINED", // artisan replied 2 / DECLINE
  "CALLBACK_REQUESTED", // artisan replied 3 / CALLBACK
  "QUOTATION_NEEDED", // admin-set: buyer + artisan negotiating price
  "DEPOSIT_DISCUSSION", // admin-set: terms agreed, deposit being arranged
  "IN_PRODUCTION", // admin-set: artisan is building it
  "READY", // admin-set: ready for collection/delivery
  "COMPLETED", // admin-set: order fulfilled
  "CANCELLED", // admin-set or customer-requested
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Subset of statuses that are worth telling the customer about by SMS.
 *  (Internal-only bookkeeping states don't need to interrupt someone's day.) */
export const CUSTOMER_FACING_STATUSES: OrderStatus[] = [
  "PENDING_ARTISAN_CONFIRMATION",
  "ACCEPTED",
  "DECLINED",
  "CALLBACK_REQUESTED",
  "READY",
  "COMPLETED",
  "CANCELLED",
];

/** Human-readable labels — used by both the web UI and SMS templates so the
 *  wording a customer sees on the tracker matches what they were texted. */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_ARTISAN_CONFIRMATION: "Request submitted — pending artisan confirmation",
  ACCEPTED: "Accepted by artisan",
  DECLINED: "Artisan unavailable",
  CALLBACK_REQUESTED: "Callback requested",
  QUOTATION_NEEDED: "Quotation in progress",
  DEPOSIT_DISCUSSION: "Deposit discussion pending",
  IN_PRODUCTION: "In production",
  READY: "Ready for collection",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export type RequestType = "standard" | "custom";

export type ArtisanResponse = "accepted" | "declined" | "callback_requested";

export type VerificationStatus = "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "hidden";

export type UserRole = "admin" | "artisan" | "customer";

export type SmsDirection = "inbound" | "outbound";

export interface ParsedArtisanReply {
  response: ArtisanResponse;
  orderReference: string | null;
}

// ---------------------------------------------------------------------------
// SMS reply parsing — the ONLY place that decides what an artisan's text
// reply means. Both the webhook route and any tests should call this rather
// than re-implementing the matching logic.
// ---------------------------------------------------------------------------

/**
 * Normalizes an artisan's raw SMS reply into one of the three recognized
 * actions, or null if we couldn't understand it (in which case the webhook
 * should not guess — it should log it and let a coordinator follow up).
 */
export function parseArtisanReply(rawText: string): ArtisanResponse | null {
  return parseArtisanReplyInput(rawText)?.response ?? null;
}

/**
 * Parses artisan replies that may include an explicit reference, e.g.
 * "JL-2048 1" or "accept jl-2048".
 */
export function parseArtisanReplyInput(rawText: string): ParsedArtisanReply | null {
  const normalized = rawText.trim().toUpperCase();
  if (!normalized) return null;

  const referenceMatch = normalized.match(/\bJL-\d{4,}\b/);
  const orderReference = referenceMatch?.[0] ?? null;
  const command = normalized
    .replace(/\bJL-\d{4,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const ACCEPT_WORDS = ["1", "ACCEPT", "YES"];
  const DECLINE_WORDS = ["2", "DECLINE", "NO"];
  const CALLBACK_WORDS = ["3", "CALLBACK", "CALL ME", "CALL"];

  if (ACCEPT_WORDS.includes(command)) return { response: "accepted", orderReference };
  if (DECLINE_WORDS.includes(command)) return { response: "declined", orderReference };
  if (CALLBACK_WORDS.includes(command)) return { response: "callback_requested", orderReference };

  return null;
}

/** Maps an artisan's response to the resulting order status. */
export function statusFromArtisanResponse(response: ArtisanResponse): OrderStatus {
  switch (response) {
    case "accepted":
      return "ACCEPTED";
    case "declined":
      return "DECLINED";
    case "callback_requested":
      return "CALLBACK_REQUESTED";
  }
}

// ---------------------------------------------------------------------------
// Table row shapes (kept close to the SQL schema — see supabase/migrations).
// ---------------------------------------------------------------------------

export interface Product {
  id: string;
  artisan_id: string;
  category_id: string;
  name: string;
  slug: string;
  short_description: string;
  description: string;
  material: string | null;
  price_from: number | null;
  price_to: number | null;
  lead_time_days: number | null;
  location: string;
  is_customizable: boolean;
  is_available: boolean;
  approval_status: ApprovalStatus;
  created_at: string;
  updated_at: string;
}

export interface Artisan {
  id: string;
  profile_id: string | null;
  full_name: string;
  business_name: string;
  phone_number: string;
  whatsapp_number: string | null;
  location: string;
  county: string | null;
  craft_category: string;
  description: string;
  years_experience: number | null;
  verification_status: VerificationStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderRequest {
  id: string;
  order_reference: string;
  product_id: string;
  artisan_id: string;
  customer_name: string;
  customer_phone: string;
  customer_location: string;
  quantity: number;
  request_type: RequestType;
  preferred_timeline: string | null;
  special_instructions: string | null;
  reference_image_url: string | null;
  consent_to_contact: boolean;
  status: OrderStatus;
  artisan_response: ArtisanResponse | null;
  created_at: string;
  updated_at: string;
}

/** Generates a short, human-readable order reference like "JL-2048". */
export function generateOrderReference(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `JL-${n}`;
}
