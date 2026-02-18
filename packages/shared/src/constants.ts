import type { OrderStatus, InventoryStatusEnum, PartnerType, UserRole } from "./types";

/** The order statuses actively used in the application */
export const ACTIVE_ORDER_STATUSES = [
  "created",
  "submitted",
  "accepted",
  "rejected",
  "fulfilled",
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
  cancelled: "Cancelled",
};

/** Color keys for order status badges */
export const ORDER_STATUS_COLORS: Record<ActiveOrderStatus, "info" | "warning" | "success" | "error"> = {
  created: "info",
  submitted: "warning",
  accepted: "success",
  rejected: "error",
  fulfilled: "success",
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
] as const;

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  invoice: "Invoice",
  delivery_note: "Delivery Note",
  compliance: "Compliance",
  price_list: "Price List",
  marketing: "Marketing",
};



