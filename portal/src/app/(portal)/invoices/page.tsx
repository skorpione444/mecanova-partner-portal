"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from "@mecanova/shared";
import type { UserRole, InvoiceStatus } from "@mecanova/shared";
import Link from "next/link";
import { Receipt, Search, Plus, AlertCircle } from "lucide-react";

const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  info: { bg: "var(--mc-info-bg)", border: "var(--mc-info-light)", text: "var(--mc-info)" },
  warning: { bg: "var(--mc-warning-bg)", border: "var(--mc-warning-light)", text: "var(--mc-warning)" },
  success: { bg: "var(--mc-success-bg)", border: "var(--mc-success-light)", text: "var(--mc-success)" },
  error: { bg: "var(--mc-error-bg)", border: "var(--mc-error-light)", text: "var(--mc-error)" },
};

interface InvoiceRow {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  due_date: string;
  status: InvoiceStatus;
  created_at: string;
  client_id: string;
  distributor_id: string;
  client_name: string | null;
  distributor_name: string | null;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const supabase = createClient();

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, partner_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.partner_id) {
      setLoading(false);
      return;
    }

    setRole(profile.role as UserRole);

    const { data: rows } = await supabase
      .from("invoices")
      .select("id, invoice_number, amount, currency, due_date, status, created_at, client_id, distributor_id")
      .order("created_at", { ascending: false });

    if (!rows) {
      setLoading(false);
      return;
    }

    const partnerIds = new Set<string>();
    rows.forEach((r) => {
      if (r.client_id) partnerIds.add(r.client_id);
      if (r.distributor_id) partnerIds.add(r.distributor_id);
    });

    let partnerMap = new Map<string, string>();
    if (partnerIds.size > 0) {
      const { data: partners } = await supabase
        .from("partners")
        .select("id, name")
        .in("id", [...partnerIds]);
      partnerMap = new Map((partners || []).map((p) => [p.id, p.name]));
    }

    setInvoices(
      rows.map((r) => ({
        ...r,
        status: r.status as InvoiceStatus,
        client_name: partnerMap.get(r.client_id) || null,
        distributor_name: partnerMap.get(r.distributor_id) || null,
      }))
    );
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const isDistributor = role === "distributor";

  const filtered = invoices.filter((inv) => {
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const counterpart = isDistributor ? inv.client_name : inv.distributor_name;
      if (
        !inv.invoice_number.toLowerCase().includes(q) &&
        !(counterpart || "").toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
  };

  return (
    <div>
      <PageHeader
        title="Invoices"
        description={isDistributor ? "Manage and send invoices to clients" : "View your invoices"}
        icon={Receipt}
        actions={
          isDistributor ? (
            <Link href="/invoices/new" className="mc-btn mc-btn-primary inline-flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              New Invoice
            </Link>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: "var(--mc-text-muted)" }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoices..."
            className="mc-input w-full pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="mc-input"
        >
          <option value="all">All Statuses</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="mc-skeleton h-16" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices found"
          description={
            isDistributor
              ? "Upload your first invoice to get started."
              : "No invoices have been sent to you yet."
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((inv) => {
            const colorKey = INVOICE_STATUS_COLORS[inv.status] || "info";
            const colors = COLOR_MAP[colorKey];
            const counterpart = isDistributor ? inv.client_name : inv.distributor_name;
            const counterpartLabel = isDistributor ? "Client" : "From";
            const isOverdue =
              inv.status === "sent" && new Date(inv.due_date) < new Date();

            return (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}`}
                className="mc-card flex items-center gap-4 px-5 py-4 transition-all hover:translate-y-[-1px]"
                style={{ cursor: "pointer" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-semibold font-mono"
                      style={{ color: "var(--mc-text-primary)" }}
                    >
                      {inv.invoice_number}
                    </span>
                    <span
                      className="inline-flex px-2 py-0.5 text-[9px] font-medium tracking-wide uppercase"
                      style={{
                        background: isOverdue
                          ? COLOR_MAP.error.bg
                          : colors.bg,
                        border: `1px solid ${isOverdue ? COLOR_MAP.error.border : colors.border}`,
                        color: isOverdue ? COLOR_MAP.error.text : colors.text,
                      }}
                    >
                      {isOverdue ? "Overdue" : INVOICE_STATUS_LABELS[inv.status]}
                    </span>
                  </div>
                  <p className="text-[11px] mt-1" style={{ color: "var(--mc-text-muted)" }}>
                    {counterpartLabel}: {counterpart || "—"} · Due:{" "}
                    {new Date(inv.due_date + "T00:00:00").toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span
                    className="text-sm font-semibold"
                    style={{
                      fontFamily: "var(--font-jost), Jost, sans-serif",
                      color: "var(--mc-text-primary)",
                    }}
                  >
                    {formatCurrency(inv.amount, inv.currency)}
                  </span>
                  {isOverdue && (
                    <AlertCircle
                      className="w-3.5 h-3.5 ml-2 inline-block"
                      style={{ color: "var(--mc-error)" }}
                    />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
