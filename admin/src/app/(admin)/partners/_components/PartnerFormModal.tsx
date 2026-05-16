"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, X } from "lucide-react";
import AddressAutocomplete from "@/components/crm/AddressAutocomplete";
import {
  VENUE_TYPES,
  VENUE_TYPE_LABELS,
  CAPACITY_STATUSES,
  CAPACITY_STATUS_LABELS,
} from "@mecanova/shared";
import type { Partner, CapacityStatus, VenueType } from "@mecanova/shared";

interface Props {
  mode: "create" | "edit";
  partner?: Partner;
  onClose: () => void;
  onSaved: (partner: Partner) => void;
}

export default function PartnerFormModal({ mode, partner, onClose, onSaved }: Props) {
  const supabase = createClient();

  const [name, setName] = useState(partner?.name ?? "");
  const [topType, setTopType] = useState<"buyer" | "supplier">(
    partner?.partner_type === "supplier" ? "supplier" : "buyer"
  );
  const [buyerSubType, setBuyerSubType] = useState<string>(
    partner?.partner_type === "distributor"
      ? "distributor"
      : partner?.venue_type || "distributor"
  );
  const [address, setAddress] = useState(partner?.address ?? "");
  const [lat, setLat] = useState<number | null>(partner?.lat ?? null);
  const [lng, setLng] = useState<number | null>(partner?.lng ?? null);
  const [country, setCountry] = useState(partner?.country ?? "");
  const [vatId, setVatId] = useState(partner?.vat_id ?? "");
  const [contactPerson, setContactPerson] = useState(partner?.contact_person ?? "");
  const [contactPosition, setContactPosition] = useState(partner?.contact_position ?? "");
  const [contactEmail, setContactEmail] = useState(partner?.contact_email ?? "");
  const [contactPhone, setContactPhone] = useState(partner?.contact_phone ?? "");
  const [website, setWebsite] = useState(partner?.website ?? "");
  const [capacityStatus, setCapacityStatus] = useState<CapacityStatus | "">(
    (partner?.capacity_status as CapacityStatus) || ""
  );
  const [serviceCountries, setServiceCountries] = useState(
    (partner?.service_countries || []).join(", ")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const partnerType: "supplier" | "distributor" | "client" =
      topType === "supplier"
        ? "supplier"
        : buyerSubType === "distributor"
        ? "distributor"
        : "client";

    const venueType = (
      topType === "buyer" && buyerSubType !== "distributor" ? buyerSubType : null
    ) as VenueType | null;

    const countriesArray = serviceCountries
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    const base = {
      name: name.trim(),
      partner_type: partnerType,
      venue_type: venueType,
      address: address.trim() || null,
      lat: lat ?? null,
      lng: lng ?? null,
      country: country.trim() || null,
      vat_id: vatId.trim() || null,
      contact_person: contactPerson.trim() || null,
      contact_position: contactPosition.trim() || null,
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
      website: website.trim() || null,
      capacity_status:
        partnerType === "distributor" && capacityStatus ? capacityStatus : null,
      service_countries:
        partnerType === "distributor" && countriesArray.length > 0
          ? countriesArray
          : null,
    };

    const { data, error: dbError } =
      mode === "create"
        ? await supabase
            .from("partners")
            .insert({ ...base, crm_status: "customer" })
            .select()
            .single()
        : await supabase
            .from("partners")
            .update(base)
            .eq("id", partner!.id)
            .select()
            .single();

    if (dbError || !data) {
      setError(dbError?.message ?? "Failed to save partner");
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved(data as Partner);
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 560,
          maxWidth: "96vw",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--mc-surface)",
          border: "1px solid var(--mc-border)",
          boxShadow: "var(--mc-shadow-lg)",
        }}
      >
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
              {mode === "create" ? "New Partner" : "Edit Partner"}
            </h2>
            <p style={{ fontSize: "0.75rem", color: "var(--mc-text-muted)", marginTop: 2 }}>
              {mode === "create"
                ? "Create a partner — you can add notes and extra contacts afterwards."
                : partner?.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--mc-text-muted)",
              padding: 4,
              lineHeight: 0,
            }}
          >
            <X style={{ width: 16, height: 16 }} strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="mc-label">Company Name *</label>
              <input
                className="mc-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label className="mc-label">Category *</label>
                <select
                  className="mc-input mc-select"
                  value={topType}
                  onChange={(e) => setTopType(e.target.value as "buyer" | "supplier")}
                >
                  <option value="buyer">Buyer</option>
                  <option value="supplier">Supplier</option>
                </select>
              </div>
              {topType === "buyer" && (
                <div style={{ flex: 1 }}>
                  <label className="mc-label">Buyer Type *</label>
                  <select
                    className="mc-input mc-select"
                    value={buyerSubType}
                    onChange={(e) => setBuyerSubType(e.target.value)}
                  >
                    <option value="distributor">Distributor</option>
                    {VENUE_TYPES.map((vt) => (
                      <option key={vt} value={vt}>{VENUE_TYPE_LABELS[vt]}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="mc-label">Address</label>
              <AddressAutocomplete
                value={address}
                onChange={setAddress}
                onPlaceSelected={(details) => {
                  setAddress(details.address);
                  setLat(details.lat);
                  setLng(details.lng);
                  if (details.country) setCountry(details.country);
                }}
                placeholder="Search real address (shows on CRM map)"
              />
              {lat && lng && (
                <p style={{ fontSize: "0.6875rem", color: "var(--mc-success)", marginTop: 4 }}>
                  ✓ Location confirmed — will appear on CRM map
                </p>
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label className="mc-label">Country</label>
                <input
                  className="mc-input"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="mc-label">VAT ID</label>
                <input
                  className="mc-input"
                  value={vatId}
                  onChange={(e) => setVatId(e.target.value)}
                />
              </div>
            </div>

            <div
              className="pt-1"
              style={{ borderTop: "1px solid var(--mc-border)" }}
            >
              <p
                className="text-[10px] font-semibold tracking-[0.1em] uppercase"
                style={{ color: "var(--mc-text-muted)" }}
              >
                Primary contact
              </p>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 2 }}>
                <label className="mc-label">Contact Person</label>
                <input
                  className="mc-input"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Max Müller"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="mc-label">Position</label>
                <input
                  className="mc-input"
                  value={contactPosition}
                  onChange={(e) => setContactPosition(e.target.value)}
                  placeholder="e.g. Manager"
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label className="mc-label">Contact Email</label>
                <input
                  className="mc-input"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="e.g. max@company.de"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="mc-label">Contact Phone</label>
                <input
                  className="mc-input"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="e.g. +49 30 12345678"
                />
              </div>
            </div>

            <div>
              <label className="mc-label">Website</label>
              <input
                className="mc-input"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="e.g. https://www.example.de"
              />
            </div>

            {topType === "buyer" && buyerSubType === "distributor" && (
              <>
                <div>
                  <label className="mc-label">Capacity Status</label>
                  <select
                    className="mc-input mc-select"
                    value={capacityStatus}
                    onChange={(e) => setCapacityStatus(e.target.value as CapacityStatus | "")}
                  >
                    <option value="">Not set</option>
                    {CAPACITY_STATUSES.map((s) => (
                      <option key={s} value={s}>{CAPACITY_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mc-label">Service Countries</label>
                  <input
                    className="mc-input"
                    value={serviceCountries}
                    onChange={(e) => setServiceCountries(e.target.value)}
                    placeholder="e.g. DE, AT, CH"
                  />
                  <p className="text-[10px] mt-1" style={{ color: "var(--mc-text-muted)" }}>
                    Comma-separated ISO country codes
                  </p>
                </div>
              </>
            )}
          </div>

          {error && (
            <p style={{ fontSize: "0.75rem", color: "var(--mc-error)", marginTop: 12 }}>
              {error}
            </p>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button type="button" onClick={onClose} className="mc-btn mc-btn-ghost" style={{ flex: 1 }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="mc-btn mc-btn-primary"
              style={{ flex: 2 }}
            >
              {saving ? (
                <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
              ) : mode === "create" ? (
                "Create Partner"
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
