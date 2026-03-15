"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import Link from "next/link";
import { Receipt, ArrowLeft, Upload, Loader2 } from "lucide-react";

interface ClientOption {
  id: string;
  name: string;
}

function NewInvoiceForm() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const loadClients = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, partner_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.partner_id || profile.role !== "distributor") {
      router.push("/invoices");
      return;
    }

    setPartnerId(profile.partner_id);

    const { data: links } = await supabase
      .from("client_distributors")
      .select("client_id")
      .eq("distributor_id", profile.partner_id);

    if (links && links.length > 0) {
      const clientIds = links.map((l) => l.client_id);
      const { data: partners } = await supabase
        .from("partners")
        .select("id, name")
        .in("id", clientIds)
        .order("name");
      setClients(partners || []);
      const prefilledClient = searchParams.get("client");
      if (prefilledClient && partners?.find((p) => p.id === prefilledClient)) {
        setClientId(prefilledClient);
      }
    }

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !partnerId) return;

    setSubmitting(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const ext = file.name.split(".").pop() || "pdf";
      const storagePath = `invoices/${partnerId}/${Date.now()}_${invoiceNumber.replace(/[^a-zA-Z0-9]/g, "_")}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("documents")
        .upload(storagePath, file, { upsert: false });

      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

      const { error: insertErr } = await supabase.from("invoices").insert({
        invoice_number: invoiceNumber.trim(),
        distributor_id: partnerId,
        client_id: clientId,
        amount: parseFloat(amount),
        currency,
        due_date: dueDate,
        file_path: storagePath,
        notes: notes.trim() || null,
        created_by_user: user.id,
      });

      if (insertErr) throw new Error(insertErr.message);

      router.push("/invoices");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div>
        <div className="mc-skeleton h-6 w-48 mb-6" />
        <div className="mc-skeleton h-96 max-w-lg" />
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/invoices"
        className="inline-flex items-center gap-1.5 text-[11px] tracking-wide mb-4 transition-colors"
        style={{ color: "var(--mc-text-muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-text-muted)")}
      >
        <ArrowLeft className="w-3 h-3" />
        Back to Invoices
      </Link>

      <PageHeader title="New Invoice" description="Upload and assign an invoice to a client" icon={Receipt} />

      {error && (
        <div
          className="mb-5 px-4 py-3 text-xs max-w-lg"
          style={{
            background: "var(--mc-error-bg)",
            border: "1px solid var(--mc-error-light)",
            color: "var(--mc-error)",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
        <div className="mc-card p-5 space-y-4">
          <div>
            <label
              className="block text-[10px] font-semibold tracking-[0.08em] uppercase mb-1.5"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Invoice Number *
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="mc-input w-full"
              placeholder="e.g. INV-2026-001"
              required
            />
          </div>

          <div>
            <label
              className="block text-[10px] font-semibold tracking-[0.08em] uppercase mb-1.5"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Client *
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="mc-input w-full"
              required
            >
              <option value="">Select a client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className="block text-[10px] font-semibold tracking-[0.08em] uppercase mb-1.5"
                style={{ color: "var(--mc-text-muted)" }}
              >
                Amount *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mc-input w-full"
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label
                className="block text-[10px] font-semibold tracking-[0.08em] uppercase mb-1.5"
                style={{ color: "var(--mc-text-muted)" }}
              >
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mc-input w-full"
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="CHF">CHF</option>
                <option value="MXN">MXN</option>
              </select>
            </div>
          </div>

          <div>
            <label
              className="block text-[10px] font-semibold tracking-[0.08em] uppercase mb-1.5"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Due Date *
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mc-input w-full"
              min={new Date().toISOString().split("T")[0]}
              required
            />
          </div>

          <div>
            <label
              className="block text-[10px] font-semibold tracking-[0.08em] uppercase mb-1.5"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Invoice File (PDF) *
            </label>
            <div
              className="relative flex items-center justify-center py-8 px-4 transition-colors cursor-pointer"
              style={{
                border: "1px dashed var(--mc-border)",
                background: file ? "var(--mc-success-bg)" : "var(--mc-surface-warm)",
              }}
            >
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                required
              />
              <div className="flex flex-col items-center gap-2 text-center">
                <Upload
                  className="w-5 h-5"
                  style={{ color: file ? "var(--mc-success)" : "var(--mc-text-muted)" }}
                />
                <span
                  className="text-xs"
                  style={{ color: file ? "var(--mc-success)" : "var(--mc-text-muted)" }}
                >
                  {file ? file.name : "Click to upload or drag and drop"}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label
              className="block text-[10px] font-semibold tracking-[0.08em] uppercase mb-1.5"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mc-input w-full"
              rows={3}
              placeholder="Additional notes..."
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || !file || !clientId || !invoiceNumber || !amount || !dueDate}
          className="mc-btn mc-btn-primary inline-flex items-center gap-1.5"
        >
          {submitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-3.5 h-3.5" />
              Create Invoice
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={
      <div>
        <div className="mc-skeleton h-6 w-48 mb-6" />
        <div className="mc-skeleton h-96 max-w-lg" />
      </div>
    }>
      <NewInvoiceForm />
    </Suspense>
  );
}
