import type { OrderStatus, InventoryStatusEnum, PartnerType, UserRole, DocumentAudience, DocumentType, InvoiceStatus } from "./types";

/** The order statuses actively used in the application */
export const ACTIVE_ORDER_STATUSES = [
  "created",
  "submitted",
  "accepted",
  "rejected",
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
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Color keys for order status badges */
export const ORDER_STATUS_COLORS: Record<ActiveOrderStatus, string> = {
  created: "info",
  submitted: "warning",
  accepted: "success",
  rejected: "error",
  delivered: "delivered",
  cancelled: "error",
};

/** Human-readable labels for inventory statuses */
export const INVENTORY_STATUS_LABELS: Record<InventoryStatusEnum, string> = {
  in_stock: "In Stock",
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
  "legal_registration",
  "permit",
  "license",
  "compliance",
  "contract_supplier",
  "contract_distributor",
  "nda",
  "price_list",
  "fact_sheet",
  "brand_deck",
  "spec_sheet",
  "invoice",
  "delivery_note",
  "marketing",
  "presentation",
] as const;

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  legal_registration: "Legal Registration",
  permit: "Permit",
  license: "License",
  compliance: "Compliance",
  contract_supplier: "Supplier Contract",
  contract_distributor: "Distributor Contract",
  nda: "NDA",
  price_list: "Price List",
  fact_sheet: "Fact Sheet",
  brand_deck: "Brand Deck",
  spec_sheet: "Spec Sheet",
  invoice: "Invoice",
  delivery_note: "Delivery Note",
  marketing: "Marketing",
  presentation: "Presentation",
};

/** Document categories — top-level grouping in /documents hub */
export const DOCUMENT_CATEGORIES = [
  "legal",
  "contracts",
  "sales",
  "operations",
  "marketing",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  legal: "Legal",
  contracts: "Contracts",
  sales: "Sales",
  operations: "Operations",
  marketing: "Marketing",
};

export const DOCUMENT_CATEGORY_DESCRIPTIONS: Record<DocumentCategory, string> = {
  legal: "Company registrations, permits, licenses, compliance",
  contracts: "Supplier and distributor agreements, NDAs",
  sales: "Price lists, fact sheets, brand decks, spec sheets",
  operations: "Invoices, delivery notes",
  marketing: "Presentations and marketing assets",
};

/** Maps a document type to its parent category */
export const DOCUMENT_TYPE_TO_CATEGORY: Record<DocumentType, DocumentCategory> = {
  legal_registration: "legal",
  permit: "legal",
  license: "legal",
  compliance: "legal",
  contract_supplier: "contracts",
  contract_distributor: "contracts",
  nda: "contracts",
  price_list: "sales",
  fact_sheet: "sales",
  brand_deck: "sales",
  spec_sheet: "sales",
  invoice: "operations",
  delivery_note: "operations",
  marketing: "marketing",
  presentation: "marketing",
};

/** Document statuses stored in the DB (expired/expiring_soon are derived from expires_at) */
export const DOCUMENT_STATUSES = ["active", "draft"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  active: "Active",
  draft: "Draft",
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

// ── Venue type constants ─────────────────────────────────────────────

export const VENUE_TYPES = ["bar", "restaurant", "hotel", "wholesaler", "private_customer", "club", "other"] as const;

export const VENUE_TYPE_LABELS: Record<string, string> = {
  bar: "Bar",
  restaurant: "Restaurant",
  hotel: "Hotel",
  wholesaler: "Wholesaler",
  private_customer: "Private Customer",
  club: "Club",
  other: "Other",
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

