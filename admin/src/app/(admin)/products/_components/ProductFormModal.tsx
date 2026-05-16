"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, X } from "lucide-react";
import { PRODUCT_CATEGORIES } from "@mecanova/shared";
import type { Product, ProductCategory } from "@mecanova/shared";

const CATEGORY_LABELS: Record<string, string> = {
  tequila: "Tequila",
  mezcal: "Mezcal",
  raicilla: "Raicilla",
  other: "Other",
};

interface Props {
  mode: "create" | "edit";
  product?: Product;
  onClose: () => void;
  onSaved: (product: Product) => void;
}

export default function ProductFormModal({ mode, product, onClose, onSaved }: Props) {
  const supabase = createClient();

  const [name, setName] = useState(product?.name ?? "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [category, setCategory] = useState<ProductCategory>(
    (product?.category as ProductCategory) ?? "tequila"
  );
  const [supplierId, setSupplierId] = useState(product?.supplier_id ?? "");
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [abv, setAbv] = useState(product?.abv?.toString() ?? "");
  const [sizeMl, setSizeMl] = useState(product?.size_ml?.toString() ?? "");
  const [caseSize, setCaseSize] = useState(product?.case_size?.toString() ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    (async () => {
      const { data } = await supabase
        .from("partners")
        .select("id, name")
        .eq("partner_type", "supplier")
        .order("name");
      setSuppliers(data || []);
    })();
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const base = {
      name: name.trim(),
      brand: brand.trim() || null,
      category,
      supplier_id: supplierId || null,
      abv: abv ? parseFloat(abv) : null,
      size_ml: sizeMl ? parseInt(sizeMl) : null,
      case_size: caseSize ? parseInt(caseSize) : null,
      sku: sku.trim() || null,
      description: description.trim() || null,
    };

    const { data, error: dbError } =
      mode === "create"
        ? await supabase
            .from("products")
            .insert({ ...base, active: true })
            .select()
            .single()
        : await supabase
            .from("products")
            .update(base)
            .eq("id", product!.id)
            .select()
            .single();

    if (dbError || !data) {
      setError(dbError?.message ?? "Failed to save product");
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved(data as Product);
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
              {mode === "create" ? "New Product" : "Edit Product"}
            </h2>
            <p style={{ fontSize: "0.75rem", color: "var(--mc-text-muted)", marginTop: 2 }}>
              {mode === "create"
                ? "Create a product — prices and assets can be added afterwards."
                : product?.name}
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
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 2 }}>
                <label className="mc-label">Product Name *</label>
                <input
                  className="mc-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="mc-label">Brand</label>
                <input
                  className="mc-input"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label className="mc-label">Category *</label>
                <select
                  className="mc-input mc-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ProductCategory)}
                >
                  {PRODUCT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="mc-label">Supplier</label>
                <select
                  className="mc-input mc-select"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  <option value="">— No supplier —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label className="mc-label">ABV (%)</label>
                <input
                  className="mc-input"
                  type="number"
                  step="0.1"
                  value={abv}
                  onChange={(e) => setAbv(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="mc-label">Bottle Size (ml)</label>
                <input
                  className="mc-input"
                  type="number"
                  value={sizeMl}
                  onChange={(e) => setSizeMl(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="mc-label">Case Size (bottles)</label>
                <input
                  className="mc-input"
                  type="number"
                  value={caseSize}
                  onChange={(e) => setCaseSize(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="mc-label">SKU</label>
              <input
                className="mc-input"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
            </div>

            <div>
              <label className="mc-label">Description / Tasting Notes</label>
              <textarea
                className="mc-input"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Product description, tasting notes, origin details…"
                style={{ resize: "vertical" }}
              />
            </div>
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
                "Create Product"
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
