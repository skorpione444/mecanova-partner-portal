"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Phone, Globe, MapPin, Building2, ArrowRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Partner, Prospect, CRMInteraction, CRMStatus, PartnerType } from "@mecanova/shared";
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
  onAddProspect: (place: GooglePlaceResult, prospectType: PartnerType) => Promise<void>;
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
  const [notesValue, setNotesValue] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [prospectType, setProspectType] = useState<PartnerType>("client");
  const [savingProspectType, setSavingProspectType] = useState(false);

  const supabase = createClient();

  // Sync notes + prospect type when entity changes
  useEffect(() => {
    if (!entity || entity.type === "place") return;
    setNotesValue(entity.data.notes ?? "");
    if (entity.type === "prospect") {
      setProspectType(entity.data.prospect_type ?? "client");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity?.type === "place" ? null : entity?.data?.id]);

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
    await onAddProspect(entity.data, prospectType);
    setAddingProspect(false);
  };

  const handleSaveProspectType = async (newType: PartnerType) => {
    if (!entity || entity.type !== "prospect") return;
    if (newType === entity.data.prospect_type) return;
    setSavingProspectType(true);
    const { data, error } = await supabase
      .from("prospects")
      .update({ prospect_type: newType })
      .eq("id", entity.data.id)
      .select()
      .single();
    if (!error && data) {
      setProspectType(newType);
      onProspectUpdated(data as Prospect);
    }
    setSavingProspectType(false);
  };

  const handleSaveNotes = async () => {
    if (!entity || entity.type === "place") return;
    const currentNotes = entity.data.notes ?? "";
    if (notesValue === currentNotes) return;
    setSavingNotes(true);
    const table = entity.type === "prospect" ? "prospects" : "partners";
    const { data, error } = await supabase
      .from(table)
      .update({ notes: notesValue.trim() || null })
      .eq("id", entity.data.id)
      .select()
      .single();
    if (!error && data) {
      if (entity.type === "prospect") onProspectUpdated(data as Prospect);
      else onPartnerUpdated(data as Partner);
    }
    setSavingNotes(false);
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
        {/* Unified info rows: Phone / Address / Website — always shown */}
        {(() => {
          const phone =
            entity.type === "partner"
              ? entity.data.contact_phone
              : entity.type === "prospect"
              ? (entity.data as Prospect).contact_phone
              : (entity.data as GooglePlaceResult).phone;

          const address =
            entity.type === "partner"
              ? entity.data.address
              : entity.type === "prospect"
              ? (entity.data as Prospect).address
              : (entity.data as GooglePlaceResult).address;

          const website =
            entity.type === "partner"
              ? entity.data.website
              : entity.type === "prospect"
              ? (entity.data as Prospect).website
              : (entity.data as GooglePlaceResult).website;

          const contactPerson =
            entity.type === "partner"
              ? entity.data.contact_person
              : entity.type === "prospect"
              ? (entity.data as Prospect).contact_person
              : null;

          const labelStyle: React.CSSProperties = {
            fontSize: "0.6875rem",
            fontWeight: 600,
            color: "var(--mc-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            minWidth: 60,
            flexShrink: 0,
          };
          const valueStyle: React.CSSProperties = {
            fontSize: "0.8125rem",
            color: "var(--mc-text-secondary)",
          };
          const mutedStyle: React.CSSProperties = {
            fontSize: "0.8125rem",
            color: "var(--mc-text-muted)",
          };
          const rowStyle: React.CSSProperties = {
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          };

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              <div style={rowStyle}>
                <Phone style={{ width: 13, height: 13, color: "var(--mc-text-muted)", marginTop: 2, flexShrink: 0 }} strokeWidth={1.5} />
                <span style={labelStyle}>Phone</span>
                {phone ? (
                  <a href={`tel:${phone}`} style={{ ...valueStyle, color: "var(--mc-info)", textDecoration: "none" }}>
                    {phone}
                  </a>
                ) : (
                  <span style={mutedStyle}>—</span>
                )}
              </div>

              <div style={rowStyle}>
                <MapPin style={{ width: 13, height: 13, color: "var(--mc-text-muted)", marginTop: 2, flexShrink: 0 }} strokeWidth={1.5} />
                <span style={labelStyle}>Address</span>
                {address ? (
                  <span style={valueStyle}>{address}</span>
                ) : (
                  <span style={mutedStyle}>—</span>
                )}
              </div>

              <div style={rowStyle}>
                <Globe style={{ width: 13, height: 13, color: "var(--mc-text-muted)", marginTop: 2, flexShrink: 0 }} strokeWidth={1.5} />
                <span style={labelStyle}>Website</span>
                {website ? (
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...valueStyle, color: "var(--mc-info)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {website.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  <span style={mutedStyle}>—</span>
                )}
              </div>

              {contactPerson && (
                <div style={rowStyle}>
                  <Building2 style={{ width: 13, height: 13, color: "var(--mc-text-muted)", marginTop: 2, flexShrink: 0 }} strokeWidth={1.5} />
                  <span style={labelStyle}>Contact</span>
                  <span style={valueStyle}>{contactPerson}</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Notes — always visible, inline editable (prospects and partners) */}
        {(entity.type === "prospect" || entity.type === "partner") && (
          <div
            style={{
              padding: "10px 12px",
              background: "var(--mc-graphite)",
              border: "1px solid var(--mc-border)",
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <p
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  color: "var(--mc-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  margin: 0,
                }}
              >
                Notes
              </p>
              {savingNotes && (
                <Loader2 style={{ width: 10, height: 10, color: "var(--mc-text-muted)" }} className="animate-spin" />
              )}
            </div>
            <textarea
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              onBlur={handleSaveNotes}
              rows={3}
              placeholder="Add notes..."
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "vertical",
                fontSize: "0.8125rem",
                color: "var(--mc-text-secondary)",
                lineHeight: 1.5,
                fontFamily: "inherit",
                padding: 0,
              }}
            />
          </div>
        )}

        {/* Google Place — Type selector + Add as Prospect */}
        {entity.type === "place" && (
          <div style={{ marginBottom: 16 }}>
            <p className="mc-label" style={{ marginBottom: 6 }}>Type</p>
            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
              {(["distributor", "client", "supplier"] as PartnerType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setProspectType(t)}
                  style={{
                    flex: 1,
                    padding: "4px 6px",
                    fontSize: "0.6875rem",
                    fontWeight: prospectType === t ? 600 : 400,
                    cursor: "pointer",
                    border: "1px solid",
                    borderColor: prospectType === t ? "var(--mc-cream)" : "var(--mc-border)",
                    background: prospectType === t ? "rgba(236,223,204,0.08)" : "transparent",
                    color: prospectType === t ? "var(--mc-cream)" : "var(--mc-text-muted)",
                    transition: "all 0.15s ease",
                    textTransform: "capitalize",
                  }}
                >
                  {t === "client" ? "Buyer" : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={handleAddProspect}
              disabled={addingProspect}
              className="mc-btn mc-btn-primary"
              style={{ width: "100%" }}
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
          </div>
        )}

        {/* Prospect type changer (prospects only) */}
        {entity.type === "prospect" && (
          <div style={{ marginBottom: 20 }}>
            <p className="mc-label" style={{ marginBottom: 8 }}>
              Type
              {savingProspectType && (
                <Loader2 style={{ width: 10, height: 10, marginLeft: 6, display: "inline", verticalAlign: "middle", color: "var(--mc-text-muted)" }} className="animate-spin" />
              )}
            </p>
            <div style={{ display: "flex", gap: 4 }}>
              {(["distributor", "client", "supplier"] as PartnerType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => handleSaveProspectType(t)}
                  disabled={savingProspectType || t === prospectType}
                  style={{
                    flex: 1,
                    padding: "4px 6px",
                    fontSize: "0.6875rem",
                    fontWeight: t === prospectType ? 600 : 400,
                    cursor: t === prospectType ? "default" : "pointer",
                    border: "1px solid",
                    borderColor: t === prospectType ? "var(--mc-cream)" : "var(--mc-border)",
                    background: t === prospectType ? "rgba(236,223,204,0.08)" : "transparent",
                    color: t === prospectType ? "var(--mc-cream)" : "var(--mc-text-muted)",
                    opacity: savingProspectType ? 0.5 : 1,
                    transition: "all 0.15s ease",
                    textTransform: "capitalize",
                  }}
                >
                  {t === "client" ? "Buyer" : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
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
