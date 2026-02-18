"use client";

import { useState, useEffect, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { PRODUCT_CATEGORIES } from "@mecanova/shared";
import type { ProductCategory } from "@mecanova/shared";
import { Plus, ArrowLeft } from "lucide-react";

export default function NewProductPage() {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<ProductCategory>("tequila");
  const [supplierId, setSupplierId] = useState("");
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
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
      setSuppliers(data || []);
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
        onMouseEnter={(e) =>
          (e.currentTarget.style.color = "var(--mc-cream)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.color = "var(--mc-text-muted)")
        }
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

      <form
        onSubmit={handleSubmit}
        className="mc-card p-6 max-w-2xl space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="mc-label" htmlFor="name">
              Product Name *
            </label>
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
            <label className="mc-label" htmlFor="brand">
              Brand
            </label>
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
          <label className="mc-label" htmlFor="supplier">
            Supplier (Producer)
          </label>
          <select
            id="supplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="mc-input mc-select"
          >
            <option value="">— No supplier —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {suppliers.length === 0 && (
            <p className="text-[10px] mt-1" style={{ color: "var(--mc-text-muted)" }}>
              No suppliers yet.{" "}
              <Link href="/partners/new" className="underline" style={{ color: "var(--mc-cream-subtle)" }}>
                Add one first
              </Link>
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="mc-label" htmlFor="category">
              Category *
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ProductCategory)}
              className="mc-input mc-select"
            >
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mc-label" htmlFor="abv">
              ABV (%)
            </label>
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
            <label className="mc-label" htmlFor="sizeMl">
              Bottle Size (ml)
            </label>
            <input
              id="sizeMl"
              type="number"
              value={sizeMl}
              onChange={(e) => setSizeMl(e.target.value)}
              className="mc-input"
              placeholder="e.g. 750"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="mc-label" htmlFor="caseSize">
              Case Size (bottles)
            </label>
            <input
              id="caseSize"
              type="number"
              value={caseSize}
              onChange={(e) => setCaseSize(e.target.value)}
              className="mc-input"
              placeholder="e.g. 6"
            />
          </div>
          <div>
            <label className="mc-label" htmlFor="sku">
              SKU
            </label>
            <input
              id="sku"
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="mc-input"
              placeholder="e.g. MZC-ART-750"
            />
          </div>
        </div>

        <div>
          <label className="mc-label" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mc-input"
            rows={3}
            placeholder="Product description, tasting notes..."
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
          <Link href="/products" className="mc-btn mc-btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}



