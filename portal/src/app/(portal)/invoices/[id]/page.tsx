"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from "@mecanova/shared";
import type { UserRole, InvoiceStatus } from "@mecanova/shared";
import {
  Receipt,
  ArrowLeft,
  Download,
  CheckCircle,
  Bell,
  Calendar,
  Building2,
  CreditCard,
  Loader2,
} from "lucide-react";

const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  info: { bg: "var(--mc-info-bg)", border: "var(--mc-info-light)", text: "var(--mc-info)" },
  warning: { bg: "var(--mc-warning-bg)", border: "var(--mc-warning-light)", text: "var(--mc-warning)" },
  success: { bg: "var(--mc-success-bg)", border: "var(--mc-success-light)", text: "var(--mc-success)" },
  error: { bg: "var(--mc-error-bg)", border: "var(--mc-error-light)", text: "var(--mc-error)" },
};

interface InvoiceDetail {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  due_date: string;
  status: InvoiceStatus;
  file_path: string;
  notes: string | null;
  created_at: string;
  paid_at: string | null;
  last_reminder_at: string | null;
  client_id: string;
  distributor_id: string;
  client_name: string | null;
  distributor_name: string | null;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const supabase = createClient();

  const loadInvoice = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (profile) setRole(profile.role as UserRole);

    const { data: inv } = await supabase.from("invoices").select("*").eq("id", id).single();
    if (!inv) {
      setLoading(false);
      return;
    }

    let client_name: string | null = null;
    let distributor_name: string | null = null;

    if (inv.client_id) {
      const { data: c } = await supabase.from("partners").select("name").eq("id", inv.client_id).single();
      client_name = c?.name || null;
    }
    if (inv.distributor_id) {
      const { data: d } = await supabase
        .from("partners")
        .select("name")
        .eq("id", inv.distributor_id)
        .single();
      distributor_name = d?.name || null;
    }

    setInvoice({
      id: inv.id,
      invoice_number: inv.invoice_number,
      amount: inv.amount,
      currency: inv.currency,
      due_date: inv.due_date,
      status: inv.status as InvoiceStatus,
      file_path: inv.file_path,
      notes: inv.notes,
      created_at: inv.created_at,
      paid_at: inv.paid_at,
      last_reminder_at: inv.last_reminder_at,
      client_id: inv.client_id,
      distributor_id: inv.distributor_id,
      client_name,
      distributor_name,
    });
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  const handleMarkPaid = async () => {
    setActionLoading("paid");
    setActionError(null);
    setActionSuccess(null);
    const { error } = await supabase
      .from("invoices")
      .update({ status: "paid" as InvoiceStatus, paid_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setActionError(error.message);
    } else {
      setActionSuccess("Invoice marked as paid.");
      await loadInvoice();
    }
    setActionLoading(null);
  };

  const handleSendReminder = async () => {
    setActionLoading("reminder");
    setActionError(null);
    setActionSuccess(null);
    const { error } = await supabase.rpc("send_invoice_reminder", { p_invoice_id: id });
    if (error) {
      setActionError(error.message);
    } else {
      setActionSuccess("Reminder email has been queued for delivery.");
      await loadInvoice();
    }
    setActionLoading(null);
  };

  const handleDownload = async () => {
    if (!invoice) return;
    setActionLoading("download");
    const { data } = await supabase.storage.from("documents").createSignedUrl(invoice.file_path, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
    setActionLoading(null);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date.includes("T") ? date : date + "T00:00:00").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div>
        <div className="mc-skeleton h-6 w-48 mb-6" />
        <div className="mc-skeleton h-64 max-w-2xl" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div>
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1.5 text-[11px] tracking-wide mb-4"
          style={{ color: "var(--mc-text-muted)" }}
        >
          <ArrowLeft className="w-3 h-3" /> Back to Invoices
        </Link>
        <p className="text-sm" style={{ color: "var(--mc-text-muted)" }}>
          Invoice not found.
        </p>
      </div>
    );
  }

  const isDistributor = role === "distributor";
  const isOverdue = invoice.status === "sent" && new Date(invoice.due_date) < new Date();
  const effectiveStatus = isOverdue ? "overdue" : invoice.status;
  const colorKey = INVOICE_STATUS_COLORS[effectiveStatus] || "info";
  const colors = COLOR_MAP[colorKey];

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

      <PageHeader
        title={`Invoice ${invoice.invoice_number}`}
        description={
          isDistributor
            ? `Client: ${invoice.client_name || "—"}`
            : `From: ${invoice.distributor_name || "—"}`
        }
        icon={Receipt}
        actions={
          <span
            className="inline-flex px-3 py-1 text-[10px] font-medium tracking-wide uppercase"
            style={{
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              color: colors.text,
            }}
          >
            {isOverdue ? "Overdue" : INVOICE_STATUS_LABELS[invoice.status]}
          </span>
        }
      />

      {actionError && (
        <div
          className="mb-5 px-4 py-3 text-xs max-w-2xl"
          style={{
            background: "var(--mc-error-bg)",
            border: "1px solid var(--mc-error-light)",
            color: "var(--mc-error)",
          }}
        >
          {actionError}
        </div>
      )}

