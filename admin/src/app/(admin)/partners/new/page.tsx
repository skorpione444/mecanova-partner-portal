"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import AddressAutocomplete from "@/components/crm/AddressAutocomplete";
import { VENUE_TYPES, VENUE_TYPE_LABELS, CAPACITY_STATUSES, CAPACITY_STATUS_LABELS } from "@mecanova/shared";
import type { CapacityStatus } from "@mecanova/shared";
import { UserPlus, ArrowLeft } from "lucide-react";

export default function NewPartnerPage() {
  const [name, setName] = useState("");
  const [topType, setTopType] = useState<"buyer" | "supplier">("buyer");
  const [buyerSubType, setBuyerSubType] = useState<string>("distributor");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [country, setCountry] = useState("");
  const [vatId, setVatId] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactPosition, setContactPosition] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [capacityStatus, setCapacityStatus] = useState<CapacityStatus | "">("");
  const [serviceCountries, setServiceCountries] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const partnerType =
      topType === "supplier"
        ? "supplier"
        : buyerSubType === "distributor"
        ? "distributor"
        : "client";

    const venueType =
      topType === "buyer" && buyerSubType !== "distributor"
        ? buyerSubType
        : null;

    const countriesArray = serviceCountries
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    const { error: insertError } = await supabase.from("partners").insert({
      name: name.trim(),
      partner_type: partnerType,
      venue_type: venueType,
      country: country.trim() || null,
      vat_id: vatId.trim() || null,
      contact_person: contactPerson.trim() || null,
      contact_position: contactPosition.trim() || null,
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
      lat: lat ?? null,
      lng: lng ?? null,
      crm_status: "customer",
      capacity_status:
        partnerType === "distributor" && capacityStatus ? capacityStatus : null,
      service_countries:
        partnerType === "distributor" && countriesArray.length > 0
          ? countriesArray
          : null,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    router.push("/partners");
  };

  return (
    <div>
      <Link
        href="/partners"
        className="inline-flex items-center gap-1.5 text-[11px] tracking-wide mb-4 transition-colors"
        style={{ color: "var(--mc-text-muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-text-muted)")}
      >
        <ArrowLeft className="w-3 h-3" />
        Back to Partners
      </Link>

      <PageHeader
        title="Add Partner"
        description="Create a new partner"
        icon={UserPlus}
      />

      {error && (
        <div
          className="mb-5 px-4 py-3 text-xs"
          style={{
            background: "var(--mc-error-bg)",
            border: "1px solid var(--mc-error-light)",
            color: "var(--mc-error)",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mc-card p-6 max-w-xl space-y-5">
        <div>
          <label className="mc-label" htmlFor="name">Company Name *</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mc-input"
            placeholder="e.g. Berlin Spirits GmbH"
            required
          />
        </div>

        {/* Two-tier type selection */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label className="mc-label">Category *</label>
            <select
              value={topType}
              onChange={(e) => setTopType(e.target.value as "buyer" | "supplier")}
              className="mc-input mc-select"
            >
              <option value="buyer">Buyer</option>
              <option value="supplier">Supplier</option>
            </select>
          </div>
          {topType === "buyer" && (
            <div style={{ flex: 1 }}>
              <label className="mc-label">Buyer Type *</label>
              <select
                value={buyerSubType}
                onChange={(e) => setBuyerSubType(e.target.value)}
                className="mc-input mc-select"
              >
                <option value="distributor">Distributor</option>
                {VENUE_TYPES.map((vt) => (
                  <option key={vt} value={vt}>{VENUE_TYPE_LABELS[vt]}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Address with autofill */}
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

        <div>
          <label className="mc-label" htmlFor="country">Country</label>
          <input
            id="country"
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="mc-input"
            placeholder="e.g. Germany"
          />
        </div>

        <div>
          <label className="mc-label" htmlFor="vatId">VAT ID</label>
          <input
            id="vatId"
            type="text"
            value={vatId}
            onChange={(e) => setVatId(e.target.value)}
            className="mc-input"
            placeholder="e.g. DE123456789"
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 2 }}>
            <label className="mc-label" htmlFor="contactPerson">Contact Person</label>
            <input
              id="contactPerson"
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="mc-input"
              placeholder="e.g. Max Müller"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="mc-label" htmlFor="contactPosition">Position</label>
            <input
              id="contactPosition"
              type="text"
              value={contactPosition}
              onChange={(e) => setContactPosition(e.target.value)}
              className="mc-input"
              placeholder="e.g. Manager"
            />
          </div>
        </div>

        <div>
          <label className="mc-label" htmlFor="contactEmail">Contact Email</label>
          <input
            id="contactEmail"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="mc-input"
            placeholder="e.g. max@company.de"
          />
        </div>

        <div>
          <label className="mc-label" htmlFor="contactPhone">Contact Phone</label>
          <input
            id="contactPhone"
            type="text"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className="mc-input"
            placeholder="e.g. +49 30 12345678"
          />
        </div>

        {topType === "buyer" && buyerSubType === "distributor" && (
          <>
            <div>
              <label className="mc-label" htmlFor="capacityStatus">Capacity Status</label>
              <select
                id="capacityStatus"
                value={capacityStatus}
                onChange={(e) => setCapacityStatus(e.target.value as CapacityStatus | "")}
                className="mc-input mc-select"
              >
                <option value="">Not set</option>
                {CAPACITY_STATUSES.map((s) => (
                  <option key={s} value={s}>{CAPACITY_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mc-label" htmlFor="serviceCountries">Service Countries</label>
              <input
                id="serviceCountries"
                type="text"
                value={serviceCountries}
                onChange={(e) => setServiceCountries(e.target.value)}
                className="mc-input"
                placeholder="e.g. DE, AT, CH"
              />
              <p className="text-[10px] mt-1" style={{ color: "var(--mc-text-muted)" }}>
                Comma-separated ISO country codes
              </p>
            </div>
          </>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving || !name.trim()} className="mc-btn mc-btn-primary">
            {saving ? "Creating..." : "Create Partner"}
          </button>
          <Link href="/partners" className="mc-btn mc-btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
