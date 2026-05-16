"use client";

import { useState } from "react";
import type { Partner } from "@mecanova/shared";
import { VENUE_TYPE_LABELS } from "@mecanova/shared";
import { Search, ChevronDown, ChevronRight, Building2, User, Factory } from "lucide-react";

interface Props {
  partners: Partner[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
}

type TypeFilter = "all" | "mecanova" | "supplier" | "distributor" | "buyer";
type StatusFilter = "all" | "active" | "inactive";

interface Group {
  key: TypeFilter;
  label: string;
  partners: Partner[];
}

export default function PartnersSidebar({ partners, selectedId, loading, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = partners.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.contact_email || "").toLowerCase().includes(q) ||
      (p.country || "").toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" ? p.crm_status !== "inactive" : p.crm_status === "inactive");

    return matchesSearch && matchesStatus;
  });

  const allGroups: Group[] = [
    {
      key: "mecanova",
      label: "Mecanova",
      partners: filtered.filter((p) => p.is_mecanova),
    },
    {
      key: "supplier",
      label: "Suppliers",
      partners: filtered.filter((p) => p.partner_type === "supplier" && !p.is_mecanova),
    },
    {
      key: "distributor",
      label: "Distributors",
      partners: filtered.filter((p) => p.partner_type === "distributor"),
    },
    {
      key: "buyer",
      label: "Buyers",
      partners: filtered.filter((p) => p.partner_type === "client"),
    },
  ];

  const visibleGroups = allGroups.filter((g) => {
    if (typeFilter !== "all" && g.key !== typeFilter) return false;
    return g.partners.length > 0;
  });

  const chips: { key: TypeFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "mecanova", label: "Mecanova" },
    { key: "supplier", label: "Suppliers" },
    { key: "distributor", label: "Distributors" },
    { key: "buyer", label: "Buyers" },
  ];

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div
      style={{
        width: 300,
        flexShrink: 0,
        borderRight: "1px solid var(--mc-border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Search */}
      <div style={{ padding: "12px 12px 10px", borderBottom: "1px solid var(--mc-border)" }}>
        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3"
            style={{ color: "var(--mc-text-muted)" }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mc-input w-full"
            style={{ paddingLeft: 28, fontSize: "0.6875rem", height: 32 }}
            placeholder="Search partners…"
          />
        </div>
      </div>

      {/* Type chips + status filter */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--mc-border)",
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          alignItems: "center",
        }}
      >
        {chips.map((chip) => (
          <button
            key={chip.key}
            onClick={() => setTypeFilter(chip.key)}
            style={{
              background: typeFilter === chip.key ? "rgba(236,223,204,0.12)" : "transparent",
              border: `1px solid ${typeFilter === chip.key ? "var(--mc-cream-subtle)" : "var(--mc-border)"}`,
              color: typeFilter === chip.key ? "var(--mc-cream)" : "var(--mc-text-muted)",
              cursor: "pointer",
              padding: "2px 8px",
              fontSize: "0.5625rem",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              transition: "all 0.15s",
            }}
          >
            {chip.label}
          </button>
        ))}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="mc-input"
          style={{ fontSize: "0.5625rem", height: 22, padding: "0 6px", minWidth: 64, marginLeft: "auto" }}
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Groups */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: 12 }} className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="mc-skeleton h-8" />
            ))}
          </div>
        ) : visibleGroups.length === 0 ? (
          <div
            style={{ padding: 24, textAlign: "center", color: "var(--mc-text-muted)", fontSize: "0.6875rem" }}
          >
            No partners found
          </div>
        ) : (
          visibleGroups.map((group) => {
            const isCollapsed = !!collapsed[group.key];
            return (
              <div key={group.key}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.key)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "7px 12px",
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid var(--mc-border)",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(236,223,204,0.03)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {isCollapsed ? (
                      <ChevronRight className="w-3 h-3" style={{ color: "var(--mc-text-muted)" }} />
                    ) : (
                      <ChevronDown className="w-3 h-3" style={{ color: "var(--mc-text-muted)" }} />
                    )}
                    <span
                      style={{
                        fontSize: "0.5625rem",
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--mc-text-muted)",
                      }}
                    >
                      {group.label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "0.5625rem",
                      padding: "0 4px",
                      background: "var(--mc-surface-elevated)",
                      border: "1px solid var(--mc-border)",
                      color: "var(--mc-text-muted)",
                    }}
                  >
                    {group.partners.length}
                  </span>
                </button>

                {/* Partner rows */}
                {!isCollapsed &&
                  group.partners.map((p) => {
                    const isSelected = p.id === selectedId;
                    const isInactive = p.crm_status === "inactive";
                    const isSupplier = p.partner_type === "supplier";
                    const isDistributor = p.partner_type === "distributor";
                    const subLabel =
                      isDistributor
                        ? "Distributor"
                        : p.venue_type
                        ? VENUE_TYPE_LABELS[p.venue_type]
                        : p.country || null;

                    return (
                      <button
                        key={p.id}
                        onClick={() => onSelect(p.id)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "9px 12px",
                          background: isSelected ? "rgba(236,223,204,0.08)" : "transparent",
                          border: "none",
                          borderLeft: isSelected ? "2px solid var(--mc-cream)" : "2px solid transparent",
                          borderBottom: "1px solid var(--mc-border)",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected)
                            e.currentTarget.style.background = "rgba(236,223,204,0.04)";
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = "transparent";
                        }}
                      >
                        {/* Type icon */}
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "rgba(236, 223, 204, 0.04)",
                            border: "1px solid var(--mc-border)",
                          }}
                        >
                          {isDistributor ? (
                            <Building2
                              className="w-3 h-3"
                              style={{ color: "var(--mc-cream-subtle)" }}
                            />
                          ) : isSupplier ? (
                            <Factory
                              className="w-3 h-3"
                              style={{ color: "var(--mc-cream-subtle)" }}
                            />
                          ) : (
                            <User
                              className="w-3 h-3"
                              style={{ color: "var(--mc-cream-subtle)" }}
                            />
                          )}
                        </div>

                        {/* Name + sublabel */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              fontSize: "0.6875rem",
                              fontWeight: 500,
                              color: isSelected ? "var(--mc-cream)" : "var(--mc-text-primary)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              margin: 0,
                            }}
                          >
                            {p.name}
                          </p>
                          {subLabel && (
                            <p
                              style={{
                                fontSize: "0.5625rem",
                                color: "var(--mc-text-muted)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                margin: 0,
                              }}
                            >
                              {subLabel}
                            </p>
                          )}
                        </div>

                        {/* Status dot */}
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            flexShrink: 0,
                            background: isInactive ? "var(--mc-error)" : "var(--mc-success)",
                            opacity: 0.7,
                          }}
                        />
                      </button>
                    );
                  })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