      {actionSuccess && (
        <div
          className="mb-5 px-4 py-3 text-xs max-w-2xl"
          style={{
            background: "var(--mc-success-bg)",
            border: "1px solid var(--mc-success-light)",
            color: "var(--mc-success)",
          }}
        >
          {actionSuccess}
        </div>
      )}

      <div className="max-w-2xl space-y-5">
        {/* Distributor Actions */}
        {isDistributor && invoice.status !== "paid" && (
          <div className="mc-card p-5">
            <h3
              className="text-xs font-semibold tracking-[0.08em] uppercase mb-3"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Actions
            </h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleMarkPaid}
                disabled={actionLoading !== null}
                className="mc-btn mc-btn-primary inline-flex items-center gap-1.5"
              >
                {actionLoading === "paid" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5" />
                )}
                {actionLoading === "paid" ? "Updating..." : "Mark as Paid"}
              </button>
              <button
                onClick={handleSendReminder}
                disabled={actionLoading !== null}
                className="mc-btn inline-flex items-center gap-1.5"
                style={{
                  background: "transparent",
                  border: "1px solid var(--mc-warning-light)",
                  color: "var(--mc-warning)",
                }}
              >
                {actionLoading === "reminder" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Bell className="w-3.5 h-3.5" />
                )}
                {actionLoading === "reminder" ? "Sending..." : "Send Reminder"}
              </button>
            </div>
            {invoice.last_reminder_at && (
              <p className="text-[10px] mt-3" style={{ color: "var(--mc-text-muted)" }}>
                Last reminder sent: {formatDate(invoice.last_reminder_at)}
              </p>
            )}
          </div>
        )}

        {/* Invoice Details */}
        <div className="mc-card p-5">
          <h3
            className="text-xs font-semibold tracking-[0.08em] uppercase mb-4"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Invoice Details
          </h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="flex items-start gap-2.5">
              <CreditCard
                className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                style={{ color: "var(--mc-cream-subtle)" }}
              />
              <div>
                <span style={{ color: "var(--mc-text-muted)" }}>Amount</span>
                <p
                  className="mt-0.5 text-sm font-semibold"
                  style={{
                    fontFamily: "var(--font-jost), Jost, sans-serif",
                    color: "var(--mc-text-primary)",
                  }}
                >
                  {formatCurrency(invoice.amount, invoice.currency)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Calendar
                className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                style={{ color: "var(--mc-cream-subtle)" }}
              />
              <div>
                <span style={{ color: "var(--mc-text-muted)" }}>Due Date</span>
                <p
                  className="mt-0.5"
                  style={{
                    color: isOverdue ? "var(--mc-error)" : "var(--mc-text-primary)",
                    fontWeight: isOverdue ? 600 : 400,
                  }}
                >
                  {formatDate(invoice.due_date)}
                  {isOverdue && " (overdue)"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Building2
                className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                style={{ color: "var(--mc-cream-subtle)" }}
              />
              <div>
                <span style={{ color: "var(--mc-text-muted)" }}>
                  {isDistributor ? "Client" : "From"}
                </span>
                <p className="mt-0.5" style={{ color: "var(--mc-text-primary)" }}>
                  {isDistributor ? invoice.client_name : invoice.distributor_name || "—"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Receipt
                className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                style={{ color: "var(--mc-cream-subtle)" }}
              />
              <div>
                <span style={{ color: "var(--mc-text-muted)" }}>Invoice Number</span>
                <p className="mt-0.5 font-mono" style={{ color: "var(--mc-text-primary)" }}>
                  {invoice.invoice_number}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Calendar
                className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                style={{ color: "var(--mc-cream-subtle)" }}
              />
              <div>
                <span style={{ color: "var(--mc-text-muted)" }}>Created</span>
                <p className="mt-0.5" style={{ color: "var(--mc-text-primary)" }}>
                  {formatDate(invoice.created_at)}
                </p>
              </div>
            </div>

            {invoice.paid_at && (
              <div className="flex items-start gap-2.5">
                <CheckCircle
                  className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                  style={{ color: "var(--mc-success)" }}
                />
                <div>
                  <span style={{ color: "var(--mc-text-muted)" }}>Paid On</span>
                  <p className="mt-0.5" style={{ color: "var(--mc-success)" }}>
                    {formatDate(invoice.paid_at)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="mc-card p-5">
            <h3
              className="text-xs font-semibold tracking-[0.08em] uppercase mb-3"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Notes
            </h3>
            <p className="text-xs" style={{ color: "var(--mc-text-secondary)" }}>
              {invoice.notes}
            </p>
          </div>
        )}

        {/* Download */}
        <div className="mc-card p-5">
          <h3
            className="text-xs font-semibold tracking-[0.08em] uppercase mb-3"
            style={{ color: "var(--mc-text-muted)" }}
          >
            Document
          </h3>
          <button
            onClick={handleDownload}
            disabled={actionLoading === "download"}
            className="mc-btn inline-flex items-center gap-1.5"
            style={{
              background: "transparent",
              border: "1px solid var(--mc-border)",
              color: "var(--mc-text-primary)",
            }}
          >
            {actionLoading === "download" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Download Invoice
          </button>
        </div>
      </div>
    </div>
  );
}
