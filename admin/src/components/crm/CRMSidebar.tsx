"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Phone, Globe, MapPin, Building2, ArrowRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Partner, Prospect, CRMInteraction, CRMStatus } from "@mecanova/shared";
import type { GooglePlaceResult } from "./MapView";
import StatusPill from "./StatusPill";
import InteractionLog from "./InteractionLog";
import AddInteractionForm from "./AddInteractionForm";

type SidebarEntity =
  | { type: "prospect"; data: Prospect }
  | { type: "partner"; data: Partner }
  | { type: "place"; data: GooglePlaceResult };

interface CRMSidebarProps {
  entity: SidebarEntity | null;
  userId: string;
  onClose: () => void;
  onProspectUpdated: (updated: Prospect) => void;
  onPartnerUpdated: (updated: Partner) => void;
  onPartnerDeleted: (id: string) => void;
  onAddProspect: (place: GooglePlaceResult) => Promise<void>;
  onConvertClick: (prospect: Prospect) => void;
}

const CRM_STATUSES: CRMStatus[] = [
  "uncontacted",
  "contacted",
  "negotiating",
  "customer",
  "inactive",
];

export default function CRMSidebar({
  entity,
  userId,
  onClose,
  onProspectUpdated,
  onPartnerUpdated,
  onPartnerDeleted,
  onAddProspect,
  onConvertClick,
}: CRMSidebarProps) {
  const [interactions, setInteractions] = useState<CRMInteraction[]>([]);
  const [loadingInteractions, setLoadingInteractions] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [addingProspect, setAddingProspect] = useState(false);

  const supabase = createClient();

  const fetchInteractions = useCallback(async () => {
    if (!entity || entity.type === "place") return;

    setLoadingInteractions(true);
    const column =
      entity.type === "prospect" ? "prospect_id" : "partner_id";
    const id =
      entity.type === "prospect" ? entity.data.id : entity.data.id;

    const { data } = await supabase
      .from("crm_interactions")
      .select("*")
      .eq(column, id)
      .order("occurred_at", { ascending: false });

    setInteractions(data ?? []);
    setLoadingInteractions(false);
  }, [entity, supabase]);

  useEffect(() => {
    fetchInteractions();
  }, [fetchInteractions]);

  const handleStatusChange = async (newStatus: CRMStatus) => {
    if (!entity || entity.type === "place") return;

    // Changing a prospect to "customer" means converting — open the modal instead
    if (newStatus === "customer" && entity.type === "prospect" && !entity.data.converted_to_partner_id) {
      onConvertClick(entity.data as Prospect);
      return;
    }

    // Downgrading a partner to any non-customer/non-inactive status = undo the conversion.
    // Restore the linked prospect (if any), then delete the partner row.
    if (entity.type === "partner" && newStatus !== "customer" && newStatus !== "inactive") {
      setSavingStatus(true);
      const partnerId = entity.data.id;

      // Find prospect that was converted to this partner
      const { data: linkedProspect } = await supabase
        .from("prospects")
        .select("id")
        .eq("converted_to_partner_id", partnerId)
        .maybeSingle();

      if (linkedProspect) {
        // Restore prospect status and unlink
        await supabase
          .from("prospects")
          .update({ converted_to_partner_id: null, crm_status: newStatus })
          .eq("id", linkedProspect.id);
      }

      // Delete the partner
      await supabase.from("partners").delete().eq("id", partnerId);
      onPartnerDeleted(partnerId);
      onClose();
      setSavingStatus(false);
      return;
    }

    setSavingStatus(true);
    const table = entity.type === "prospect" ? "prospects" : "partners";
    const { data, error } = await supabase
      .from(table)
      .update({ crm_status: newStatus })
      .eq("id", entity.data.id)
      .select()
      .single();

    if (!error && data) {
      if (entity.type === "prospect") {
        onProspectUpdated(data as Prospect);
      } else if (entity.type === "partner") {
        onPartnerUpdated(data as Partner);
      }
    }
    setSavingStatus(false);
  };

  const handleDeleteInteraction = async (interactionId: string) => {
    await supabase.from("crm_interactions").delete().eq("id", interactionId);
    await fetchInteractions();
  };

  const handleAddProspect = async () => {
    if (!entity || entity.type !== "place") return;
    setAddingProspect(true);
    await onAddProspect(entity.data);
    setAddingProspect(false);
  };

  if (!entity) return null;

  const currentStatus: CRMStatus | null =
    entity.type === "prospect"
      ? entity.data.crm_status
      : entity.type === "partner"
      ? entity.data.crm_status ?? "customer"
      : null;

  return (
    <aside
      style={{
        width: 420,
        flexShrink: 0,
        height: "100%",
        background: "var(--mc-surface-warm)",
        borderLeft: "1px solid var(--mc-border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--mc-border)",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: "0.6rem",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--mc-text-muted)",
                background: "var(--mc-graphite)",
                padding: "2px 6px",
                border: "1px solid var(--mc-border)",
              }}
            >
              {entity.type === "place"
                ? "Discovery"
                : entity.type === "partner"
                ? "Partner"
                : "Prospect"}
            </span>
            {currentStatus && (
              <StatusPill status={currentStatus} size="sm" />
            )}
          </div>
          <h2
            style={{
              fontSize: "1rem",
              fontWeight: 500,
              color: "var(--mc-text-primary)",
              fontFamily: "var(--font-jost), Jost, sans-serif",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {entity.type === "place"
              ? entity.data.name
              : entity.data.name}
          </h2>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--mc-text-muted)",
            padding: 4,
            lineHeight: 0,
            flexShrink: 0,
          }}
        >
          <X style={{ width: 16, height: 16 }} strokeWidth={1.5} />
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {/* Details */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 20,
          }}
        >
          {(entity.type === "prospect" || entity.type === "place") &&
            (() => {
              const d = entity.data;
              const address =
                entity.type === "prospect" ? d.address : d.address;
              const phone =
                entity.type === "prospect"
                  ? (d as Prospect).contact_phone
                  : (d as GooglePlaceResult).phone;
              const website =
                entity.type === "place"
                  ? (d as GooglePlaceResult).website
                  : null;

              return (
                <>
                  {address && (
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <MapPin
                        style={{ width: 13, height: 13, color: "var(--mc-text-muted)", marginTop: 1, flexShrink: 0 }}
                        strokeWidth={1.5}
                      />
                      <span style={{ fontSize: "0.8125rem", color: "var(--mc-text-secondary)" }}>
                        {address}
                      </span>
                    </div>
                  )}
                  {phone && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Phone style={{ width: 13, height: 13, color: "var(--mc-text-muted)", flexShrink: 0 }} strokeWidth={1.5} />
                      <a
                        href={`tel:${phone}`}
                        style={{ fontSize: "0.8125rem", color: "var(--mc-info)", textDecoration: "none" }}
                      >
                        {phone}
                      </a>
                    </div>
                  )}
                  {website && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Globe style={{ width: 13, height: 13, color: "var(--mc-text-muted)", flexShrink: 0 }} strokeWidth={1.5} />
                      <a
                        href={website}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: "0.8125rem", color: "var(--mc-info)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {website.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  )}
                  {entity.type === "prospect" && (entity.data as Prospect).contact_person && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Building2 style={{ width: 13, height: 13, color: "var(--mc-text-muted)", flexShrink: 0 }} strokeWidth={1.5} />
                      <span style={{ fontSize: "0.8125rem", color: "var(--mc-text-secondary)" }}>
                        {(entity.data as Prospect).contact_person}
                      </span>
                    </div>
                  )}
                </>
              );
            })()}

          {entity.type === "partner" && (
            <>
              {entity.data.contact_person && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Building2 style={{ width: 13, height: 13, color: "var(--mc-text-muted)", flexShrink: 0 }} strokeWidth={1.5} />
                  <span style={{ fontSize: "0.8125rem", color: "var(--mc-text-secondary)" }}>
                    {entity.data.contact_person}
                  </span>
                </div>
              )}
              {entity.data.contact_phone && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Phone style={{ width: 13, height: 13, color: "var(--mc-text-muted)", flexShrink: 0 }} strokeWidth={1.5} />
                  <a
                    href={`tel:${entity.data.contact_phone}`}
                    style={{ fontSize: "0.8125rem", color: "var(--mc-info)", textDecoration: "none" }}
                  >
                    {entity.data.contact_phone}
                  </a>
                </div>
              )}
            </>
          )}
        </div>

        {/* Notes (prospects only) */}
        {entity.type === "prospect" && entity.data.notes && (
          <div
            style={{
              padding: "10px 12px",
              background: "var(--mc-graphite)",
              border: "1px solid var(--mc-border)",
              marginBottom: 20,
            }}
          >
            <p
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                color: "var(--mc-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 4,
              }}
            >
              Notes
            </p>
            <p style={{ fontSize: "0.8125rem", color: "var(--mc-text-secondary)", lineHeight: 1.5 }}>
              {entity.data.notes}
            </p>
          </div>
        )}

        {/* Google Place — Add as Prospect */}
        {entity.type === "place" && (
          <button
            onClick={handleAddProspect}
            disabled={addingProspect}
            className="mc-btn mc-btn-primary"
            style={{ width: "100%", marginBottom: 16 }}
          >
            {addingProspect ? (
              <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
            ) : (
              <>
                Add as Prospect
                <ArrowRight style={{ width: 14, height: 14 }} strokeWidth={1.5} />
              </>
            )}
          </button>
        )}

        {/* Status changer (prospect/partner) */}
        {entity.type !== "place" && currentStatus && (
          <div style={{ marginBottom: 20 }}>
            <p className="mc-label" style={{ marginBottom: 8 }}>
              CRM Status
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {CRM_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={savingStatus || s === currentStatus}
                  style={{
                    padding: "4px 10px",
                    fontSize: "0.6875rem",
                    fontWeight: 500,
                    cursor: s === currentStatus ? "default" : "pointer",
                    border: "1px solid",
                    borderColor:
                      s === currentStatus ? "var(--mc-cream)" : "var(--mc-border)",
                    background:
                      s === currentStatus
                        ? "rgba(236,223,204,0.08)"
                        : "transparent",
                    color:
                      s === currentStatus
                        ? "var(--mc-cream)"
                        : "var(--mc-text-muted)",
                    opacity: savingStatus ? 0.5 : 1,
                    transition: "all 0.15s ease",
                    textTransform: "capitalize",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Convert to Partner (prospects only, not yet converted) */}
        {entity.type === "prospect" &&
          !entity.data.converted_to_partner_id && (
            <button
              onClick={() => onConvertClick(entity.data as Prospect)}
              className="mc-btn mc-btn-ghost"
              style={{ width: "100%", marginBottom: 20 }}
            >
              Convert to Partner
              <ArrowRight style={{ width: 13, height: 13 }} strokeWidth={1.5} />
            </button>
          )}

        {/* Interaction log (prospect/partner) */}
        {entity.type !== "place" && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <p className="mc-label" style={{ margin: 0 }}>
                Interactions
              </p>
              {loadingInteractions && (
                <Loader2
                  style={{ width: 12, height: 12, color: "var(--mc-text-muted)" }}
                  className="animate-spin"
                />
              )}
            </div>

            <InteractionLog interactions={interactions} onDelete={handleDeleteInteraction} />

            <div
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: "1px solid var(--mc-border)",
              }}
            >
              <p className="mc-label" style={{ marginBottom: 10 }}>
                Log Interaction
              </p>
              <AddInteractionForm
                entityType={entity.type}
                entityId={entity.data.id}
                userId={userId}
                onAdded={fetchInteractions}
              />
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
