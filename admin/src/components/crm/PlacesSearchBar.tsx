"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Loader2, X, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import type { GooglePlaceResult } from "./MapView";
import AddressAutocomplete from "./AddressAutocomplete";
import { SEARCH_CATEGORIES } from "./searchCategories";

const PANEL_INPUT_STYLE: React.CSSProperties = {
  background: "var(--mc-graphite)",
  borderColor: "var(--mc-border-warm)",
  fontSize: 13,
};

interface PlacesSearchBarProps {
  center: { lat: number; lng: number; label?: string } | null;
  onCenterChange: (center: { lat: number; lng: number; label?: string } | null) => void;
  radiusM: number;
  onRadiusChange: (r: number) => void;
  onPanelOpenChange: (open: boolean) => void;
  onResults: (results: GooglePlaceResult[]) => void;
  onSearchExecuted: (center: { lat: number; lng: number }, radius: number) => void;
  onClear: () => void;
}

export default function PlacesSearchBar({
  center,
  onCenterChange,
  radiusM,
  onRadiusChange,
  onPanelOpenChange,
  onResults,
  onSearchExecuted,
  onClear,
}: PlacesSearchBarProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultCount, setResultCount] = useState<number | null>(null);
  const [addressText, setAddressText] = useState("");
  const [freetextQuery, setFreetextQuery] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel on outside click — but NOT when clicking the map canvas or its controls,
  // since those are valid pick-center actions that should keep the panel open.
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: MouseEvent) => {
      if (!panelRef.current || panelRef.current.contains(e.target as Node)) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "CANVAS") return;
      if (target.closest(".mapboxgl-ctrl")) return;
      setPanelOpen(false);
      onPanelOpenChange(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [panelOpen, onPanelOpenChange]);

  // Sync address text when center is cleared externally
  useEffect(() => {
    if (!center) setAddressText("");
  }, [center]);

  const togglePanel = () => {
    const next = !panelOpen;
    setPanelOpen(next);
    onPanelOpenChange(next);
  };

  const runSearch = async (keywords: string[]) => {
    if (!center || loading) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: center.lat, lng: center.lng, radiusM, keywords }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setResultCount(null);
        return;
      }
      const results: GooglePlaceResult[] = data.places ?? [];
      onResults(results);
      onSearchExecuted(center, radiusM);
      setResultCount(results.length);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Search failed. Check your Google Places API key.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    abortRef.current?.abort();
    onResults([]);
    onClear();
    setResultCount(null);
    setError(null);
  };

  const pillLabel = loading
    ? "Searching…"
    : resultCount !== null
    ? `Nearby Search · ${resultCount}`
    : "Nearby Search";

  return (
    <div
      ref={panelRef}
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        zIndex: 10,
        pointerEvents: "all",
      }}
    >
      {/* Pill toggle */}
      <button
        onClick={togglePanel}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          background: "var(--mc-surface-elevated)",
          border: "1px solid var(--mc-border-warm)",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.05em",
          color: "var(--mc-text-primary)",
          whiteSpace: "nowrap",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          fontFamily: "inherit",
        }}
      >
        {loading ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Search size={13} strokeWidth={1.5} />
        )}
        {pillLabel}
        {panelOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {/* Expanded panel */}
      {panelOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            width: 340,
            background: "var(--mc-surface-elevated)",
            border: "1px solid var(--mc-border-warm)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* CENTER */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.09em",
                color: "var(--mc-text-muted)",
                marginBottom: 6,
                textTransform: "uppercase",
              }}
            >
              Center
            </div>
            {center ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  background: "var(--mc-surface-warm)",
                  border: "1px solid var(--mc-border)",
                }}
              >
                <MapPin size={12} strokeWidth={1.5} color="var(--mc-text-muted)" style={{ flexShrink: 0 }} />
                <span
                  style={{
                    flex: 1,
                    fontSize: 12,
                    color: "var(--mc-text-secondary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {center.label ?? `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`}
                </span>
                <button
                  onClick={() => { onCenterChange(null); setAddressText(""); }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--mc-text-muted)",
                    padding: 0,
                    display: "flex",
                    flexShrink: 0,
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div>
                <AddressAutocomplete
                  value={addressText}
                  onChange={setAddressText}
                  onPlaceSelected={(details) => {
                    onCenterChange({ lat: details.lat, lng: details.lng, label: details.address });
                    setAddressText(details.address);
                  }}
                  placeholder="Type an address or click on the map…"
                  inputClassName="mc-input mc-input-on-dark"
                  inputStyle={PANEL_INPUT_STYLE}
                />
                <p
                  style={{
                    fontSize: 10,
                    color: "var(--mc-text-muted)",
                    margin: "4px 0 0 0",
                  }}
                >
                  Or click anywhere on the map to drop a pin
                </p>
              </div>
            )}
          </div>

          {/* CATEGORIES */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.09em",
                color: "var(--mc-text-muted)",
                marginBottom: 8,
                textTransform: "uppercase",
              }}
            >
              Categories
            </div>
            {!center && (
              <p style={{ fontSize: 11, color: "var(--mc-warning)", margin: "0 0 8px 0", lineHeight: 1.4 }}>
                Pick a location first — select an address suggestion above, or click anywhere on the map.
              </p>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {SEARCH_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  disabled={!center || loading}
                  onClick={() => runSearch(cat.keywords)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "11px 8px",
                    background: "var(--mc-surface-warm)",
                    border: "1px solid var(--mc-border)",
                    cursor: center && !loading ? "pointer" : "not-allowed",
                    opacity: center && !loading ? 1 : 0.42,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    color: "var(--mc-text-secondary)",
                    fontFamily: "inherit",
                    transition: "background 0.12s, border-color 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    if (center && !loading) {
                      e.currentTarget.style.background = "var(--mc-surface)";
                      e.currentTarget.style.borderColor = "var(--mc-border-warm)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--mc-surface-warm)";
                    e.currentTarget.style.borderColor = "var(--mc-border)";
                  }}
                >
                  <cat.Icon size={17} strokeWidth={1.5} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* FREITEXT divider */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div style={{ flex: 1, height: 1, background: "var(--mc-border-light)" }} />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.09em",
                  color: "var(--mc-text-muted)",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                Or — Freitext
              </span>
              <div style={{ flex: 1, height: 1, background: "var(--mc-border-light)" }} />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="text"
                className="mc-input mc-input-on-dark"
                value={freetextQuery}
                onChange={(e) => setFreetextQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && freetextQuery.trim() && center && !loading) {
                    runSearch([freetextQuery.trim()]);
                  }
                }}
                placeholder="e.g. tiki bar, rum shop…"
                style={{ flex: 1, ...PANEL_INPUT_STYLE }}
              />
              <button
                onClick={() => { if (freetextQuery.trim()) runSearch([freetextQuery.trim()]); }}
                disabled={!center || !freetextQuery.trim() || loading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 10px",
                  background: "var(--mc-surface-warm)",
                  border: "1px solid var(--mc-border)",
                  cursor: center && freetextQuery.trim() && !loading ? "pointer" : "not-allowed",
                  opacity: center && freetextQuery.trim() && !loading ? 1 : 0.42,
                  color: "var(--mc-text-muted)",
                  flexShrink: 0,
                }}
              >
                <Search size={13} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* RADIUS */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.09em",
                color: "var(--mc-text-muted)",
                marginBottom: 6,
                textTransform: "uppercase",
              }}
            >
              Radius: {Math.round(radiusM / 1000)} km
            </div>
            <input
              type="range"
              min={1000}
              max={100000}
              step={1000}
              value={radiusM}
              disabled={!center}
              onChange={(e) => onRadiusChange(Number(e.target.value))}
              style={{
                width: "100%",
                cursor: center ? "pointer" : "not-allowed",
                opacity: center ? 1 : 0.42,
                accentColor: "var(--mc-accent, #c4a35a)",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                color: "var(--mc-text-muted)",
                marginTop: 2,
              }}
            >
              <span>1 km</span>
              <span>100 km</span>
            </div>
            {!center && (
              <p style={{ fontSize: 10, color: "var(--mc-text-muted)", margin: "4px 0 0 0" }}>
                Set a center above to enable radius
              </p>
            )}
          </div>

          {/* Status / clear row */}
          {(error || resultCount !== null) && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                paddingTop: 4,
                borderTop: "1px solid var(--mc-border-light)",
              }}
            >
              {error ? (
                <span style={{ fontSize: 11, color: "var(--mc-error)", flex: 1 }}>{error}</span>
              ) : (
                <span style={{ fontSize: 11, color: "var(--mc-text-muted)", flex: 1 }}>
                  {resultCount} venue{resultCount !== 1 ? "s" : ""} found
                </span>
              )}
              <button
                onClick={handleClear}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11,
                  color: "var(--mc-text-muted)",
                  padding: "2px 6px",
                  fontFamily: "inherit",
                }}
              >
                <X size={11} />
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
