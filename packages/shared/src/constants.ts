import type { OrderStatus, InventoryStatusEnum, PartnerType, UserRole, DocumentAudience, InvoiceStatus } from "./types";

/** The order statuses actively used in the application */
export const ACTIVE_ORDER_STATUSES = [
  "created",
  "submitted",
  "accepted",
  "rejected",
  "fulfilled",
  "delivered",
  "cancelled",
] as const satisfies readonly OrderStatus[];

export type ActiveOrderStatus = (typeof ACTIVE_ORDER_STATUSES)[number];

/** Human-readable labels for order statuses */
export const ORDER_STATUS_LABELS: Record<ActiveOrderStatus, string> = {
  created: "Draft",
  submitted: "Submitted",
  accepted: "Accepted",
  rejected: "Rejected",
  fulfilled: "Fulfilled",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Color keys for order status badges */
export const ORDER_STATUS_COLORS: Record<ActiveOrderStatus, string> = {
  created: "info",
  submitted: "warning",
  accepted: "success",
  rejected: "error",
  fulfilled: "success",
  delivered: "delivered",
  cancelled: "error",
};

/** Human-readable labels for inventory statuses */
export const INVENTORY_STATUS_LABELS: Record<InventoryStatusEnum, string> = {
  in_stock: "In Stock",
  limited: "Limited",
  out: "Out of Stock",
};

/** Human-readable labels for partner types */
export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  client: "Buyer",
  distributor: "Distributor",
  supplier: "Supplier",
};

/** Partner types that are on the supply side (producers) */
export const SUPPLY_SIDE_TYPES: PartnerType[] = ["supplier"];

/** Partner types that are on the demand side (buyers/distributors) */
export const DEMAND_SIDE_TYPES: PartnerType[] = ["client", "distributor"];

/** All partner types */
export const ALL_PARTNER_TYPES: PartnerType[] = ["client", "distributor", "supplier"];

/** Human-readable labels for user roles */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  partner: "Partner",
  client: "Buyer",
  distributor: "Distributor",
};

/** Product categories */
export const PRODUCT_CATEGORIES = [
  "tequila",
  "mezcal",
  "raicilla",
  "other",
] as const;

/** Document types */
export const DOCUMENT_TYPES = [
  "invoice",
  "delivery_note",
  "compliance",
  "price_list",
  "marketing",
  "presentation",
  "fact_sheet",
  "brand_deck",
  "spec_sheet",
] as const;

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  invoice: "Invoice",
  delivery_note: "Delivery Note",
  compliance: "Compliance",
  price_list: "Price List",
  marketing: "Marketing",
  presentation: "Presentation",
  fact_sheet: "Fact Sheet",
  brand_deck: "Brand Deck",
  spec_sheet: "Spec Sheet",
};

/** Document audience */
export const DOCUMENT_AUDIENCES = ["all", "distributor", "client", "internal"] as const;

export const DOCUMENT_AUDIENCE_LABELS: Record<DocumentAudience, string> = {
  all: "Everyone",
  distributor: "Distributors Only",
  client: "Clients Only",
  internal: "Internal (Admin Only)",
};

// ── Assignment data seeds ─────────────────────────────────────────────

export const CONTRACT_TYPES = ["exclusive", "preferred", "allowed"] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];
export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  exclusive: "Exclusive",
  preferred: "Preferred",
  allowed: "Allowed",
};

export const CLIENT_TIERS = ["A", "B", "C"] as const;
export type ClientTier = (typeof CLIENT_TIERS)[number];
export const CLIENT_TIER_LABELS: Record<ClientTier, string> = {
  A: "Tier A (Priority)",
  B: "Tier B (Standard)",
  C: "Tier C (Basic)",
};

export const CAPACITY_STATUSES = ["open", "limited", "paused"] as const;
export type CapacityStatus = (typeof CAPACITY_STATUSES)[number];
export const CAPACITY_STATUS_LABELS: Record<CapacityStatus, string> = {
  open: "Open",
  limited: "Limited",
  paused: "Paused",
};

// ── Invoice constants ────────────────────────────────────────────────

export const INVOICE_STATUSES = ["sent", "paid", "overdue"] as const;

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, "info" | "warning" | "success" | "error"> = {
  sent: "warning",
  paid: "success",
  overdue: "error",
};

// ── Inventory adjustment types ───────────────────────────────────────

export const INVENTORY_ADJUSTMENT_TYPES = [
  "stock_in",
  "broken",
  "gifted",
  "sample",
  "damaged",
  "lost",
  "other",
] as const;

export type InventoryAdjustmentType = (typeof INVENTORY_ADJUSTMENT_TYPES)[number];

export const INVENTORY_ADJUSTMENT_LABELS: Record<InventoryAdjustmentType, string> = {
  stock_in: "Stock In (from Mecanova)",
  broken: "Broken",
  gifted: "Gifted",
  sample: "Sample",
  damaged: "Damaged",
  lost: "Lost",
  other: "Other",
};

