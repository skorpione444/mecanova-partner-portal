"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import type { PartnerType } from "@mecanova/shared";
import {
  CLIENT_TIERS,
  CLIENT_TIER_LABELS,
  CAPACITY_STATUSES,
  CAPACITY_STATUS_LABELS,
} from "@mecanova/shared";
import type { ClientTier, CapacityStatus } from "@mecanova/shared";
import { UserPlus, ArrowLeft } from "lucide-react";

export default function NewPartnerPage() {
  const [name, setName] = useState("");
  const [partnerType, setPartnerType] = useState<PartnerType>("distributor");
  const [country, setCountry] = useState("");
  const [vatId, setVatId] = useState("");
  const [clientTier, setClientTier] = useState<ClientTier | "">("");
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

    const countriesArray = serviceCountries
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    const { error: insertError } = await supabase.from("partners").insert({
      name: name.trim(),
      partner_type: partnerType,
      country: country.trim() || null,
      vat_id: vatId.trim() || null,
      client_tier: partnerType === "client" && clientTier ? clientTier : null,
      capacity_status: partnerType === "distributor" && capacityStatus ? capacityStatus : null,
      service_countries: partnerType === "distributor" && countriesArray.length > 0 ? countriesArray : null,
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
        title="Add Partner"
        description="Create a new partner (distributor, buyer, or supplier)"
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

      <form
        onSubmit={handleSubmit}
        className="mc-card p-6 max-w-xl space-y-5"
      >
        <div>
          <label className="mc-label" htmlFor="name">
            Company Name *
          </label>
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

        <div>
          <label className="mc-label" htmlFor="partnerType">
            Partner Type *
          </label>
          <select
            id="partnerType"
            value={partnerType}
            onChange={(e) =>
              setPartnerType(e.target.value as PartnerType)
            }
            className="mc-input mc-select"
          >
            <option value="distributor">Distributor</option>
            <option value="client">Buyer (Client)</option>
            <option value="supplier">Supplier (Producer)</option>
          </select>
        </div>

        <div>
          <label className="mc-label" htmlFor="country">
            Country
          </label>
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
          <label className="mc-label" htmlFor="vatId">
            VAT ID
          </label>
          <input
            id="vatId"
            type="text"
            value={vatId}
            onChange={(e) => setVatId(e.target.value)}
            className="mc-input"
            placeholder="e.g. DE123456789"
          />
        </div>

        {partnerType === "client" && (
          <div>
            <label className="mc-label" htmlFor="clientTier">
              Client Tier
            </label>
            <select
              id="clientTier"
              value={clientTier}
              onChange={(e) => setClientTier(e.target.value as ClientTier | "")}
              className="mc-input mc-select"
            >
              <option value="">Not set</option>
              {CLIENT_TIERS.map((t) => (
                <option key={t} value={t}>
                  {CLIENT_TIER_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        )}

        {partnerType === "distributor" && (
          <>
            <div>
              <label className="mc-label" htmlFor="capacityStatus">
                Capacity Status
              </label>
              <select
                id="capacityStatus"
                value={capacityStatus}
                onChange={(e) => setCapacityStatus(e.target.value as CapacityStatus | "")}
                className="mc-input mc-select"
              >
                <option value="">Not set</option>
                {CAPACITY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CAPACITY_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mc-label" htmlFor="serviceCountries">
                Service Countries
              </label>
              <input
                id="serviceCountries"
                type="text"
                value={serviceCountries}
                onChange={(e) => setServiceCountries(e.target.value)}
                className="mc-input"
                placeholder="e.g. DE, AT, CH"
              />
              <p
                className="text-[10px] mt-1"
                style={{ color: "var(--mc-text-muted)" }}
              >
                Comma-separated ISO country codes
              </p>
            </div>
          </>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="mc-btn mc-btn-primary"
          >
            {saving ? "Creating..." : "Create Partner"}
          </button>
          <Link href="/partners" className="mc-btn mc-btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}



