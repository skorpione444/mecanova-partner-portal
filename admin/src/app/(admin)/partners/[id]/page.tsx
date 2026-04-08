"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import type { Partner, Profile, OrderRequest, CRMStatus } from "@mecanova/shared";
import {
  PARTNER_TYPE_LABELS,
  CAPACITY_STATUS_LABELS,
} from "@mecanova/shared";
import {
  ArrowLeft,
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

export default function PartnerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [partner, setPartner] = useState<PartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [markingInactive, setMarkingInactive] = useState(false);

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: partnerData } = await supabase
      .from("partners")
      .select("*")
      .eq("id", id)
      .single();

    if (!partnerData) {
      router.push("/partners");
      return;
    }

    const [profilesRes, ordersRes, cdRes, supplierProductsRes] =
      await Promise.all([
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
          ? supabase
              .from("products")
              .select("id, name")
              .eq("supplier_id", id)
              .order("name")
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      ]);

    // Resolve partner names for relationships
    const relatedIds =
      partnerData.partner_type === "distributor"
        ? (cdRes.data || []).map(
            (r: { client_id?: string }) => r.client_id || ""
          )
        : (cdRes.data || []).map(
            (r: { distributor_id?: string }) => r.distributor_id || ""
          );

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
            ? (cdRes.data || []).find(
                (r: any) => r.client_id === p.id
              )
            : (cdRes.data || []).find(
                (r: any) => r.distributor_id === p.id
              );
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
    await supabase
      .from("partners")
      .update({ crm_status: "inactive" })
      .eq("id", id);
    await load();
    setMarkingInactive(false);
  };

  const handleReactivate = async () => {
    setMarkingInactive(true);
    await supabase
      .from("partners")
      .update({ crm_status: "customer" })
      .eq("id", id);
    await load();
    setMarkingInactive(false);
  };

  if (loading) {
    return (
      <div>
        <div className="mc-skeleton h-6 w-48 mb-6" />
        <div className="mc-skeleton h-48 mb-4" />
        <div className="mc-skeleton h-32" />
      </div>
    );
  }

  if (!partner) return null;

  return (
    <div>
      <Link
        href="/partners"
        className="inline-flex items-center gap-1.5 text-[11px] tracking-wide mb-4 transition-colors"
        style={{ color: "var(--mc-text-muted)" }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.color = "var(--mc-cream)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.color = "var(--mc-text-muted)")
        }
      >
        <ArrowLeft className="w-3 h-3" />
        Back to Partners
      </Link>

      <PageHeader
        title={partner.name}
        description={PARTNER_TYPE_LABELS[partner.partner_type]}
        icon={
          partner.partner_type === "distributor"
            ? Building2
            : partner.partner_type === "supplier"
            ? Factory
            : User
        }
        actions={
          <div className="flex gap-2">
            {(partner.crm_status as CRMStatus | null) === "inactive" ? (
              <button
                onClick={handleReactivate}
                disabled={markingInactive}
                className="mc-btn mc-btn-ghost"
                style={{ color: "var(--mc-success)" }}
              >
                <EyeOff className="w-3.5 h-3.5" />
                {markingInactive ? "Saving…" : "Set Active"}
              </button>
            ) : (
              <button
                onClick={handleMarkInactive}
                disabled={markingInactive}
                className="mc-btn mc-btn-ghost"
                style={{ color: "var(--mc-text-muted)" }}
              >
                <EyeOff className="w-3.5 h-3.5" />
                {markingInactive ? "Saving…" : "Mark Inactive"}
              </button>
            )}
            <Link
              href={`/partners/${id}/edit`}
              className="mc-btn mc-btn-ghost"
            >
              <Edit className="w-3.5 h-3.5" />
              Edit
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Partner Info */}
        <div className="lg:col-span-2 space-y-5">
          {/* Details */}
          <div className="mc-card p-5">
            <h3
              className="text-xs font-semibold tracking-[0.08em] uppercase mb-4"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Partner Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="mc-label">Country</p>
                <p className="text-sm flex items-center gap-1.5">
                  {partner.country ? (
                    <>
                      <MapPin
                        className="w-3 h-3"
                        style={{ color: "var(--mc-text-muted)" }}
                      />
                      {partner.country}
                    </>
                  ) : (
                    <span style={{ color: "var(--mc-text-muted)" }}>
                      Not set
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="mc-label">VAT ID</p>
                <p className="text-sm">
                  {partner.vat_id || (
                    <span style={{ color: "var(--mc-text-muted)" }}>
                      Not set
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="mc-label">Billing Address</p>
                <p className="text-sm">
                  {partner.billing_address ? (
                    JSON.stringify(partner.billing_address)
                  ) : (
                    <span style={{ color: "var(--mc-text-muted)" }}>
                      Not set
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="mc-label">Delivery Address</p>
                <p className="text-sm">
                  {partner.shipping_address ? (
                    JSON.stringify(partner.shipping_address)
                  ) : (
                    <span style={{ color: "var(--mc-text-muted)" }}>
                      Not set
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="mc-label">Created</p>
                <p className="text-sm">
                  {new Date(partner.created_at).toLocaleDateString("en-GB")}
                </p>
              </div>


              {partner.partner_type === "distributor" && (
                <>
                  <div>
                    <p className="mc-label">Capacity</p>
                    <p className="text-sm">
                      {partner.capacity_status ? (
                        <span
                          className="text-[9px] tracking-wider uppercase px-1.5 py-0.5"
                          style={{
                            background: partner.capacity_status === "open" ? "var(--mc-success-bg)" : partner.capacity_status === "limited" ? "var(--mc-warning-bg)" : "var(--mc-error-bg)",
                            border: `1px solid ${partner.capacity_status === "open" ? "var(--mc-success-light)" : partner.capacity_status === "limited" ? "var(--mc-warning-light)" : "var(--mc-error-light)"}`,
                            color: partner.capacity_status === "open" ? "var(--mc-success)" : partner.capacity_status === "limited" ? "var(--mc-warning)" : "var(--mc-error)",
                          }}
                        >
                          {CAPACITY_STATUS_LABELS[partner.capacity_status as keyof typeof CAPACITY_STATUS_LABELS]}
                        </span>
                      ) : (
                        <span style={{ color: "var(--mc-text-muted)" }}>Not set</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="mc-label">Service Countries</p>
                    <p className="text-sm flex items-center gap-1.5">
                      {partner.service_countries && partner.service_countries.length > 0 ? (
                        <>
                          <Globe className="w-3 h-3" style={{ color: "var(--mc-text-muted)" }} />
                          {partner.service_countries.join(", ")}
                        </>
                      ) : (
                        <span style={{ color: "var(--mc-text-muted)" }}>Not set</span>
                      )}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Recent Orders */}
          <div className="mc-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3
                className="text-xs font-semibold tracking-[0.08em] uppercase"
                style={{ color: "var(--mc-text-muted)" }}
              >
                Recent Orders ({partner.orders.length})
              </h3>
              <ClipboardList
                className="w-4 h-4"
                style={{ color: "var(--mc-text-muted)" }}
              />
            </div>
            {partner.orders.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
                No orders yet
              </p>
            ) : (
              <div className="space-y-2">
                {partner.orders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="flex items-center justify-between py-2 px-3 transition-colors"
                    style={{ background: "transparent" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "var(--mc-surface-elevated)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <span
                      className="text-xs font-mono"
                      style={{ color: "var(--mc-text-secondary)" }}
                    >
                      {order.id.slice(0, 8)}
                    </span>
                    <StatusBadge status={order.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Users */}
          <div className="mc-card p-5">
            <h3
              className="text-xs font-semibold tracking-[0.08em] uppercase mb-4"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Users ({partner.profiles.length})
            </h3>
            {partner.profiles.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
                No users linked
              </p>
            ) : (
              <div className="space-y-2">
                {partner.profiles.map((profile) => (
                  <div
                    key={profile.user_id}
                    className="flex items-center gap-2 py-1.5"
                  >
                    <Mail
                      className="w-3 h-3 flex-shrink-0"
                      style={{ color: "var(--mc-text-muted)" }}
                    />
                    <span className="text-xs truncate">
                      {profile.full_name || profile.user_id.slice(0, 8)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Invite user */}
            <div
              className="mt-4 pt-4"
              style={{ borderTop: "1px solid var(--mc-border)" }}
            >
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
                    color: inviteMsg.includes("success")
                      ? "var(--mc-success)"
                      : "var(--mc-error)",
                  }}
                >
                  {inviteMsg}
                </p>
              )}
            </div>
          </div>

          {/* Supplied Products (for suppliers only) */}
          {partner.partner_type === "supplier" && (
            <div className="mc-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3
                  className="text-xs font-semibold tracking-[0.08em] uppercase"
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
                <div className="space-y-2">
                  {partner.products.map((prod) => (
                    <Link
                      key={prod.id}
                      href={`/products/${prod.id}`}
                      className="flex items-center gap-2 py-1.5 text-xs transition-colors"
                      style={{ color: "var(--mc-text-secondary)" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "var(--mc-cream)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color =
                          "var(--mc-text-secondary)")
                      }
                    >
                      <Package className="w-3 h-3 flex-shrink-0" />
                      {prod.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
