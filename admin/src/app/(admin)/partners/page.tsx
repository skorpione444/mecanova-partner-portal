"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import type { Partner } from "@mecanova/shared";
import { VENUE_TYPE_LABELS } from "@mecanova/shared";
import {
  Users,
  Plus,
  Search,
  Building2,
  User,
  MapPin,
  ArrowRight,
  Factory,
  EyeOff,
} from "lucide-react";

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const supabase = createClient();

  const loadPartners = useCallback(async () => {
    setLoading(true);

    const { data: partnersData } = await supabase
      .from("partners")
      .select("*")
      .order("name");

    setPartners(partnersData ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  const inactiveCount = partners.filter((p) => p.crm_status === "inactive").length;

  const filtered = partners.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.country || "").toLowerCase().includes(search.toLowerCase());

    let matchesType = true;
    if (typeFilter === "buyer") {
      matchesType = p.partner_type === "client" || p.partner_type === "distributor";
    } else if (typeFilter === "supplier") {
      matchesType = p.partner_type === "supplier";
    } else if (typeFilter === "distributor") {
      matchesType = p.partner_type === "distributor";
    } else if (typeFilter !== "all") {
      // venue_type filter
      matchesType = p.partner_type === "client" && p.venue_type === typeFilter;
    }

    const matchesActive = showInactive ? p.crm_status === "inactive" : p.crm_status !== "inactive";
    return matchesSearch && matchesType && matchesActive;
  });

  if (loading) {
    return (
      <div>
        <div className="mc-skeleton h-8 w-48 mb-6" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="mc-skeleton h-16" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Partners"
        description={`${partners.length - inactiveCount} active partners${inactiveCount > 0 ? `, ${inactiveCount} inactive` : ""}`}
        icon={Users}
        actions={
          <div className="flex gap-2">
            {inactiveCount > 0 && (
              <button
                onClick={() => setShowInactive((v) => !v)}
                className="mc-btn mc-btn-ghost"
                style={{ color: showInactive ? "var(--mc-cream)" : "var(--mc-text-muted)" }}
              >
                <EyeOff className="w-3.5 h-3.5" />
                {showInactive ? `Active (${partners.length - inactiveCount})` : `Inactive (${inactiveCount})`}
              </button>
            )}
            <Link href="/partners/new" className="mc-btn mc-btn-primary">
              <Plus className="w-3.5 h-3.5" />
              Add Partner
            </Link>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: "var(--mc-text-muted)" }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mc-input pl-9"
            placeholder="Search partners..."
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="mc-input mc-select w-auto min-w-[180px]"
        >
          <option value="all">All Types</option>
          <optgroup label="Buyers">
            <option value="buyer">All Buyers</option>
            <option value="distributor">Distributor</option>
            <option value="bar">Bar</option>
            <option value="restaurant">Restaurant</option>
            <option value="hotel">Hotel</option>
            <option value="wholesaler">Wholesaler</option>
            <option value="private_customer">Private Customer</option>
            <option value="club">Club</option>
            <option value="other">Other</option>
          </optgroup>
          <optgroup label="Suppliers">
            <option value="supplier">Supplier</option>
          </optgroup>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No partners found"
          description={
            search || typeFilter !== "all"
              ? "Try adjusting your filters"
              : "Add your first partner to get started"
          }
          action={
            !search && typeFilter === "all" ? (
              <Link href="/partners/new" className="mc-btn mc-btn-primary">
                <Plus className="w-3.5 h-3.5" />
                Add Partner
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="mc-card overflow-hidden">
          <table className="mc-table">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Type</th>
                <th>Country</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((partner) => {
                const isSupplier = partner.partner_type === "supplier";
                const isDistributor = partner.partner_type === "distributor";
                const subLabel = isDistributor
                  ? "Distributor"
                  : partner.venue_type
                  ? VENUE_TYPE_LABELS[partner.venue_type]
                  : null;

                return (
                  <tr key={partner.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 flex items-center justify-center flex-shrink-0"
                          style={{
                            background: "rgba(236, 223, 204, 0.06)",
                            border: "1px solid var(--mc-border)",
                          }}
                        >
                          {isDistributor ? (
                            <Building2 className="w-3.5 h-3.5" style={{ color: "var(--mc-cream-subtle)" }} />
                          ) : isSupplier ? (
                            <Factory className="w-3.5 h-3.5" style={{ color: "var(--mc-cream-subtle)" }} />
                          ) : (
                            <User className="w-3.5 h-3.5" style={{ color: "var(--mc-cream-subtle)" }} />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-medium" style={{ color: "var(--mc-text-primary)" }}>
                            {partner.name}
                          </p>
                          {partner.is_mecanova && (
                            <span className="text-[9px] tracking-wider uppercase" style={{ color: "var(--mc-cream-subtle)" }}>
                              Mecanova
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-flex px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
                          style={{
                            background: isSupplier ? "var(--mc-success-bg)" : "var(--mc-info-bg)",
                            border: `1px solid ${isSupplier ? "var(--mc-success-light)" : "var(--mc-info-light)"}`,
                            color: isSupplier ? "var(--mc-success)" : "var(--mc-info)",
                          }}
                        >
                          {isSupplier ? "Supplier" : "Buyer"}
                        </span>
                        {subLabel && (
                          <span
                            className="inline-flex px-1.5 py-0.5 text-[9px] tracking-wide uppercase"
                            style={{
                              background: "var(--mc-surface-elevated)",
                              border: "1px solid var(--mc-border)",
                              color: "var(--mc-text-muted)",
                            }}
                          >
                            {subLabel}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {partner.country ? (
                        <span className="flex items-center gap-1 text-xs">
                          <MapPin className="w-3 h-3" style={{ color: "var(--mc-text-muted)" }} />
                          {partner.country}
                        </span>
                      ) : (
                        <span style={{ color: "var(--mc-text-muted)" }}>—</span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/partners/${partner.id}`}
                        className="inline-flex items-center gap-1 text-[11px] transition-colors"
                        style={{ color: "var(--mc-cream-subtle)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-cream-subtle)")}
                      >
                        View <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
