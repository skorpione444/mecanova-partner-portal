"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  FileText,
  ShoppingCart,
  Receipt,
  AlertCircle,
} from "lucide-react";

export default function DashboardPage() {
  const [profile, setProfile] = useState<{
    full_name: string | null;
    role: string;
    partner_id: string | null;
  } | null>(null);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [distributorName, setDistributorName] = useState<string | null>(null);
  const [openInvoiceCount, setOpenInvoiceCount] = useState<number>(0);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, role, partner_id")
        .eq("user_id", user.id)
        .single();

      if (prof) {
        setProfile(prof);
        if (prof.partner_id) {
          const { data: partner } = await supabase
            .from("partners")
            .select("name")
            .eq("id", prof.partner_id)
            .single();
          if (partner) setPartnerName(partner.name);

          if (prof.role === "client") {
            const { data: cd } = await supabase
              .from("client_distributors")
              .select("distributor_id")
              .eq("client_id", prof.partner_id)
              .eq("is_default", true)
              .single();
            if (cd) {
              const { data: dist } = await supabase
                .from("partners")
                .select("name")
                .eq("id", cd.distributor_id)
                .single();
              if (dist) setDistributorName(dist.name);
            }
          }

          // Count open invoices
          const invoiceCol =
            prof.role === "distributor" ? "distributor_id" : "client_id";
          const { count } = await supabase
            .from("invoices")
            .select("id", { count: "exact", head: true })
            .eq(invoiceCol, prof.partner_id)
            .in("status", ["sent", "overdue"]);
          setOpenInvoiceCount(count ?? 0);
        }
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const greeting = profile?.full_name
    ? `Welcome back, ${profile.full_name}`
    : "Welcome to Mecanova";

  return (
    <div>
      <PageHeader
        title={greeting}
        description={
          partnerName
            ? `${partnerName}${distributorName ? ` · Distributor: ${distributorName}` : ""}`
            : undefined
        }
        icon={LayoutDashboard}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mc-stagger">
        {/* Open Invoices Widget */}
        <Link
          href="/invoices"
          className="mc-card p-5 group transition-all hover:translate-y-[-1px]"
          style={{ cursor: "pointer" }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Receipt
              className="w-5 h-5"
              style={{ color: "var(--mc-cream-subtle)" }}
              strokeWidth={1.5}
            />
            <span
              className="text-sm font-medium"
              style={{ color: "var(--mc-text-primary)" }}
            >
              Open Invoices
            </span>
          </div>
          <div className="flex items-end justify-between">
            <span
              className="text-xl font-semibold tracking-tight"
              style={{
                color:
                  openInvoiceCount > 0
                    ? "var(--mc-warning)"
                    : "var(--mc-text-primary)",
              }}
            >
              {openInvoiceCount}
            </span>
            {openInvoiceCount > 0 && (
              <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--mc-warning)" }}>
                <AlertCircle className="w-3 h-3" />
                needs attention
              </span>
            )}
          </div>
        </Link>

        <Link
          href="/products"
          className="mc-card p-5 group transition-all hover:translate-y-[-1px]"
          style={{ cursor: "pointer" }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Package
              className="w-5 h-5"
              style={{ color: "var(--mc-cream-subtle)" }}
              strokeWidth={1.5}
            />
            <span
              className="text-sm font-medium"
              style={{ color: "var(--mc-text-primary)" }}
            >
              Products
            </span>
          </div>
          <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
            Browse the product catalogue and download assets
          </p>
        </Link>

        <Link
          href="/documents"
          className="mc-card p-5 group transition-all hover:translate-y-[-1px]"
          style={{ cursor: "pointer" }}
        >
          <div className="flex items-center gap-3 mb-2">
            <FileText
              className="w-5 h-5"
              style={{ color: "var(--mc-cream-subtle)" }}
              strokeWidth={1.5}
            />
            <span
              className="text-sm font-medium"
              style={{ color: "var(--mc-text-primary)" }}
            >
              Documents
            </span>
          </div>
          <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
            Access presentations, fact sheets, and compliance documents
          </p>
        </Link>

        <Link
          href="/orders"
          className="mc-card p-5 group transition-all hover:translate-y-[-1px]"
          style={{ cursor: "pointer" }}
        >
          <div className="flex items-center gap-3 mb-2">
            <ShoppingCart
              className="w-5 h-5"
              style={{ color: "var(--mc-cream-subtle)" }}
              strokeWidth={1.5}
            />
            <span
              className="text-sm font-medium"
              style={{ color: "var(--mc-text-primary)" }}
            >
              Orders
            </span>
          </div>
          <p className="text-xs" style={{ color: "var(--mc-text-muted)" }}>
            Create and track your orders
          </p>
        </Link>
      </div>
    </div>
  );
}
