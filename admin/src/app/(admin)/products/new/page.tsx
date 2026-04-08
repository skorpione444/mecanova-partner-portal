"use client";

import { useState, useEffect, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { PRODUCT_CATEGORIES } from "@mecanova/shared";
import type { ProductCategory } from "@mecanova/shared";
import { Plus, ArrowLeft, AlertTriangle, ArrowUpRight } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  tequila: "Tequila",
  mezcal: "Mezcal",
  raicilla: "Raicilla",
  other: "Other",
};

function SectionHeading({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-3 pt-1"
      style={{ borderTop: "1px solid var(--mc-border)" }}
    >
      <span
        className="text-[10px] font-semibold tracking-[0.1em] uppercase whitespace-nowrap"
        style={{ color: "var(--mc-text-muted)" }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--mc-border)" }} />
    </div>
  );
}

export default function NewProductPage() {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<ProductCategory>("tequila");
  const [supplierId, setSupplierId] = useState("");
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [suppliersLoaded, setSuppliersLoaded] = useState(false);
  const [abv, setAbv] = useState("");
  const [sizeMl, setSizeMl] = useState("");
  const [caseSize, setCaseSize] = useState("");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const loadSuppliers = async () => {
      const { data } = await supabase
        .from("partners")
        .select("id, name")
        .eq("partner_type", "supplier")
        .order("name");
      const list = data || [];
      setSuppliers(list);
      setSuppliersLoaded(true);

      // Pre-fill supplier from URL param
      const urlParams = new URLSearchParams(window.location.search);
      const preselect = urlParams.get("supplier");
      if (preselect && list.some((s) => s.id === preselect)) {
        setSupplierId(preselect);
      }
    };
    loadSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const { error: insertError } = await supabase.from("products").insert({
      name: name.trim(),
      brand: brand.trim() || null,
      category,
      supplier_id: supplierId || null,
      abv: abv ? parseFloat(abv) : null,
      size_ml: sizeMl ? parseInt(sizeMl) : null,
      case_size: caseSize ? parseInt(caseSize) : null,
      sku: sku.trim() || null,
      description: description.trim() || null,
      active: true,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    router.push("/products");
  };

  return (
    <div>
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-[11px] tracking-wide mb-4 transition-colors"
        style={{ color: "var(--mc-text-muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-text-muted)")}
      >
        <ArrowLeft className="w-3 h-3" />
        Back to Products
      </Link>

      <PageHeader
        title="Add Product"
        description="Add a new product to the catalogue"
        icon={Plus}
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

      <form onSubmit={handleSubmit} className="mc-card p-6 max-w-2xl space-y-5">

        <SectionHeading label="Identity" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="mc-label" htmlFor="name">Product Name *</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mc-input"
              placeholder="e.g. Artesanal Mezcal"
              required
            />
          </div>
          <div>
            <label className="mc-label" htmlFor="brand">Brand</label>
            <input
              id="brand"
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="mc-input"
              placeholder="e.g. Casa Mecanova"
            />
          </div>
        </div>

        <div>
          <label className="mc-label" htmlFor="category">Category *</label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ProductCategory)}
            className="mc-input mc-select"
          >
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>
            ))}
          </select>
        </div>

        <SectionHeading label="Supplier" />

        {suppliersLoaded && suppliers.length === 0 ? (
          <div
            className="flex items-start gap-3 px-4 py-3"
            style={{
              background: "var(--mc-warning-bg)",
              border: "1px solid var(--mc-warning-light)",
            }}
          >
            <AlertTriangle
              className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
              style={{ color: "var(--mc-warning)" }}
            />
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--mc-warning)" }}>
                No suppliers in your catalogue yet
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--mc-text-muted)" }}>
                Products should be linked to a supplier (producer). You can still save without one.
              </p>
              <Link
                href="/partners/new"
                className="inline-flex items-center gap-1 text-[10px] mt-2 underline"
                style={{ color: "var(--mc-warning)" }}
              >
                Add a Supplier first <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="mc-label" htmlFor="supplier">Supplier (Producer)</label>
              <Link
                href="/partners/new"
                className="text-[10px] flex items-center gap-0.5 transition-colors"
                style={{ color: "var(--mc-text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream-subtle)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-text-muted)")}
              >
                + Add new <ArrowUpRight className="w-2.5 h-2.5" />
              </Link>
            </div>
            <select
              id="supplier"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="mc-input mc-select"
            >
              <option value="">— No supplier —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        <SectionHeading label="Specs" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="mc-label" htmlFor="abv">ABV (%)</label>
            <input
              id="abv"
              type="number"
              step="0.1"
              value={abv}
              onChange={(e) => setAbv(e.target.value)}
              className="mc-input"
              placeholder="e.g. 40.0"
            />
          </div>
          <div>
            <label className="mc-label" htmlFor="sizeMl">Bottle Size (ml)</label>
            <input
              id="sizeMl"
              type="number"
              value={sizeMl}
              onChange={(e) => setSizeMl(e.target.value)}
              className="mc-input"
              placeholder="e.g. 700"
            />
          </div>
          <div>
            <label className="mc-label" htmlFor="caseSize">Case Size (bottles)</label>
            <input
              id="caseSize"
              type="number"
              value={caseSize}
              onChange={(e) => setCaseSize(e.target.value)}
              className="mc-input"
              placeholder="e.g. 6"
            />
          </div>
        </div>

        <div>
          <label className="mc-label" htmlFor="sku">SKU</label>
          <input
            id="sku"
            type="text"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="mc-input"
            placeholder="e.g. MZC-ART-750"
          />
        </div>

        <SectionHeading label="Description" />

        <div>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mc-input"
            rows={3}
            placeholder="Product description, tasting notes, origin details…"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="mc-btn mc-btn-primary"
          >
            {saving ? "Creating..." : "Create Product"}
          </button>
          <Link href="/products" className="mc-btn mc-btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
