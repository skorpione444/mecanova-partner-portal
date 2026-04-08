"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, X } from "lucide-react";
import type { Prospect } from "@mecanova/shared";

interface ConvertProspectModalProps {
  prospect: Prospect;
  onConverted: (partnerId: string) => void;
  onClose: () => void;
}

export default function ConvertProspectModal({
  prospect,
  onConverted,
  onClose,
}: ConvertProspectModalProps) {
  const [name, setName] = useState(prospect.name);
  const [partnerType, setPartnerType] = useState<"client" | "distributor" | "supplier">("client");
  const [contactPerson, setContactPerson] = useState(prospect.contact_person ?? "");
  const [contactEmail, setContactEmail] = useState(prospect.contact_email ?? "");
  const [contactPhone, setContactPhone] = useState(prospect.contact_phone ?? "");
  const [vatId, setVatId] = useState("");
  const [country, setCountry] = useState("Germany");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 1. Create partner
    const { data: partner, error: partnerError } = await supabase
      .from("partners")
      .insert({
        name: name.trim(),
        contact_person: contactPerson.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        vat_id: vatId.trim() || null,
        country: country.trim() || null,
        partner_type: partnerType,
        lat: prospect.lat,
        lng: prospect.lng,
        venue_type: prospect.venue_type,
        crm_status: "customer",
        google_place_id: prospect.google_place_id,
      })
      .select("id")
      .single();

    if (partnerError || !partner) {
      setError(partnerError?.message ?? "Failed to create partner");
      setLoading(false);
      return;
    }

    // 2. Link prospect → partner and mark inactive
    await supabase
      .from("prospects")
      .update({ converted_to_partner_id: partner.id, crm_status: "inactive" })
      .eq("id", prospect.id);

    setLoading(false);
    onConverted(partner.id);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(10,11,13,0.8)",
        backdropFilter: "blur(2px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 500,
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--mc-surface)",
          border: "1px solid var(--mc-border)",
          boxShadow: "var(--mc-shadow-lg)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--mc-border)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            background: "var(--mc-surface)",
            zIndex: 1,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "0.9375rem",
                fontWeight: 500,
                color: "var(--mc-text-primary)",
                fontFamily: "var(--font-jost), Jost, sans-serif",
                margin: 0,
              }}
            >
              Convert to Partner
            </h2>
            <p style={{ fontSize: "0.75rem", color: "var(--mc-text-muted)", marginTop: 2 }}>
              Fill in the required details. A partner record will be created and linked to this prospect.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mc-text-muted)", padding: 4, lineHeight: 0 }}
          >
            <X style={{ width: 16, height: 16 }} strokeWidth={1.5} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            <div>
              <label className="mc-label">Company Name *</label>
              <input className="mc-input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div>
              <label className="mc-label">Partner Type *</label>
              <select
                className="mc-input mc-select"
                value={partnerType}
                onChange={(e) => setPartnerType(e.target.value as "client" | "distributor" | "supplier")}
              >
                <option value="client">Client (buyer)</option>
                <option value="distributor">Distributor</option>
                <option value="supplier">Supplier</option>
              </select>
            </div>

            <div
              style={{
                padding: "10px 12px",
                background: "var(--mc-graphite)",
                border: "1px solid var(--mc-border)",
                fontSize: "0.75rem",
                color: "var(--mc-text-muted)",
              }}
            >
              Address from prospect: {prospect.address ?? "—"}<br />
              {prospect.lat && prospect.lng && (
                <span style={{ color: "var(--mc-success)" }}>✓ Coordinates will be carried over</span>
              )}
            </div>

            <div>
              <label className="mc-label">VAT ID</label>
              <input
                className="mc-input"
                placeholder="e.g. DE123456789"
                value={vatId}
                onChange={(e) => setVatId(e.target.value)}
              />
            </div>

            <div>
              <label className="mc-label">Country</label>
              <input
                className="mc-input"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>

            <div>
              <label className="mc-label">Contact Person</label>
              <input className="mc-input" placeholder="Optional" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
            </div>

            <div>
              <label className="mc-label">Contact Email</label>
              <input className="mc-input" type="email" placeholder="Optional" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>

            <div>
              <label className="mc-label">Contact Phone</label>
              <input className="mc-input" placeholder="Optional" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
          </div>

          {error && (
            <p style={{ fontSize: "0.75rem", color: "var(--mc-error)", marginTop: 12 }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button type="button" onClick={onClose} className="mc-btn mc-btn-ghost" style={{ flex: 1 }}>
              Cancel
            </button>
            <button type="submit" disabled={loading || !name.trim()} className="mc-btn mc-btn-primary" style={{ flex: 2 }}>
              {loading ? (
                <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
              ) : (
                "Create Partner"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
