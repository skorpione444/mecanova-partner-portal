"use client";

import { useState } from "react";
import { List, Columns, GitBranch, Search, X, Plus, ChevronDown, SlidersHorizontal, Settings2 } from "lucide-react";
import type { Status, ViewType, FilterState } from "./lib/types";
import { EMPTY_FILTERS } from "./lib/types";

interface Props {
  view: ViewType;
  onViewChange: (v: ViewType) => void;
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
  statuses: Status[];
  onNewTask: () => void;
  onEditStatuses: () => void;
  availableTags?: string[];
  availableAssignees?: string[];
}

const VIEWS: { id: ViewType; label: string; Icon: React.FC<{ size: number }> }[] = [
  { id: "list",   label: "List",     Icon: List },
  { id: "kanban", label: "Kanban",   Icon: Columns },
  { id: "mmap",   label: "Mind Map", Icon: GitBranch },
];

const SELECT_STYLE = {
  appearance: "none" as const,
  paddingLeft: 10,
  paddingRight: 24,
  paddingTop: 5,
  paddingBottom: 5,
  fontSize: 12,
  background: "var(--mc-surface)",
  border: "1px solid var(--mc-border)",
  color: "var(--mc-text-muted)",
  cursor: "pointer",
};

export default function Toolbar({
  view, onViewChange, filters, onFiltersChange, statuses, onNewTask, onEditStatuses,
  availableTags = [], availableAssignees = [],
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const basicActive = filters.search !== "" || filters.statusId !== "" || filters.priority !== "";
  const advancedActive = filters.tag !== "" || filters.assignee !== "" || filters.overdue || filters.dueFrom !== "" || filters.dueTo !== "";
  const advancedCount = [filters.tag, filters.assignee, filters.overdue ? "1" : "", filters.dueFrom, filters.dueTo].filter(Boolean).length;
  const hasActiveFilters = basicActive || advancedActive;

  return (
    <div
      style={{
        borderBottom: "1px solid var(--mc-border)",
        background: "var(--mc-surface-warm)",
        flexShrink: 0,
      }}
    >
      {/* Primary row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 20px", flexWrap: "wrap", rowGap: 8 }}>
        {/* View switcher */}
        <div style={{ display: "flex", border: "1px solid var(--mc-border)", overflow: "hidden" }}>
          {VIEWS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => onViewChange(id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 11px",
                fontSize: 12,
                fontWeight: 500,
                background: view === id ? "var(--mc-surface-elevated)" : "transparent",
                color: view === id ? "var(--mc-text-primary)" : "var(--mc-text-muted)",
                border: "none",
                borderRight: "1px solid var(--mc-border)",
                cursor: "pointer",
              }}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 180px", maxWidth: 280 }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--mc-text-muted)", pointerEvents: "none" }} />
          <input
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            placeholder="Search tasks…"
            style={{
              width: "100%",
              paddingLeft: 28,
              paddingRight: filters.search ? 28 : 10,
              paddingTop: 5,
              paddingBottom: 5,
              fontSize: 12,
              background: "var(--mc-surface)",
              border: "1px solid var(--mc-border)",
              color: "var(--mc-text-primary)",
              outline: "none",
            }}
          />
          {filters.search && (
            <button
              onClick={() => onFiltersChange({ ...filters, search: "" })}
              style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--mc-text-muted)", padding: 2, display: "flex" }}
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div style={{ position: "relative" }}>
          <select
            value={filters.statusId}
            onChange={(e) => onFiltersChange({ ...filters, statusId: e.target.value })}
            style={{ ...SELECT_STYLE, color: filters.statusId ? "var(--mc-text-primary)" : "var(--mc-text-muted)" }}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <ChevronDown size={11} style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--mc-text-muted)" }} />
        </div>

        {/* Priority filter */}
        <div style={{ position: "relative" }}>
          <select
            value={filters.priority}
            onChange={(e) => onFiltersChange({ ...filters, priority: e.target.value })}
            style={{ ...SELECT_STYLE, color: filters.priority ? "var(--mc-text-primary)" : "var(--mc-text-muted)" }}
          >
            <option value="">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <ChevronDown size={11} style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--mc-text-muted)" }} />
        </div>

        {/* Filters disclosure toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 10px",
            fontSize: 12,
            background: expanded || advancedActive ? "var(--mc-surface-elevated)" : "transparent",
            border: "1px solid var(--mc-border)",
            color: advancedActive ? "var(--mc-text-primary)" : "var(--mc-text-muted)",
            cursor: "pointer",
          }}
        >
          <SlidersHorizontal size={12} />
          Filters
          {advancedCount > 0 && (
            <span style={{
              minWidth: 16,
              height: 16,
              lineHeight: "16px",
              textAlign: "center",
              background: "var(--mc-cream)",
              color: "var(--mc-text-inverse)",
              fontSize: 10,
              fontWeight: 700,
              padding: "0 4px",
            }}>
              {advancedCount}
            </span>
          )}
        </button>

        {/* Edit statuses */}
        <button
          onClick={onEditStatuses}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 10px",
            fontSize: 12,
            background: "transparent",
            border: "1px solid var(--mc-border)",
            color: "var(--mc-text-muted)",
            cursor: "pointer",
          }}
        >
          <Settings2 size={12} />
          Edit statuses
        </button>

        {/* Clear filters pill */}
        {hasActiveFilters && (
          <button
            onClick={() => { onFiltersChange(EMPTY_FILTERS); setExpanded(false); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 9px",
              fontSize: 11,
              background: "var(--mc-surface)",
              border: "1px solid var(--mc-border-warm)",
              color: "var(--mc-text-muted)",
              cursor: "pointer",
            }}
          >
            <X size={10} /> Clear
          </button>
        )}

        <div style={{ flex: 1 }} />

        {/* New Task */}
        <button
          onClick={onNewTask}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 600,
            background: "var(--mc-cream)",
            color: "var(--mc-text-inverse)",
            border: "none",
            cursor: "pointer",
            letterSpacing: "0.02em",
          }}
        >
          <Plus size={13} />
          New Task
        </button>
      </div>

      {/* Advanced filter row */}
      {expanded && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 20px 10px",
          flexWrap: "wrap",
          rowGap: 8,
          borderTop: "1px solid var(--mc-border-light)",
        }}>
          {/* Tag filter */}
          {availableTags.length > 0 && (
            <div style={{ position: "relative" }}>
              <select
                value={filters.tag}
                onChange={(e) => onFiltersChange({ ...filters, tag: e.target.value })}
                style={{ ...SELECT_STYLE, color: filters.tag ? "var(--mc-text-primary)" : "var(--mc-text-muted)" }}
              >
                <option value="">Tag: all</option>
                {availableTags.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown size={11} style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--mc-text-muted)" }} />
            </div>
          )}

          {/* Assignee filter */}
          {availableAssignees.length > 0 && (
            <div style={{ position: "relative" }}>
              <select
                value={filters.assignee}
                onChange={(e) => onFiltersChange({ ...filters, assignee: e.target.value })}
                style={{ ...SELECT_STYLE, color: filters.assignee ? "var(--mc-text-primary)" : "var(--mc-text-muted)" }}
              >
                <option value="">Assignee: all</option>
                {availableAssignees.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <ChevronDown size={11} style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--mc-text-muted)" }} />
            </div>
          )}

          {/* Overdue toggle */}
          <button
            onClick={() => onFiltersChange({ ...filters, overdue: !filters.overdue })}
            style={{
              padding: "5px 10px",
              fontSize: 12,
              background: filters.overdue ? "rgba(196,90,90,0.15)" : "var(--mc-surface)",
              border: `1px solid ${filters.overdue ? "#c45a5a" : "var(--mc-border)"}`,
              color: filters.overdue ? "#c45a5a" : "var(--mc-text-muted)",
              cursor: "pointer",
              fontWeight: filters.overdue ? 600 : 400,
            }}
          >
            Overdue only
          </button>

          {/* Due from */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>Due from</span>
            <input
              type="date"
              value={filters.dueFrom}
              onChange={(e) => onFiltersChange({ ...filters, dueFrom: e.target.value })}
              style={{
                padding: "5px 8px",
                fontSize: 12,
                background: "var(--mc-surface)",
                border: "1px solid var(--mc-border)",
                color: filters.dueFrom ? "var(--mc-text-primary)" : "var(--mc-text-muted)",
                colorScheme: "dark",
              }}
            />
          </div>

          {/* Due to */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>to</span>
            <input
              type="date"
              value={filters.dueTo}
              onChange={(e) => onFiltersChange({ ...filters, dueTo: e.target.value })}
              style={{
                padding: "5px 8px",
                fontSize: 12,
                background: "var(--mc-surface)",
                border: "1px solid var(--mc-border)",
                color: filters.dueTo ? "var(--mc-text-primary)" : "var(--mc-text-muted)",
                colorScheme: "dark",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
