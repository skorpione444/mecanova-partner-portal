"use client";

import { useState, useRef } from "react";
import { Search, Loader2, X } from "lucide-react";
import type { GooglePlaceResult } from "./MapView";
import type { VenueType } from "@mecanova/shared";

interface PlacesSearchBarProps {
  onResults: (results: GooglePlaceResult[]) => void;
  onSearchExecuted: (center: { lat: number; lng: number }, radius: number) => void;
  onClear: () => void;
  mapCenter: { lat: number; lng: number };
  activeVenueType: VenueType | "all";
  radius: number;
  onRadiusChange: (r: number) => void;
}

export default function PlacesSearchBar({
  onResults,
  onSearchExecuted,
  onClear,
  mapCenter,
  activeVenueType,
  radius,
  onRadiusChange,
}: PlacesSearchBarProps) {
  const [loading, setLoading] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleSearch = async () => {
    if (loading) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/crm/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: mapCenter.lat,
          lng: mapCenter.lng,
          radius,
          venueType: activeVenueType === "all" ? null : activeVenueType,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      onResults(data.places ?? []);
      onSearchExecuted(mapCenter, radius);
      setHasResults(true);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Search failed. Check your Google Places API key.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    onResults([]);
    onClear();
    setHasResults(false);
    setError(null);
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        gap: 6,
        pointerEvents: "all",
      }}
    >
      {/* Radius selector */}
      <select
        value={radius}
        onChange={(e) => onRadiusChange(Number(e.target.value))}
        className="mc-input mc-select"
        style={{ width: 110, padding: "8px 28px 8px 10px" }}
      >
        <option value={1000}>1 km</option>
        <option value={3000}>3 km</option>
        <option value={5000}>5 km</option>
        <option value={10000}>10 km</option>
        <option value={25000}>25 km</option>
        <option value={50000}>50 km</option>
        <option value={100000}>100 km</option>
      </select>

      {/* Search button */}
      <button
        onClick={handleSearch}
        disabled={loading}
        className="mc-btn mc-btn-primary"
        style={{ gap: 6, minWidth: 140 }}
      >
        {loading ? (
          <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
        ) : (
          <Search style={{ width: 14, height: 14 }} strokeWidth={1.5} />
        )}
        {loading ? "Searching..." : "Search Nearby"}
      </button>

      {/* Clear results */}
      {hasResults && (
        <button
          onClick={handleClear}
          className="mc-btn mc-btn-ghost"
          style={{ gap: 4 }}
        >
          <X style={{ width: 13, height: 13 }} strokeWidth={2} />
          Clear
        </button>
      )}

      {/* Error toast */}
      {error && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--mc-error-bg)",
            border: "1px solid var(--mc-error)",
            padding: "6px 12px",
            fontSize: "0.75rem",
            color: "var(--mc-error)",
            whiteSpace: "nowrap",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
