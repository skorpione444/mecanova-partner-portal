"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, ChevronDown } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search...",
  emptyLabel = "None",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = value
    ? options.find((o) => o.value === value)?.label || ""
    : "";

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="mc-input flex items-center justify-between gap-2 text-left cursor-pointer"
        style={{ paddingRight: "8px" }}
      >
        <span
          className="flex-1 truncate text-[0.8125rem]"
          style={{ color: value ? "var(--mc-text-primary)" : "var(--mc-text-muted)" }}
        >
          {selectedLabel || emptyLabel}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {value && (
            <span
              className="p-0.5 transition-colors"
              style={{ color: "var(--mc-text-muted)" }}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setOpen(false);
                setQuery("");
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-error)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-text-muted)")}
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className="w-3.5 h-3.5"
            style={{ color: "var(--mc-text-muted)" }}
          />
        </div>
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full max-h-[240px] overflow-hidden flex flex-col mc-animate-fade"
          style={{
            background: "var(--mc-surface)",
            border: "1px solid var(--mc-border-warm)",
            boxShadow: "var(--mc-shadow-lg)",
          }}
        >
          <div
            className="p-2 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--mc-border)" }}
          >
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3"
                style={{ color: "var(--mc-text-muted)" }}
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="mc-input pl-7 text-xs"
                placeholder={placeholder}
                style={{ background: "var(--mc-dark-warm)" }}
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
                setQuery("");
              }}
              className="w-full text-left px-3 py-2 text-xs transition-colors"
              style={{
                color: !value ? "var(--mc-cream)" : "var(--mc-text-muted)",
                background: !value ? "var(--mc-surface-elevated)" : "transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--mc-surface-elevated)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = !value
                  ? "var(--mc-surface-elevated)"
                  : "transparent";
              }}
            >
              {emptyLabel}
            </button>
            {filtered.length === 0 ? (
              <div
                className="px-3 py-3 text-xs text-center"
                style={{ color: "var(--mc-text-muted)" }}
              >
                No results for &ldquo;{query}&rdquo;
              </div>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="w-full text-left px-3 py-2 text-xs transition-colors"
                  style={{
                    color:
                      option.value === value
                        ? "var(--mc-cream)"
                        : "var(--mc-text-secondary)",
                    background:
                      option.value === value
                        ? "var(--mc-surface-elevated)"
                        : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--mc-surface-elevated)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      option.value === value
                        ? "var(--mc-surface-elevated)"
                        : "transparent";
                  }}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
