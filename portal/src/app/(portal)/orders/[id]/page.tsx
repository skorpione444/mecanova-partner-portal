"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Timeline from "@/components/orders/Timeline";
import StatusBadge from "@/components/orders/StatusBadge";
import { ORDER_STATUS_LABELS } from "@mecanova/shared";
import type { ActiveOrderStatus, UserRole, Json } from "@mecanova/shared";
import {
  ShoppingCart,
  ArrowLeft,
  Check,
  X,
  Truck,
  Calendar,
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  User,
  Receipt,
} from "lucide-react";

interface OrderDetail {
  id: string;
  status: string;
  created_at: string;
  submitted_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  fulfilled_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  estimated_delivery_date: string | null;
  estimated_delivery_note: string | null;
  notes: string | null;
  client_id: string | null;
  distributor_id: string | null;
  client_name: string | null;
  distributor_name: string | null;
  items: { product_name: string; cases_qty: number }[];
}

interface ClientInfo {
  company_name: string | null;
  country: string | null;
  vat_id: string | null;
  billing_address: Json | null;
  shipping_address: Json | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

function formatAddress(addr: Json | null): string | null {
  if (!addr || typeof addr !== "object" || Array.isArray(addr)) return null;
  const a = addr as Record<string, string>;
  const parts = [a.street, a.street2, [a.zip, a.city].filter(Boolean).join(" "), a.state, a.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export default function OrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [showEditDelivery, setShowEditDelivery] = useState(false);
  const [showInvoicePrompt, setShowInvoicePrompt] = useState(false);
  const supabase = createClient();

  const loadOrder = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, partner_id")
      .eq("user_id", user.id)
      .single();

    if (profile) setRole(profile.role as UserRole);

    const { data: o } = await supabase.from("order_requests").select("*").eq("id", id).single();
    if (!o) {
      setLoading(false);
      return;
    }

    let client_name: string | null = null;
    let distributor_name: string | null = null;

    if (o.client_id) {
      const { data: c } = await supabase.from("partners").select("name").eq("id", o.client_id).single();
      client_name = c?.name || null;
    }
    if (o.distributor_id) {
      const { data: d } = await supabase.from("partners").select("name").eq("id", o.distributor_id).single();
      distributor_name = d?.name || null;
    }

    const { data: items } = await supabase
      .from("order_request_items")
      .select("product_id, cases_qty")
      .eq("order_request_id", id);

    const productIds = (items || []).map((i) => i.product_id);
    let productMap = new Map<string, string>();
    if (productIds.length > 0) {
      const { data: prods } = await supabase.from("products").select("id, name").in("id", productIds);
      productMap = new Map((prods || []).map((p) => [p.id, p.name]));
    }

    setOrder({
      id: o.id,
      status: o.status,
      created_at: o.created_at,
      submitted_at: o.submitted_at,
      accepted_at: o.accepted_at,
      rejected_at: o.rejected_at,
      fulfilled_at: o.fulfilled_at,
      delivered_at: (o as Record<string, unknown>).delivered_at as string | null ?? null,
      cancelled_at: o.cancelled_at,
      estimated_delivery_date: (o as Record<string, unknown>).estimated_delivery_date as string | null ?? null,
      estimated_delivery_note: (o as Record<string, unknown>).estimated_delivery_note as string | null ?? null,
      notes: o.notes,
      client_id: o.client_id,
      distributor_id: o.distributor_id,
      client_name,
      distributor_name,
      items: (items || []).map((i) => ({
        product_name: productMap.get(i.product_id) || "Unknown",
        cases_qty: i.cases_qty,
      })),
    });

    // Load client info for distributors
    if (profile?.role === "distributor" && o.client_id) {
      // Try RPC first, fall back to direct query if function doesn't exist yet
      const { data: ci, error: rpcErr } = await supabase.rpc("get_order_client_info", { p_order_id: id });
      if (!rpcErr && ci) {
        setClientInfo(ci as unknown as ClientInfo);
      } else {
        // Fallback: query partner directly
        const { data: clientPartner } = await supabase
          .from("partners")
          .select("name, country, vat_id, billing_address, shipping_address, contact_person, contact_email, contact_phone")
          .eq("id", o.client_id)
          .single();
        if (clientPartner) {
          setClientInfo({
            company_name: clientPartner.name,
            country: clientPartner.country,
            vat_id: clientPartner.vat_id,
            billing_address: clientPartner.billing_address,
            shipping_address: clientPartner.shipping_address,
            contact_person: (clientPartner as Record<string, unknown>).contact_person as string | null ?? null,
            contact_email: (clientPartner as Record<string, unknown>).contact_email as string | null ?? null,
            contact_phone: (clientPartner as Record<string, unknown>).contact_phone as string | null ?? null,
          });
        }
      }
    }

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handleAccept = async () => {
    setActionLoading("accept");
    setActionError(null);
    const { error } = await supabase.rpc("accept_order", { p_order_id: id });
    if (error) {
      setActionError(error.message);
      setActionLoading(null);
      return;
    }
    await loadOrder();
    setActionLoading(null);
    setShowDeliveryModal(true);
  };

  const handleReject = async () => {
    setActionLoading("reject");
    setActionError(null);
    const { error } = await supabase.rpc("reject_order", { p_order_id: id });
    if (error) {
      setActionError(error.message);
      setActionLoading(null);
      return;
    }
    await loadOrder();
    setActionLoading(null);
  };

  const handleDeliver = async () => {
    setActionLoading("deliver");
    setActionError(null);
    const { error } = await supabase.rpc("deliver_order", { p_order_id: id });
    if (error) {
      setActionError(error.message);
      setActionLoading(null);
      return;
    }
    await loadOrder();
    setActionLoading(null);
    setShowInvoicePrompt(true);
  };

  const handleSaveDeliveryEstimate = async () => {
    if (!deliveryDate) return;
    setActionLoading("delivery-estimate");
    const { error } = await supabase
      .from("order_requests")
      .update({
        estimated_delivery_date: deliveryDate,
        estimated_delivery_note: deliveryNote || null,
      })
      .eq("id", id);
    if (error) {
      setActionError(error.message);
    } else {
      setShowDeliveryModal(false);
      setShowEditDelivery(false);
      await loadOrder();
    }
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div>
        <div className="mc-skeleton h-6 w-48 mb-6" />
        <div className="mc-skeleton h-64 max-w-2xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-[11px] tracking-wide mb-4"
          style={{ color: "var(--mc-text-muted)" }}
        >
          <ArrowLeft className="w-3 h-3" /> Back to Orders
        </Link>
        <p className="text-sm" style={{ color: "var(--mc-text-muted)" }}>
          Order not found.
        </p>
      </div>
    );
  }

  const isDistributor = role === "distributor";
  const canManageOrder = isDistributor && order.status === "submitted";
  const canMarkDelivered = isDistributor && order.status === "accepted";
  const canEditDeliveryEstimate =
    isDistributor && ["accepted", "fulfilled"].includes(order.status);

  const counterpartLabel = isDistributor ? "Client" : "Distributor";
  const counterpartName = isDistributor ? order.client_name : order.distributor_name;

  const timelineEvents = [
    { label: "Created", date: order.created_at },
    { label: "Submitted", date: order.submitted_at },
    { label: "Accepted", date: order.accepted_at },
    { label: "Rejected", date: order.rejected_at },
    { label: "Delivered", date: order.delivered_at },
    { label: "Fulfilled", date: order.fulfilled_at },
    { label: "Cancelled", date: order.cancelled_at },
  ];

  return (
    <div>
      <Link
        href="/orders"
        className="inline-flex items-center gap-1.5 text-[11px] tracking-wide mb-4 transition-colors"
        style={{ color: "var(--mc-text-muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-text-muted)")}
      >
        <ArrowLeft className="w-3 h-3" />
        Back to Orders
      </Link>

      <PageHeader
        title={`Order ${order.id.slice(0, 8)}...`}
        description={counterpartName ? `${counterpartLabel}: ${counterpartName}` : undefined}
        icon={ShoppingCart}
        actions={<StatusBadge status={order.status} />}
      />

      {actionError && (
        <div
          className="mb-5 px-4 py-3 text-xs"
          style={{
            background: "var(--mc-error-bg)",
            border: "1px solid var(--mc-error-light)",
            color: "var(--mc-error)",
          }}
        >
          {actionError}
        </div>
      )}

      <div className="max-w-3xl space-y-5">
        {/* Distributor actions: Accept / Reject */}
        {canManageOrder && (
          <div className="mc-card p-5">
            <h3
              className="text-xs font-semibold tracking-[0.08em] uppercase mb-3"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Actions
            </h3>
            <p className="text-xs mb-4" style={{ color: "var(--mc-text-secondary)" }}>
              This order is awaiting your review. Accept to confirm and reserve inventory, or reject to
              decline.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleAccept}
                disabled={actionLoading !== null}
                className="mc-btn mc-btn-primary inline-flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                {actionLoading === "accept" ? "Accepting..." : "Accept Order"}
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading !== null}
                className="mc-btn inline-flex items-center gap-1.5"
                style={{
                  background: "transparent",
                  border: "1px solid var(--mc-error-light)",
                  color: "var(--mc-error)",
                }}
              >
                <X className="w-3.5 h-3.5" />
                {actionLoading === "reject" ? "Rejecting..." : "Reject Order"}
              </button>
            </div>
          </div>
        )}

