"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import type { Partner, Profile, OrderRequest } from "@mecanova/shared";
import {
  PARTNER_TYPE_LABELS,
  CONTRACT_TYPE_LABELS,
  CLIENT_TIER_LABELS,
  CAPACITY_STATUS_LABELS,
  CONTRACT_TYPES,
} from "@mecanova/shared";
import type { ContractType } from "@mecanova/shared";
import {
  Users,
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
  Plus,
  X,
  Star,
  Lock,
  Globe,
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

  // Relationship management state
  const [availablePartners, setAvailablePartners] = useState<
    { id: string; name: string }[]
  >([]);
  const [selectedRelId, setSelectedRelId] = useState("");
  const [newContractType, setNewContractType] = useState<ContractType>("allowed");
  const [newAssignmentReason, setNewAssignmentReason] = useState("");
  const [newAssignmentLocked, setNewAssignmentLocked] = useState(false);
  const [savingRel, setSavingRel] = useState(false);
  const [relMsg, setRelMsg] = useState<string | null>(null);

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

    // Load available partners to link (opposite type, not yet linked)
    const oppositeType =
      partnerData.partner_type === "distributor" ? "client" : "distributor";
    if (partnerData.partner_type !== "supplier") {
      const { data: allOpposite } = await supabase
        .from("partners")
        .select("id, name")
        .eq("partner_type", oppositeType)
        .order("name");

      const linkedIds = new Set(relatedIds);
      setAvailablePartners(
        (allOpposite || []).filter((p) => !linkedIds.has(p.id))
      );
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

  const handleAddRelationship = async () => {
    if (!selectedRelId || !partner) return;
    setSavingRel(true);
    setRelMsg(null);

    const isDistributor = partner.partner_type === "distributor";
    const isFirstLink = partner.clientDistributors.length === 0;

    const { error } = await supabase.from("client_distributors").insert({
      distributor_id: isDistributor ? id : selectedRelId,
      client_id: isDistributor ? selectedRelId : id,
      is_default: isFirstLink,
      contract_type: newContractType,
      assignment_locked: newAssignmentLocked,
      assignment_reason: newAssignmentReason.trim() || null,
    });

    if (error) {
      setRelMsg(error.message);
    } else {
      setSelectedRelId("");
      setNewContractType("allowed");
      setNewAssignmentReason("");
      setNewAssignmentLocked(false);
      await load();
    }

    setSavingRel(false);
  };

  const handleRemoveRelationship = async (relPartnerId: string) => {
    if (!partner) return;
    setSavingRel(true);
    setRelMsg(null);

    const isDistributor = partner.partner_type === "distributor";

    const { error } = await supabase
      .from("client_distributors")
      .delete()
      .eq(isDistributor ? "distributor_id" : "client_id", id)
      .eq(isDistributor ? "client_id" : "distributor_id", relPartnerId);

    if (error) {
      setRelMsg(error.message);
    } else {
      await load();
    }

    setSavingRel(false);
  };

  const handleSetDefault = async (relPartnerId: string) => {
    if (!partner) return;
    setSavingRel(true);

    // For a client, set is_default=false on all their distributor links, then true on the selected one
    // For a distributor, set is_default=false on all their client links, then true on the selected one
    const isDistributor = partner.partner_type === "distributor";

    // Reset all
    await supabase
      .from("client_distributors")
      .update({ is_default: false })
      .eq(isDistributor ? "distributor_id" : "client_id", id);

    // Set chosen as default
    const { error } = await supabase
      .from("client_distributors")
      .update({
        is_default: true,
        assignment_reason: `Set as default by admin on ${new Date().toISOString().slice(0, 10)}`,
      })
      .eq(isDistributor ? "distributor_id" : "client_id", id)
      .eq(isDistributor ? "client_id" : "distributor_id", relPartnerId);

    if (error) {
      setRelMsg(error.message);
    } else {
      await load();
    }

    setSavingRel(false);
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

  const relLabel =
    partner.partner_type === "distributor" ? "Linked Buyers" : "Linked Distributors";
  const addLabel =
    partner.partner_type === "distributor"
      ? "Link a buyer..."
      : "Link a distributor...";

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
          <Link
            href={`/partners/${id}/edit`}
            className="mc-btn mc-btn-ghost"
          >
            <Edit className="w-3.5 h-3.5" />
            Edit
          </Link>
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
                <p className="mc-label">Shipping Address</p>
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

              {partner.partner_type === "client" && (
                <div>
                  <p className="mc-label">Client Tier</p>
                  <p className="text-sm">
                    {partner.client_tier ? (
                      <span
                        className="text-[9px] tracking-wider uppercase px-1.5 py-0.5"
                        style={{
                          background: partner.client_tier === "A" ? "var(--mc-success-bg)" : partner.client_tier === "B" ? "var(--mc-warning-bg)" : "var(--mc-surface-elevated)",
                          border: `1px solid ${partner.client_tier === "A" ? "var(--mc-success-light)" : partner.client_tier === "B" ? "var(--mc-warning-light)" : "var(--mc-border)"}`,
                          color: partner.client_tier === "A" ? "var(--mc-success)" : partner.client_tier === "B" ? "var(--mc-warning)" : "var(--mc-text-muted)",
                        }}
                      >
                        {CLIENT_TIER_LABELS[partner.client_tier as keyof typeof CLIENT_TIER_LABELS]}
                      </span>
                    ) : (
                      <span style={{ color: "var(--mc-text-muted)" }}>Not set</span>
                    )}
                  </p>
                </div>
              )}

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
              <h3
                className="text-xs font-semibold tracking-[0.08em] uppercase mb-4"
                style={{ color: "var(--mc-text-muted)" }}
              >
                Supplied Products ({partner.products.length})
              </h3>
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

          {/* Relationships — interactive for distributors and clients */}
          {partner.partner_type !== "supplier" && (
            <div className="mc-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3
                  className="text-xs font-semibold tracking-[0.08em] uppercase"
                  style={{ color: "var(--mc-text-muted)" }}
                >
                  {relLabel} ({partner.clientDistributors.length})
                </h3>
                <Users
                  className="w-3.5 h-3.5"
                  style={{ color: "var(--mc-text-muted)" }}
                />
              </div>

              {/* Linked partners list */}
              {partner.clientDistributors.length === 0 ? (
                <p
                  className="text-xs mb-4"
                  style={{ color: "var(--mc-text-muted)" }}
                >
                  No relationships configured
                </p>
              ) : (
                <div className="space-y-1 mb-4">
                  {partner.clientDistributors.map((rel) => (
                    <div
                      key={rel.partner_id}
                      className="py-2 px-2 rounded-sm group"
                      style={{ background: "var(--mc-surface-elevated)" }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <Link
                            href={`/partners/${rel.partner_id}`}
                            className="text-xs truncate transition-colors"
                            style={{ color: "var(--mc-text-secondary)" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.color = "var(--mc-cream)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.color =
                                "var(--mc-text-secondary)")
                            }
                          >
                            {rel.partner_name}
                          </Link>
                          {rel.is_default && (
                            <span
                              className="text-[9px] tracking-wider uppercase px-1 py-0.5 flex-shrink-0"
                              style={{
                                background: "var(--mc-warning-bg)",
                                border: "1px solid var(--mc-warning-light)",
                                color: "var(--mc-warning)",
                              }}
                            >
                              Default
                            </span>
                          )}
                          <span
                            className="text-[9px] tracking-wider uppercase px-1 py-0.5 flex-shrink-0"
                            style={{
                              background: rel.contract_type === "exclusive" ? "var(--mc-error-bg)" : rel.contract_type === "preferred" ? "var(--mc-info-bg)" : "var(--mc-surface-elevated)",
                              border: `1px solid ${rel.contract_type === "exclusive" ? "var(--mc-error-light)" : rel.contract_type === "preferred" ? "var(--mc-info-light)" : "var(--mc-border)"}`,
                              color: rel.contract_type === "exclusive" ? "var(--mc-error)" : rel.contract_type === "preferred" ? "var(--mc-info)" : "var(--mc-text-muted)",
                            }}
                          >
                            {CONTRACT_TYPE_LABELS[rel.contract_type as keyof typeof CONTRACT_TYPE_LABELS] || rel.contract_type}
                          </span>
                          {rel.assignment_locked && (
                            <span title="Assignment locked">
                              <Lock
                                className="w-3 h-3 flex-shrink-0"
                                style={{ color: "var(--mc-warning)" }}
                              />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!rel.is_default && (
                            <button
                              onClick={() => handleSetDefault(rel.partner_id)}
                              disabled={savingRel}
                              title="Set as default"
                              className="p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ color: "var(--mc-text-muted)" }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.color = "var(--mc-warning)")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.color =
                                  "var(--mc-text-muted)")
                              }
                            >
                              <Star className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveRelationship(rel.partner_id)}
                            disabled={savingRel}
                            title="Remove link"
                            className="p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: "var(--mc-text-muted)" }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.color = "var(--mc-error)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.color = "var(--mc-text-muted)")
                            }
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {rel.assignment_reason && (
                        <p
                          className="text-[10px] mt-1 pl-0.5"
                          style={{ color: "var(--mc-text-muted)" }}
                        >
                          {rel.assignment_reason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add relationship */}
              {availablePartners.length > 0 && (
                <div
                  className="pt-3 space-y-2"
                  style={{ borderTop: "1px solid var(--mc-border)" }}
                >
                  <p className="mc-label">Link partner</p>
                  <div className="flex gap-2">
                    <select
                      value={selectedRelId}
                      onChange={(e) => setSelectedRelId(e.target.value)}
                      className="mc-input mc-select flex-1"
                    >
                      <option value="">{addLabel}</option>
                      {availablePartners.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddRelationship}
                      disabled={savingRel || !selectedRelId}
                      className="mc-btn mc-btn-primary flex-shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {selectedRelId && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <select
                          value={newContractType}
                          onChange={(e) => setNewContractType(e.target.value as ContractType)}
                          className="mc-input mc-select flex-1"
                        >
                          {CONTRACT_TYPES.map((ct) => (
                            <option key={ct} value={ct}>
                              {CONTRACT_TYPE_LABELS[ct]}
                            </option>
                          ))}
                        </select>
                        <label
                          className="flex items-center gap-1.5 text-[10px] flex-shrink-0 cursor-pointer"
                          style={{ color: "var(--mc-text-muted)" }}
                        >
                          <input
                            type="checkbox"
                            checked={newAssignmentLocked}
                            onChange={(e) => setNewAssignmentLocked(e.target.checked)}
                          />
                          <Lock className="w-3 h-3" />
                          Lock
                        </label>
                      </div>
                      <input
                        type="text"
                        value={newAssignmentReason}
                        onChange={(e) => setNewAssignmentReason(e.target.value)}
                        className="mc-input"
                        placeholder="Why this link? (optional)"
                      />
                    </div>
                  )}
                </div>
              )}

              {availablePartners.length === 0 &&
                partner.clientDistributors.length > 0 && (
                  <p
                    className="text-[10px] pt-3"
                    style={{
                      borderTop: "1px solid var(--mc-border)",
                      color: "var(--mc-text-muted)",
                    }}
                  >
                    All available{" "}
                    {partner.partner_type === "distributor"
                      ? "buyers"
                      : "distributors"}{" "}
                    are already linked.
                  </p>
                )}

              {relMsg && (
                <p
                  className="text-[10px] mt-2"
                  style={{ color: "var(--mc-error)" }}
                >
                  {relMsg}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
