"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import type { PartnerType } from "@mecanova/shared";
import { Edit, ArrowLeft } from "lucide-react";

export default function EditPartnerPage() {
  const params = useParams();
  const id = params.id as string;
  const [name, setName] = useState("");
  const [partnerType, setPartnerType] = useState<PartnerType>("distributor");
  const [country, setCountry] = useState("");
  const [vatId, setVatId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("partners")
        .select("*")
        .eq("id", id)
        .single();

      if (!data) {
        router.push("/partners");
        return;
      }

      setName(data.name);
      setPartnerType(data.partner_type);
      setCountry(data.country || "");
      setVatId(data.vat_id || "");
      setLoading(false);
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const { error: updateError } = await supabase
      .from("partners")
      .update({
        name: name.trim(),
        partner_type: partnerType,
        country: country.trim() || null,
        vat_id: vatId.trim() || null,
      })
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    router.push(`/partners/${id}`);
  };

  if (loading) {
    return (
      <div>
        <div className="mc-skeleton h-6 w-48 mb-6" />
        <div className="mc-skeleton h-64 max-w-xl" />
      </div>
    );
  }

  return (
    <div>
      <Link
        href={`/partners/${id}`}
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
        Back to Partner
      </Link>

      <PageHeader
        title="Edit Partner"
        description={`Editing ${name}`}
        icon={Edit}
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
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="mc-btn mc-btn-primary"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <Link href={`/partners/${id}`} className="mc-btn mc-btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}



