"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { MapPin, Loader2 } from "lucide-react";

interface Suggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
}

interface PlaceDetails {
  lat: number;
  lng: number;
  address: string;
  country: string | null;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected: (details: PlaceDetails) => void;
  placeholder?: string;
  required?: boolean;
}

// Random session token per autocomplete session (groups billing)
function newSessionToken() {
  return crypto.randomUUID();
}

export default function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = "Start typing an address…",
  required,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const sessionToken = useRef(newSessionToken());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSuggestions = useCallback(async (input: string) => {
    if (input.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/crm/places/autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, sessionToken: sessionToken.current }),
      });
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
      setOpen((data.suggestions ?? []).length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchSuggestions(v), 280);
  };

  const handleSelect = async (suggestion: Suggestion) => {
    onChange(suggestion.fullText);
    setOpen(false);
    setSuggestions([]);

    // Fetch place details for lat/lng
    try {
      const res = await fetch(`/api/crm/places/details?placeId=${suggestion.placeId}`);
      const data = await res.json();
      if (data.place) {
        onPlaceSelected({
          lat: data.place.lat,
          lng: data.place.lng,
          address: data.place.address,
          country: data.place.country ?? null,
        });
      }
    } catch {
      // No coordinates — that's OK
    }

    // Rotate session token after a selection (new session for next search)
    sessionToken.current = newSessionToken();
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          className="mc-input"
          value={value}
          onChange={handleInput}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          style={{ paddingRight: 32 }}
        />
        <div
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            lineHeight: 0,
            color: "var(--mc-text-muted)",
          }}
        >
          {loading ? (
            <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />
          ) : (
            <MapPin style={{ width: 13, height: 13 }} strokeWidth={1.5} />
          )}
        </div>
      </div>

      {open && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 2px)",
            left: 0,
            right: 0,
            background: "var(--mc-surface)",
            border: "1px solid var(--mc-border-warm)",
            boxShadow: "var(--mc-shadow-lg)",
            zIndex: 50,
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onMouseDown={() => handleSelect(s)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                width: "100%",
                padding: "8px 12px",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--mc-border-light)",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mc-graphite)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <MapPin
                style={{ width: 12, height: 12, color: "var(--mc-text-muted)", marginTop: 2, flexShrink: 0 }}
                strokeWidth={1.5}
              />
              <div>
                <p style={{ fontSize: "0.8125rem", color: "var(--mc-text-primary)", margin: 0 }}>
                  {s.mainText}
                </p>
                {s.secondaryText && (
                  <p style={{ fontSize: "0.6875rem", color: "var(--mc-text-muted)", margin: 0 }}>
                    {s.secondaryText}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
