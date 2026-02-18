"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import type { Partner } from "@mecanova/shared";
import { PARTNER_TYPE_LABELS } from "@mecanova/shared";
import {
  Users,
  Plus,
  Search,
  Building2,
  User,
  MapPin,
  ArrowRight,
  Factory,
} from "lucide-react";

type PartnerWithProfile = Partner & {
  user_count: number;
};

export default function PartnersPage() {
  const [partners, setPartners] = useState<PartnerWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const supabase = createClient();

  const loadPartners = useCallback(async () => {
    setLoading(true);

    const { data: partnersData } = await supabase
      .from("partners")
      .select("*")
      .order("name");

    if (!partnersData) {
      setLoading(false);
      return;
    }

    // Get profile counts per partner
    const { data: profiles } = await supabase
      .from("profiles")
      .select("partner_id");

    const countMap = new Map<string, number>();
    (profiles || []).forEach((p) => {
      if (p.partner_id) {
        countMap.set(p.partner_id, (countMap.get(p.partner_id) || 0) + 1);
      }
    });

    const enriched: PartnerWithProfile[] = partnersData.map((p) => ({
      ...p,
      user_count: countMap.get(p.id) || 0,
    }));

    setPartners(enriched);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  const filtered = partners.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.country || "").toLowerCase().includes(search.toLowerCase());
    const matchesType =
      typeFilter === "all" || p.partner_type === typeFilter;
    return matchesSearch && matchesType;
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
        description={`${partners.length} partners registered`}
        icon={Users}
        actions={
          <Link href="/partners/new" className="mc-btn mc-btn-primary">
            <Plus className="w-3.5 h-3.5" />
            Add Partner
          </Link>
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
          className="mc-input mc-select w-auto min-w-[160px]"
        >
          <option value="all">All Types</option>
          <option value="distributor">Distributors</option>
          <option value="client">Buyers</option>
          <option value="supplier">Suppliers</option>
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
                <th>Users</th>
                <th>VAT ID</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((partner) => (
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
                        {partner.partner_type === "distributor" ? (
                          <Building2
                            className="w-3.5 h-3.5"
                            style={{ color: "var(--mc-cream-subtle)" }}
                          />
                        ) : partner.partner_type === "supplier" ? (
                          <Factory
                            className="w-3.5 h-3.5"
                            style={{ color: "var(--mc-cream-subtle)" }}
                          />
                        ) : (
                          <User
                            className="w-3.5 h-3.5"
                            style={{ color: "var(--mc-cream-subtle)" }}
                          />
                        )}
                      </div>
                      <div>
                        <p
                          className="text-xs font-medium"
                          style={{ color: "var(--mc-text-primary)" }}
                        >
                          {partner.name}
                        </p>
                        {partner.is_mecanova && (
                          <span
                            className="text-[9px] tracking-wider uppercase"
                            style={{ color: "var(--mc-cream-subtle)" }}
                          >
                            Mecanova
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      className="inline-flex px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
                      style={{
                        background:
                          partner.partner_type === "distributor"
                            ? "var(--mc-info-bg)"
                            : partner.partner_type === "supplier"
                            ? "var(--mc-success-bg)"
                            : "var(--mc-warning-bg)",
                        border: `1px solid ${
                          partner.partner_type === "distributor"
                            ? "var(--mc-info-light)"
                            : partner.partner_type === "supplier"
                            ? "var(--mc-success-light)"
                            : "var(--mc-warning-light)"
                        }`,
                        color:
                          partner.partner_type === "distributor"
                            ? "var(--mc-info)"
                            : partner.partner_type === "supplier"
                            ? "var(--mc-success)"
                            : "var(--mc-warning)",
                      }}
                    >
                      {PARTNER_TYPE_LABELS[partner.partner_type]}
                    </span>
                  </td>
                  <td>
                    {partner.country ? (
                      <span className="flex items-center gap-1 text-xs">
                        <MapPin
                          className="w-3 h-3"
                          style={{ color: "var(--mc-text-muted)" }}
                        />
                        {partner.country}
                      </span>
                    ) : (
                      <span style={{ color: "var(--mc-text-muted)" }}>—</span>
                    )}
                  </td>
                  <td>{partner.user_count}</td>
                  <td>
                    <span
                      className="text-xs"
                      style={{ color: "var(--mc-text-muted)" }}
                    >
                      {partner.vat_id || "—"}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`/partners/${partner.id}`}
                      className="inline-flex items-center gap-1 text-[11px] transition-colors"
                      style={{ color: "var(--mc-cream-subtle)" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "var(--mc-cream)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color =
                          "var(--mc-cream-subtle)")
                      }
                    >
                      View <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}