        {/* Distributor action: Mark as Delivered */}
        {canMarkDelivered && (
          <div className="mc-card p-5">
            <h3
              className="text-xs font-semibold tracking-[0.08em] uppercase mb-3"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Delivery
            </h3>
            <p className="text-xs mb-4" style={{ color: "var(--mc-text-secondary)" }}>
              Once the order has been shipped and delivered to the client, mark it as delivered.
            </p>
            <button
              onClick={handleDeliver}
              disabled={actionLoading !== null}
              className="mc-btn mc-btn-primary inline-flex items-center gap-1.5"
            >
              <Truck className="w-3.5 h-3.5" />
              {actionLoading === "deliver" ? "Updating..." : "Mark as Delivered"}
            </button>
          </div>
        )}

        {/* Estimated Delivery Date (visible to both roles) */}
        {order.estimated_delivery_date && (
          <div className="mc-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3
                className="text-xs font-semibold tracking-[0.08em] uppercase"
                style={{ color: "var(--mc-text-muted)" }}
              >
                Estimated Delivery
              </h3>
              {canEditDeliveryEstimate && (
                <button
                  onClick={() => {
                    setDeliveryDate(order.estimated_delivery_date || "");
                    setDeliveryNote(order.estimated_delivery_note || "");
                    setShowEditDelivery(true);
                  }}
                  className="text-[10px] tracking-wide uppercase transition-colors"
                  style={{ color: "var(--mc-cream-subtle)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-cream-subtle)")}
                >
                  Edit
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--mc-text-primary)" }}>
              <Calendar className="w-3.5 h-3.5" style={{ color: "var(--mc-cream-subtle)" }} />
              {new Date(order.estimated_delivery_date + "T00:00:00").toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
            {order.estimated_delivery_note && (
              <p className="text-xs mt-2" style={{ color: "var(--mc-text-secondary)" }}>
                {order.estimated_delivery_note}
              </p>
            )}
          </div>
        )}

        {/* Set delivery estimate button for distributor when none set */}
        {canEditDeliveryEstimate && !order.estimated_delivery_date && (
          <div className="mc-card p-5">
            <h3
              className="text-xs font-semibold tracking-[0.08em] uppercase mb-3"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Estimated Delivery
            </h3>
            <p className="text-xs mb-4" style={{ color: "var(--mc-text-secondary)" }}>
              Provide an estimated delivery date so the client knows when to expect the order.
            </p>
            <button
              onClick={() => {
                setDeliveryDate("");
                setDeliveryNote("");
                setShowDeliveryModal(true);
              }}
              className="mc-btn inline-flex items-center gap-1.5"
              style={{
                background: "transparent",
                border: "1px solid var(--mc-border)",
                color: "var(--mc-text-primary)",
              }}
            >
              <Calendar className="w-3.5 h-3.5" />
              Set Delivery Estimate
            </button>
          </div>
        )}

        {/* Client Information (distributor view only) */}
        {isDistributor && clientInfo && (
          <div className="mc-card p-5">
            <h3
              className="text-xs font-semibold tracking-[0.08em] uppercase mb-4"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Client Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="flex items-start gap-2.5">
                <Building2
                  className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                  style={{ color: "var(--mc-cream-subtle)" }}
                />
                <div>
                  <span style={{ color: "var(--mc-text-muted)" }}>Company</span>
                  <p className="mt-0.5" style={{ color: "var(--mc-text-primary)" }}>
                    {clientInfo.company_name || "—"}
                  </p>
                </div>
              </div>

              {clientInfo.contact_person && (
                <div className="flex items-start gap-2.5">
                  <User
                    className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                    style={{ color: "var(--mc-cream-subtle)" }}
                  />
                  <div>
                    <span style={{ color: "var(--mc-text-muted)" }}>Contact Person</span>
                    <p className="mt-0.5" style={{ color: "var(--mc-text-primary)" }}>
                      {clientInfo.contact_person}
                    </p>
                  </div>
                </div>
              )}

              {clientInfo.contact_email && (
                <div className="flex items-start gap-2.5">
                  <Mail
                    className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                    style={{ color: "var(--mc-cream-subtle)" }}
                  />
                  <div>
                    <span style={{ color: "var(--mc-text-muted)" }}>Email</span>
                    <p className="mt-0.5" style={{ color: "var(--mc-text-primary)" }}>
                      {clientInfo.contact_email}
                    </p>
                  </div>
                </div>
              )}

              {clientInfo.contact_phone && (
                <div className="flex items-start gap-2.5">
                  <Phone
                    className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                    style={{ color: "var(--mc-cream-subtle)" }}
                  />
                  <div>
                    <span style={{ color: "var(--mc-text-muted)" }}>Phone</span>
                    <p className="mt-0.5" style={{ color: "var(--mc-text-primary)" }}>
                      {clientInfo.contact_phone}
                    </p>
                  </div>
                </div>
              )}

              {clientInfo.vat_id && (
                <div className="flex items-start gap-2.5">
                  <FileText
                    className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                    style={{ color: "var(--mc-cream-subtle)" }}
                  />
                  <div>
                    <span style={{ color: "var(--mc-text-muted)" }}>VAT / Tax ID</span>
                    <p className="mt-0.5" style={{ color: "var(--mc-text-primary)" }}>
                      {clientInfo.vat_id}
                    </p>
                  </div>
                </div>
              )}

              {clientInfo.country && (
                <div className="flex items-start gap-2.5">
                  <MapPin
                    className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                    style={{ color: "var(--mc-cream-subtle)" }}
                  />
                  <div>
                    <span style={{ color: "var(--mc-text-muted)" }}>Country</span>
                    <p className="mt-0.5" style={{ color: "var(--mc-text-primary)" }}>
                      {clientInfo.country}
                    </p>
                  </div>
                </div>
              )}

              {formatAddress(clientInfo.shipping_address) && (
                <div className="sm:col-span-2 flex items-start gap-2.5">
                  <MapPin
                    className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                    style={{ color: "var(--mc-cream-subtle)" }}
                  />
                  <div>
                    <span style={{ color: "var(--mc-text-muted)" }}>Delivery Address</span>
                    <p className="mt-0.5" style={{ color: "var(--mc-text-primary)" }}>
                      {formatAddress(clientInfo.shipping_address)}
                    </p>
                  </div>
                </div>
              )}

              {formatAddress(clientInfo.billing_address) && (
                <div className="sm:col-span-2 flex items-start gap-2.5">
                  <Building2
                    className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                    style={{ color: "var(--mc-cream-subtle)" }}
                  />
                  <div>
                    <span style={{ color: "var(--mc-text-muted)" }}>Billing Address</span>
                    <p className="mt-0.5" style={{ color: "var(--mc-text-primary)" }}>
                      {formatAddress(clientInfo.billing_address)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="mc-card p-5">
          <h3
            className="text-xs font-semibold tracking-[0.08em] uppercase mb-3"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Timeline
          </h3>
          <Timeline events={timelineEvents} />
        </div>

        {/* Order info */}
        <div className="mc-card p-5">
          <h3
            className="text-xs font-semibold tracking-[0.08em] uppercase mb-3"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Details
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span style={{ color: "var(--mc-text-muted)" }}>Status</span>
              <p className="mt-0.5" style={{ color: "var(--mc-text-primary)" }}>
                {ORDER_STATUS_LABELS[order.status as ActiveOrderStatus] || order.status}
              </p>
            </div>
            <div>
              <span style={{ color: "var(--mc-text-muted)" }}>{counterpartLabel}</span>
              <p className="mt-0.5" style={{ color: "var(--mc-text-primary)" }}>
                {counterpartName || "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="mc-card p-5">
          <h3
            className="text-xs font-semibold tracking-[0.08em] uppercase mb-3"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Items ({order.items.length})
          </h3>
          <div className="space-y-2">
            {order.items.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2"
                style={{
                  background: "var(--mc-surface-warm)",
                  border: "1px solid var(--mc-border-light)",
                }}
              >
                <span className="text-xs font-medium" style={{ color: "var(--mc-text-primary)" }}>
                  {item.product_name}
                </span>
                <span className="text-xs font-mono" style={{ color: "var(--mc-text-muted)" }}>
                  {item.cases_qty} {item.cases_qty === 1 ? "case" : "cases"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="mc-card p-5">
            <h3
              className="text-xs font-semibold tracking-[0.08em] uppercase mb-3"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Notes
            </h3>
            <p className="text-xs" style={{ color: "var(--mc-text-secondary)" }}>
              {order.notes}
            </p>
          </div>
        )}
      </div>

      {/* Invoice Prompt Modal */}
      {showInvoicePrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(10, 11, 13, 0.8)" }}
          onClick={() => setShowInvoicePrompt(false)}
        >
          <div
            className="mc-card p-6 w-full max-w-md mc-animate-fade"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-1">
              <div
                className="w-8 h-8 flex items-center justify-center"
                style={{ background: "var(--mc-success-bg)", border: "1px solid var(--mc-success-light)" }}
              >
                <Truck className="w-4 h-4" style={{ color: "var(--mc-success)" }} />
              </div>
              <h3
                className="text-sm font-semibold"
                style={{ color: "var(--mc-text-primary)" }}
              >
                Order Delivered
              </h3>
            </div>
            <p className="text-xs mb-5 mt-3" style={{ color: "var(--mc-text-muted)" }}>
              This order has been marked as delivered. Would you like to create an invoice for this delivery?
            </p>
            <div className="flex gap-3">
              <Link
                href={`/invoices/new?client=${order.client_id}&order=${order.id}`}
                className="mc-btn mc-btn-primary flex-1 inline-flex items-center justify-center gap-1.5"
              >
                <Receipt className="w-3.5 h-3.5" />
                Create Invoice
              </Link>
              <button
                onClick={() => setShowInvoicePrompt(false)}
                className="mc-btn"
                style={{
                  background: "transparent",
                  border: "1px solid var(--mc-border)",
                  color: "var(--mc-text-secondary)",
                }}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Estimate Modal */}
      {(showDeliveryModal || showEditDelivery) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(10, 11, 13, 0.8)" }}
          onClick={() => {
            setShowDeliveryModal(false);
            setShowEditDelivery(false);
          }}
        >
          <div
            className="mc-card p-6 w-full max-w-md mc-animate-fade"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="text-sm font-semibold mb-1"
              style={{ color: "var(--mc-text-primary)" }}
            >
              {showEditDelivery ? "Update Delivery Estimate" : "Set Estimated Delivery"}
            </h3>
            <p className="text-xs mb-5" style={{ color: "var(--mc-text-muted)" }}>
              {showEditDelivery
                ? "Update the delivery estimate for this order."
                : "Great, the order has been accepted! Please provide an estimated delivery date for the client."}
            </p>

            <div className="space-y-4">
              <div>
                <label
                  className="block text-[10px] font-semibold tracking-[0.08em] uppercase mb-1.5"
                  style={{ color: "var(--mc-text-muted)" }}
                >
                  Estimated Delivery Date
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="mc-input w-full"
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div>
                <label
                  className="block text-[10px] font-semibold tracking-[0.08em] uppercase mb-1.5"
                  style={{ color: "var(--mc-text-muted)" }}
                >
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  className="mc-input w-full"
                  placeholder="e.g. Delivery within 3-5 business days"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveDeliveryEstimate}
                disabled={!deliveryDate || actionLoading === "delivery-estimate"}
                className="mc-btn mc-btn-primary flex-1"
              >
                {actionLoading === "delivery-estimate" ? "Saving..." : "Save Estimate"}
              </button>
              <button
                onClick={() => {
                  setShowDeliveryModal(false);
                  setShowEditDelivery(false);
                }}
                className="mc-btn"
                style={{
                  background: "transparent",
                  border: "1px solid var(--mc-border)",
                  color: "var(--mc-text-secondary)",
                }}
              >
                {showDeliveryModal && !showEditDelivery ? "Skip" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
