"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import type { Partner, Profile, OrderRequest, CRMStatus } from "@mecanova/shared";
import { PARTNER_TYPE_LABELS, CAPACITY_STATUS_LABELS } from "@mecanova/shared";
import {
  Edit,
  UserPlus,
  MapPin,
  Building2,
  User,
  Mail,
  ClipboardList,
  Factory,
  Package,
  Globe,
  EyeOff,
} from "lucide-react";

interface RelationshipEntry {
  partner_id: string;
  partner_name: string;
  is_default: boolean;
  contract_type: string;
  assignment_locked: boolean;
  assignment_reason: string | null;
}

interface PartnerDetail extends Partner {
  profiles: Profile[];
  orders: OrderRequest[];
  clientDistributors: RelationshipEntry[];
  products: { id: string; name: string }[];
}

type Tab = "overview" | "users" | "orders" | "products" | "notes";

interface Props {
  id: string;
  onPartnerChanged?: () => void;
}

export default function PartnerDetailPanel({ id, onPartnerChanged }: Props) {
  const router = useRouter();
  const [partner, setPartner] = useState<PartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [markingInactive, setMarkingInactive] = useState(false);

  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const { data: partnerData } = await supabase
      .from("partners")
      .select("*")
      .eq("id", id)
      .single();

    if (!partnerData) {
      router.push("/partners");
      return;
    }

    const [profilesRes, ordersRes, cdRes, supplierProductsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("partner_id", id),
      supabase
        .from("order_requests")
        .select("*")
        .or(`partner_id.eq.${id},client_id.eq.${id},distributor_id.eq.${id}`)
        .order("created_at", { ascending: false })
        .limit(10),
      partnerData.partner_type === "distributor"
        ? supabase
            .from("client_distributors")
            .select("client_id, is_default, contract_type, assignment_locked, assignment_reason")
            .eq("distributor_id", id)
        : supabase
            .from("client_distributors")
            .select("distributor_id, is_default, contract_type, assignment_locked, assignment_reason")
            .eq("client_id", id),
      partnerData.partner_type === "supplier"
        ? supabase.from("products").select("id, name").eq("supplier_id", id).order("name")
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

    const relatedIds =
      partnerData.partner_type === "distributor"
        ? (cdRes.data || []).map((r: { client_id?: string }) => r.client_id || "")
        : (cdRes.data || []).map((r: { distributor_id?: string }) => r.distributor_id || "");

    let clientDistributors: RelationshipEntry[] = [];
    if (relatedIds.length > 0) {
      const { data: relPartners } = await supabase
        .from("partners")
        .select("id, name")
        .in("id", relatedIds);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clientDistributors = (relPartners || []).map((p) => {
        const cdRow =
          partnerData.partner_type === "distributor"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (cdRes.data || []).find((r: any) => r.client_id === p.id)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            : (cdRes.data || []).find((r: any) => r.distributor_id === p.id);
        return {
          partner_id: p.id,
          partner_name: p.name,
          is_default: cdRow?.is_default ?? false,
          contract_type: cdRow?.contract_type ?? "allowed",
          assignment_locked: cdRow?.assignment_locked ?? false,
          assignment_reason: cdRow?.assignment_reason ?? null,
        };
      });
    }

    setPartner({
      ...partnerData,
      profiles: profilesRes.data || [],
      orders: ordersRes.data || [],
      clientDistributors,
      products: supplierProductsRes.data || [],
    });
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    setTab("overview");
    setInviteMsg(null);
    load();
  }, [load]);

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await fetch("/api/admin/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          partner_id: id,
          role: partner?.partner_type || "partner",
        }),
      });
      const result = await res.json();
      if (res.ok) {
        setInviteMsg("User invited successfully");
        setInviteEmail("");
        load();
      } else {
        setInviteMsg(result.error || "Failed to invite user");
      }
    } catch {
      setInviteMsg("Network error");
    }
    setInviting(false);
  };

  const handleMarkInactive = async () => {
    setMarkingInactive(true);
    await supabase.from("partners").update({ crm_status: "inactive" }).eq("id", id);
    await load();
    setMarkingInactive(false);
    onPartnerChanged?.();
  };

  const handleReactivate = async () => {
    setMarkingInactive(true);
    await supabase.from("partners").update({ crm_status: "customer" }).eq("id", id);
    await load();
    setMarkingInactive(false);
    onPartnerChanged?.();
  };

  if (loading) {
    return (
      <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
        <div className="mc-skeleton h-6 w-48 mb-4" />
        <div className="mc-skeleton h-8 w-32 mb-6" />
        <div className="mc-skeleton h-48 mb-4" />
        <div className="mc-skeleton h-32" />
      </div>
    );
  }

  if (!partner) return null;

  const isSupplier = partner.partner_type === "supplier";
  const isDistributor = partner.partner_type === "distributor";
  const isInactive = (partner.crm_status as CRMStatus | null) === "inactive";

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "users", label: "Users", count: partner.profiles.length },
    { id: "orders", label: "Orders", count: partner.orders.length },
    ...(isSupplier ? [{ id: "products" as Tab, label: "Products", count: partner.products.length }] : []),
    { id: "notes", label: "Notes" },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Panel header */}
      <div
        style={{
          padding: "16px 20px 0",
          borderBottom: "1px solid var(--mc-border)",
          flexShrink: 0,
        }}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(236, 223, 204, 0.06)", border: "1px solid var(--mc-border)" }}
            >
              {isDistributor ? (
                <Building2 className="w-4 h-4" style={{ color: "var(--mc-cream-subtle)" }} />
              ) : isSupplier ? (
                <Factory className="w-4 h-4" style={{ color: "var(--mc-cream-subtle)" }} />
              ) : (
                <User className="w-4 h-4" style={{ color: "var(--mc-cream-subtle)" }} />
              )}
            </div>
            <div>
              <h2
                className="text-sm font-semibold"
                style={{ color: "var(--mc-text-primary)", fontFamily: "var(--font-jost), Jost, sans-serif" }}
              >
                {partner.name}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="inline-flex px-1.5 py-0.5 text-[9px] font-medium tracking-wide uppercase"
                  style={{
                    background: isSupplier ? "var(--mc-success-bg)" : "var(--mc-info-bg)",
                    border: `1px solid ${isSupplier ? "var(--mc-success-light)" : "var(--mc-info-light)"}`,
                    color: isSupplier ? "var(--mc-success)" : "var(--mc-info)",
                  }}
                >
                  {PARTNER_TYPE_LABELS[partner.partner_type]}
                </span>
                {partner.is_mecanova && (
                  <span
                    className="inline-flex px-1.5 py-0.5 text-[9px] tracking-wide uppercase"
                    style={{
                      background: "var(--mc-surface-elevated)",
                      border: "1px solid var(--mc-border)",
                      color: "var(--mc-cream-subtle)",
                    }}
                  >
                    Mecanova
                  </span>
                )}
                {isInactive && (
                  <span
                    className="inline-flex px-1.5 py-0.5 text-[9px] tracking-wide uppercase"
                    style={{
                      background: "var(--mc-error-bg)",
                      border: "1px solid var(--mc-error-light)",
                      color: "var(--mc-error)",
                    }}
                  >
                    Inactive
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {isInactive ? (
              <button
                onClick={handleReactivate}
                disabled={markingInactive}
                className="mc-btn mc-btn-ghost"
                style={{ color: "var(--mc-success)", fontSize: "0.6875rem", padding: "4px 8px" }}
              >
                <EyeOff className="w-3 h-3" />
                {markingInactive ? "Saving…" : "Set Active"}
              </button>
            ) : (
              <button
                onClick={handleMarkInactive}
                disabled={markingInactive}
                className="mc-btn mc-btn-ghost"
                style={{ color: "var(--mc-text-muted)", fontSize: "0.6875rem", padding: "4px 8px" }}
              >
                <EyeOff className="w-3 h-3" />
                {markingInactive ? "Saving…" : "Mark Inactive"}
              </button>
            )}
            <Link
              href={`/partners/${id}/edit`}
              className="mc-btn mc-btn-ghost"
              style={{ fontSize: "0.6875rem", padding: "4px 8px" }}
            >
              <Edit className="w-3 h-3" />
              Edit
            </Link>
          </div>
        </div>

        {/* Tab strip */}
        <div className="flex" style={{ marginBottom: "-1px" }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: "none",
                border: "none",
                borderBottom: tab === t.id ? "2px solid var(--mc-cream)" : "2px solid transparent",
                color: tab === t.id ? "var(--mc-cream)" : "var(--mc-text-muted)",
                cursor: "pointer",
                padding: "6px 14px",
                fontSize: "0.6875rem",
                letterSpacing: "0.02em",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                transition: "color 0.15s",
              }}
            >
              {t.label}
              {t.count !== undefined && (
                <span
                  style={{
                    fontSize: "0.5625rem",
                    padding: "0 4px",
                    background: "var(--mc-surface-elevated)",
                    border: "1px solid var(--mc-border)",
                    color: "var(--mc-text-muted)",
                  }}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab body */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {tab === "overview" && (
          <div className="mc-card p-4">
            <h3
              className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-3"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Partner Details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <p className="mc-label">Address</p>
                <p className="text-xs flex items-center gap-1.5">
                  {partner.address ? (
                    <>
                      <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: "var(--mc-text-muted)" }} />
                      {partner.address}
                    </>
                  ) : (
                    <span style={{ color: "var(--mc-text-muted)" }}>Not set</span>
                  )}
                </p>
              </div>
              <div>
                <p className="mc-label">Country</p>
                <p className="text-xs flex items-center gap-1.5">
                  {partner.country ? (
                    <>
                      <MapPin className="w-3 h-3" style={{ color: "var(--mc-text-muted)" }} />
                      {partner.country}
                    </>
                  ) : (
                    <span style={{ color: "var(--mc-text-muted)" }}>Not set</span>
                  )}
                </p>
              </div>
              <div>
                <p className="mc-label">VAT ID</p>
                <p className="text-xs">
                  {partner.vat_id || <span style={{ color: "var(--mc-text-muted)" }}>Not set</span>}
                </p>
              </div>
              <div>
                <p className="mc-label">Contact Person</p>
                <p className="text-xs">
                  {partner.contact_person || <span style={{ color: "var(--mc-text-muted)" }}>Not set</span>}
                </p>
              </div>
              <div>
                <p className="mc-label">Position</p>
                <p className="text-xs">
                  {partner.contact_position || <span style={{ color: "var(--mc-text-muted)" }}>Not set</span>}
                </p>
              </div>
              <div>
                <p className="mc-label">Email</p>
                <p className="text-xs">
                  {partner.contact_email ? (
                    <a
                      href={`mailto:${partner.contact_email}`}
                      style={{ color: "var(--mc-info)", textDecoration: "none" }}
                    >
                      {partner.contact_email}
                    </a>
                  ) : (
                    <span style={{ color: "var(--mc-text-muted)" }}>Not set</span>
                  )}
                </p>
              </div>
              <div>
                <p className="mc-label">Phone</p>
                <p className="text-xs">
                  {partner.contact_phone ? (
                    <a
                      href={`tel:${partner.contact_phone}`}
                      style={{ color: "var(--mc-info)", textDecoration: "none" }}
                    >
                      {partner.contact_phone}
                    </a>
                  ) : (
                    <span style={{ color: "var(--mc-text-muted)" }}>Not set</span>
                  )}
                </p>
              </div>
              <div className="col-span-2">
                <p className="mc-label">Website</p>
                <p className="text-xs">
                  {partner.website ? (
                    <a
                      href={partner.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--mc-info)", textDecoration: "none" }}
                    >
                      {partner.website.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <span style={{ color: "var(--mc-text-muted)" }}>Not set</span>
                  )}
                </p>
              </div>
              <div>
                <p className="mc-label">Created</p>
                <p className="text-xs">
                  {new Date(partner.created_at).toLocaleDateString("en-GB")}
                </p>
              </div>
              {isDistributor && partner.capacity_status && (
                <div>
                  <p className="mc-label">Capacity</p>
                  <span
                    className="text-[9px] tracking-wider uppercase px-1.5 py-0.5"
                    style={{
                      background:
                        partner.capacity_status === "open"
                          ? "var(--mc-success-bg)"
                          : partner.capacity_status === "limited"
                          ? "var(--mc-warning-bg)"
                          : "var(--mc-error-bg)",
                      border: `1px solid ${
                        partner.capacity_status === "open"
                          ? "var(--mc-success-light)"
                          : partner.capacity_status === "limited"
                          ? "var(--mc-warning-light)"
                          : "var(--mc-error-light)"
                      }`,
                      color:
                        partner.capacity_status === "open"
                          ? "var(--mc-success)"
                          : partner.capacity_status === "limited"
                          ? "var(--mc-warning)"
                          : "var(--mc-error)",
                    }}
                  >
                    {CAPACITY_STATUS_LABELS[partner.capacity_status as keyof typeof CAPACITY_STATUS_LABELS]}
                  </span>
                </div>
              )}
              {isDistributor && partner.service_countries && partner.service_countries.length > 0 && (
                <div className="col-span-2">
                  <p className="mc-label">Service Countries</p>
                  <p className="text-xs flex items-center gap-1.5">
                    <Globe className="w-3 h-3" style={{ color: "var(--mc-text-muted)" }} />
                    {partner.service_countries.join(", ")}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "users" && (
          <div className="mc-card p-4">
            <h3
              className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-3"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Users ({partner.profiles.length})
            </h3>
            {partner.profiles.length === 0 ? (
              <p className="text-xs mb-4" style={{ color: "var(--mc-text-muted)" }}>
                No users linked
              </p>
            ) : (
              <div className="space-y-2 mb-4">
                {partner.profiles.map((profile) => (
                  <div key={profile.user_id} className="flex items-center gap-2 py-1.5">
                    <Mail className="w-3 h-3 flex-shrink-0" style={{ color: "var(--mc-text-muted)" }} />
                    <span className="text-xs truncate">
                      {profile.full_name || profile.user_id.slice(0, 8)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-4" style={{ borderTop: "1px solid var(--mc-border)" }}>
              <p className="mc-label">Invite User</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="mc-input flex-1"
                  placeholder="email@example.com"
                />
                <button
                  onClick={handleInviteUser}
                  disabled={inviting || !inviteEmail.trim()}
                  className="mc-btn mc-btn-primary flex-shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
              </div>
              {inviteMsg && (
                <p
                  className="text-[10px] mt-2"
                  style={{
                    color: inviteMsg.includes("success") ? "var(--mc-success)" : "var(--mc-error)",
                  }}
                >
                  {inviteMsg}
                </p>
              )}
            </div>
          </div>
        )}

        {tab === "orders" && (
          <div className="mc-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3
                className="text-[10px] font-semibold tracking-[0.08em] uppercase"
                style={{ color: "var(--mc-text-muted)" }}
              >
                Recent Orders ({partner.orders.length})
              </h3>
              <ClipboardList className="w-4 h-4" style={{ color: "var(--mc-text-muted)" }} />
            </div>
            {partner.orders.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
                No orders yet
              </p>
            ) : (
              <div className="space-y-1">
                {partner.orders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="flex items-center justify-between py-2 px-3 transition-colors"
                    style={{ background: "transparent" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--mc-surface-elevated)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <span className="text-xs font-mono" style={{ color: "var(--mc-text-secondary)" }}>
                      {order.id.slice(0, 8)}
                    </span>
                    <StatusBadge status={order.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "products" && isSupplier && (
          <div className="mc-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3
                className="text-[10px] font-semibold tracking-[0.08em] uppercase"
                style={{ color: "var(--mc-text-muted)" }}
              >
                Supplied Products ({partner.products.length})
              </h3>
              <Link
                href={`/products/new?supplier=${id}`}
                className="mc-btn mc-btn-ghost"
                style={{ padding: "3px 8px", fontSize: "0.6875rem" }}
              >
                <Package className="w-3 h-3" />
                Add Product
              </Link>
            </div>
            {partner.products.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
                No products linked to this supplier yet
              </p>
            ) : (
              <div className="space-y-1">
                {partner.products.map((prod) => (
                  <Link
                    key={prod.id}
                    href={`/products/${prod.id}`}
                    className="flex items-center gap-2 py-1.5 text-xs transition-colors"
                    style={{ color: "var(--mc-text-secondary)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-text-secondary)")}
                  >
                    <Package className="w-3 h-3 flex-shrink-0" />
                    {prod.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "notes" && (
          <div className="mc-card p-4">
            <h3
              className="text-[10px] font-semibold tracking-[0.08em] uppercase mb-3"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Notes
            </h3>
            {partner.notes ? (
              <p
                className="text-sm"
                style={{ color: "var(--mc-text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}
              >
                {partner.notes}
              </p>
            ) : (
              <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
                No notes yet —{" "}
                <Link href={`/partners/${id}/edit`} style={{ color: "var(--mc-cream)" }}>
                  add one in edit
                </Link>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
