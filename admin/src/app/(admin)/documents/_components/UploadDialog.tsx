"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SearchableSelect from "@/components/SearchableSelect";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_AUDIENCES,
  DOCUMENT_AUDIENCE_LABELS,
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_TYPE_TO_CATEGORY,
  DOCUMENT_STATUSES,
  DOCUMENT_STATUS_LABELS,
} from "@mecanova/shared";
import type {
  DocumentType,
  DocumentAudience,
  DocumentCategory,
  DocumentStatus,
  Partner,
  Product,
} from "@mecanova/shared";
import { Upload } from "lucide-react";

type Props = {
  defaultCategory?: DocumentCategory;
  partners: Partner[];
  products: Product[];
  onUploaded: () => void;
  onCancel: () => void;
};

export default function UploadDialog({
  defaultCategory,
  partners,
  products,
  onUploaded,
  onCancel,
}: Props) {
  const initialType: DocumentType = defaultCategory
    ? (DOCUMENT_TYPES.find((t) => DOCUMENT_TYPE_TO_CATEGORY[t] === defaultCategory) ??
        "presentation")
    : "presentation";

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>(
    defaultCategory ?? DOCUMENT_TYPE_TO_CATEGORY[initialType]
  );
  const [docType, setDocType] = useState<DocumentType>(initialType);
  const [audience, setAudience] = useState<DocumentAudience>("internal");
  const [status, setStatus] = useState<DocumentStatus>("active");
  const [expiresAt, setExpiresAt] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [productId, setProductId] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [isHighlight, setIsHighlight] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const supabase = createClient();

  // When the user changes category, narrow the type dropdown to types that fit it
  // and pick the first matching type if the current one is incompatible.
  const typesForCategory = useMemo(
    () => DOCUMENT_TYPES.filter((t) => DOCUMENT_TYPE_TO_CATEGORY[t] === category),
    [category]
  );

  useEffect(() => {
    if (!typesForCategory.includes(docType)) {
      setDocType(typesForCategory[0] ?? "presentation");
    }
  }, [typesForCategory, docType]);

  // Counterparty + expiry only really make sense for legal/contracts.
  const showCounterparty = category === "legal" || category === "contracts";
  const showExpiry = category === "legal" || category === "contracts";

  const handleUpload = async () => {
    if (!file || !title.trim()) return;
    setUploading(true);
    setUploadError(null);

    const ext = file.name.split(".").pop() || "pdf";
    const safeTitle = title.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_\-.]/g, "");
    const path = `${category}/${Date.now()}_${safeTitle}.${ext}`;

    const { error: storageError } = await supabase.storage
      .from("documents")
      .upload(path, file);

    if (storageError) {
      setUploadError(storageError.message);
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase.from("documents").insert({
      title: title.trim(),
      type: docType,
      category,
      audience,
      status,
      expires_at: expiresAt || null,
      counterparty: counterparty.trim() || null,
      file_path: path,
      partner_id: partnerId || null,
      product_id: productId || null,
      is_shared: isShared,
      is_highlight: isHighlight,
    });

    if (insertError) {
      setUploadError(insertError.message);
      setUploading(false);
      return;
    }

    setUploading(false);
    onUploaded();
  };

  return (
    <div className="mc-card p-5 mb-5 mc-animate-fade">
      <h3
        className="text-xs font-semibold tracking-[0.08em] uppercase mb-4"
        style={{ color: "var(--mc-text-muted)" }}
      >
        Upload New Document
      </h3>
      {uploadError && (
        <div
          className="mb-4 px-3 py-2 text-xs"
          style={{
            background: "var(--mc-error-bg)",
            border: "1px solid var(--mc-error-light)",
            color: "var(--mc-error)",
          }}
        >
          {uploadError}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="mc-label">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mc-input"
            placeholder="Document title"
          />
        </div>
        <div>
          <label className="mc-label">Category *</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as DocumentCategory)}
            className="mc-input mc-select"
          >
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {DOCUMENT_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mc-label">Type *</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocumentType)}
            className="mc-input mc-select"
          >
            {typesForCategory.map((t) => (
              <option key={t} value={t}>
                {DOCUMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mc-label">Audience *</label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value as DocumentAudience)}
            className="mc-input mc-select"
          >
            {DOCUMENT_AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {DOCUMENT_AUDIENCE_LABELS[a]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mc-label">Status *</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as DocumentStatus)}
            className="mc-input mc-select"
          >
            {DOCUMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {DOCUMENT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mc-label">File *</label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mc-input text-xs"
          />
        </div>
        {showExpiry && (
          <div>
            <label className="mc-label">Expires (optional)</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="mc-input"
            />
          </div>
        )}
        {showCounterparty && (
          <div>
            <label className="mc-label">Counterparty (optional)</label>
            <input
              type="text"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              className="mc-input"
              placeholder="e.g. Destilería La Quemada"
            />
          </div>
        )}
        <div>
          <label className="mc-label">Partner (optional)</label>
          <SearchableSelect
            options={partners.map((p) => ({ value: p.id, label: p.name }))}
            value={partnerId}
            onChange={setPartnerId}
            placeholder="Search partners..."
            emptyLabel="None (general document)"
          />
        </div>
        <div>
          <label className="mc-label">Product (optional)</label>
          <SearchableSelect
            options={products.map((p) => ({ value: p.id, label: p.name }))}
            value={productId}
            onChange={setProductId}
            placeholder="Search products..."
            emptyLabel="None (not product-specific)"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-5 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isShared}
            onChange={(e) => setIsShared(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-xs" style={{ color: "var(--mc-text-secondary)" }}>
            Shared with partners
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isHighlight}
            onChange={(e) => setIsHighlight(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-xs" style={{ color: "var(--mc-text-secondary)" }}>
            Portfolio highlight (preview for clients)
          </span>
        </label>
      </div>
      <div className="flex gap-3">
        <button
          onClick={handleUpload}
          disabled={uploading || !title.trim() || !file}
          className="mc-btn mc-btn-primary"
        >
          <Upload className="w-3.5 h-3.5" />
          {uploading ? "Uploading..." : "Upload"}
        </button>
        <button onClick={onCancel} className="mc-btn mc-btn-ghost">
          Cancel
        </button>
      </div>
    </div>
  );
}
