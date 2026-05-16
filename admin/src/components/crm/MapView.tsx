"use client";

import { useState, useCallback, useRef } from "react";
import Map, { Marker, NavigationControl, Source, Layer } from "react-map-gl";
import type { MapRef } from "react-map-gl";
import type { Partner, Prospect } from "@mecanova/shared";
import ProspectPin from "./ProspectPin";
import PartnerPin from "./PartnerPin";

export interface GooglePlaceResult {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
  phone?: string | null;
  website?: string | null;
}

export type SelectedEntity =
  | { type: "prospect"; data: Prospect }
  | { type: "partner"; data: Partner }
  | { type: "place"; data: GooglePlaceResult };

interface MapViewProps {
  prospects: Prospect[];
  partners: Partner[];
  placeResults: GooglePlaceResult[];
  selected: SelectedEntity | null;
  onSelect: (entity: SelectedEntity | null) => void;
  onCenterChange: (center: { lat: number; lng: number }) => void;
  searchArea: { lat: number; lng: number; radius: number } | null;
  // Search center picking
  pickCenterMode?: boolean;
  onPickCenter?: (lng: number, lat: number) => void;
  centerMarker?: { lat: number; lng: number } | null;
  // Preview circle shown while adjusting radius before searching
  previewArea?: { lat: number; lng: number; radius: number } | null;
  // Orders highlight — partners in this set get red pins when ordersFilterActive
  ordersFilterActive?: boolean;
  openOrderPartnerIds?: Set<string>;
}

// Generates a GeoJSON polygon approximating a circle on the map
function makeCircleGeoJSON(lat: number, lng: number, radiusMeters: number, points = 64) {
  const earthR = 6371000;
  const latR = (lat * Math.PI) / 180;
  const coords: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i * 2 * Math.PI) / points;
    const dLat = (radiusMeters * Math.cos(angle)) / earthR;
    const dLng = (radiusMeters * Math.sin(angle)) / (earthR * Math.cos(latR));
    coords.push([
      lng + (dLng * 180) / Math.PI,
      lat + (dLat * 180) / Math.PI,
    ]);
  }
  return { type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [coords] } };
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

// Cream pin cursor shown while pick-center mode is active; hotspot at tip (14, 26)
const PIN_CURSOR =
  `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="%23ecdfcc" stroke="%230a0b0d" stroke-width="2" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="%230a0b0d"/></svg>') 14 26, crosshair`;

const INITIAL_VIEW = {
  longitude: 10.45,
  latitude: 51.17,
  zoom: 6,
};

const SHAPE_LEGEND = [
  { shape: "diamond", label: "Distributor" },
  { shape: "circle",  label: "Buyer" },
  { shape: "triangle", label: "Supplier" },
];

const STATUS_LEGEND = [
  { color: "#7D7468", label: "Uncontacted" },
  { color: "#c4a35a", label: "Contacted" },
  { color: "#d4763a", label: "Negotiating" },
  { color: "#6b8f6e", label: "Customer" },
  { color: "#4a4540", label: "Inactive" },
  { color: "#5a8ab0", shape: "hollow", label: "Search result" },
];

export default function MapView({
  prospects,
  partners,
  placeResults,
  selected,
  onSelect,
  onCenterChange,
  searchArea,
  pickCenterMode,
  onPickCenter,
  centerMarker,
  previewArea,
  ordersFilterActive,
  openOrderPartnerIds,
}: MapViewProps) {
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const mapRef = useRef<MapRef>(null);

  const handleMapClick = useCallback(
    (e: { originalEvent: MouseEvent; lngLat?: { lat: number; lng: number } }) => {
      if ((e.originalEvent.target as HTMLElement).tagName === "CANVAS") {
        if (pickCenterMode && onPickCenter && e.lngLat) {
          onPickCenter(e.lngLat.lng, e.lngLat.lat);
        } else {
          onSelect(null);
        }
      }
    },
    [onSelect, onPickCenter, pickCenterMode]
  );

  // Fire center update when the user stops moving the map
  const handleMoveEnd = useCallback(
    (evt: { viewState: typeof INITIAL_VIEW }) => {
      onCenterChange({ lat: evt.viewState.latitude, lng: evt.viewState.longitude });
    },
    [onCenterChange]
  );

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Map
        ref={mapRef}
        {...viewState}
        cursor={pickCenterMode ? PIN_CURSOR : ""}
        onMove={(evt) => setViewState(evt.viewState)}
        onMoveEnd={handleMoveEnd}
        onClick={handleMapClick as never}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" showCompass={false} />

        {/* Preview circle — shown while adjusting radius before search runs */}
        {previewArea && !searchArea && (
          <Source
            id="preview-radius"
            type="geojson"
            data={makeCircleGeoJSON(previewArea.lat, previewArea.lng, previewArea.radius)}
          >
            <Layer
              id="preview-radius-fill"
              type="fill"
              paint={{ "fill-color": "#ecdfcc", "fill-opacity": 0.05 }}
            />
            <Layer
              id="preview-radius-border"
              type="line"
              paint={{ "line-color": "#ecdfcc", "line-opacity": 0.35, "line-width": 1.5, "line-dasharray": [3, 3] }}
            />
          </Source>
        )}

        {/* Search radius circle — shown after a search has executed */}
        {searchArea && (
          <Source
            id="search-radius"
            type="geojson"
            data={makeCircleGeoJSON(searchArea.lat, searchArea.lng, searchArea.radius)}
          >
            <Layer
              id="search-radius-fill"
              type="fill"
              paint={{ "fill-color": "#5a8ab0", "fill-opacity": 0.08 }}
            />
            <Layer
              id="search-radius-border"
              type="line"
              paint={{ "line-color": "#5a8ab0", "line-opacity": 0.5, "line-width": 1.5, "line-dasharray": [4, 3] }}
            />
          </Source>
        )}

        {/* Center marker — pin dropped by address autocomplete or map click */}
        {centerMarker && (
          <Marker latitude={centerMarker.lat} longitude={centerMarker.lng} anchor="center">
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#ecdfcc",
                border: "2px solid rgba(0,0,0,0.55)",
                boxShadow: "0 0 0 3px rgba(236,223,204,0.35), 0 2px 8px rgba(0,0,0,0.6)",
                pointerEvents: "none",
              }}
            />
          </Marker>
        )}

        {/* Partner pins (diamond shape — larger, denoting existing relationship) */}
        {partners
          .filter((p) => p.lat != null && p.lng != null)
          .map((partner) => {
            const isSelected =
              selected?.type === "partner" && selected.data.id === partner.id;
            return (
              <Marker
                key={`partner-${partner.id}`}
                latitude={partner.lat!}
                longitude={partner.lng!}
                anchor="center"
              >
                <PartnerPin
                  partnerType={partner.partner_type}
                  status={partner.crm_status}
                  selected={isSelected}
                  hasOpenOrders={!!ordersFilterActive && !!openOrderPartnerIds?.has(partner.id)}
                  onClick={() => onSelect({ type: "partner", data: partner })}
                />
              </Marker>
            );
          })}

        {/* Prospect pins (circle) */}
        {prospects
          .filter((p) => p.lat != null && p.lng != null)
          .map((prospect) => {
            const isSelected =
              selected?.type === "prospect" && selected.data.id === prospect.id;
            return (
              <Marker
                key={`prospect-${prospect.id}`}
                latitude={prospect.lat!}
                longitude={prospect.lng!}
                anchor="center"
              >
                <ProspectPin
                  prospectType={prospect.prospect_type ?? "client"}
                  status={prospect.crm_status}
                  selected={isSelected}
                  onClick={() => onSelect({ type: "prospect", data: prospect })}
                />
              </Marker>
            );
          })}

        {/* Google Places ephemeral pins — hollow + pulsing to distinguish from saved prospects */}
        {placeResults.map((place) => {
          const isSelected =
            selected?.type === "place" &&
            selected.data.placeId === place.placeId;
          return (
            <Marker
              key={`place-${place.placeId}`}
              latitude={place.lat}
              longitude={place.lng}
              anchor="center"
            >
              <div
                onClick={() => onSelect({ type: "place", data: place })}
                style={{ position: "relative", width: isSelected ? 18 : 14, height: isSelected ? 18 : 14, cursor: "pointer" }}
              >
                {!isSelected && (
                  <div
                    style={{
                      position: "absolute",
                      inset: -4,
                      borderRadius: "50%",
                      border: "1.5px solid rgba(90,138,176,0.5)",
                      animation: "ping 2s cubic-bezier(0,0,0.2,1) infinite",
                    }}
                  />
                )}
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    background: isSelected ? "#5a8ab0" : "rgba(90,138,176,0.25)",
                    border: isSelected ? "2px solid #ecdfcc" : "2px solid #5a8ab0",
                    boxShadow: isSelected
                      ? "0 0 0 3px rgba(90,138,176,0.3), 0 3px 8px rgba(0,0,0,0.5)"
                      : "0 2px 5px rgba(0,0,0,0.4)",
                    transition: "all 0.15s ease",
                  }}
                />
              </div>
            </Marker>
          );
        })}
      </Map>

      {/* Map legend */}
      <div
        style={{
          position: "absolute",
          bottom: 52,
          left: 12,
          background: "rgba(10,11,13,0.88)",
          border: "1px solid #2A2A2A",
          padding: "8px 12px",
          backdropFilter: "blur(4px)",
          minWidth: 148,
        }}
      >
        {/* Shape = Type */}
        <p style={{ fontSize: "0.6rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5C5449", marginBottom: 5 }}>
          Type
        </p>
        {SHAPE_LEGEND.map(({ shape, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <svg width={11} height={11} viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
              {shape === "diamond" && (
                <polygon points="7,1 13,7 7,13 1,7" fill="#A89F91" stroke="rgba(236,223,204,0.4)" strokeWidth={1.5} strokeLinejoin="round" />
              )}
              {shape === "circle" && (
                <circle cx="7" cy="7" r="5.5" fill="#A89F91" stroke="rgba(236,223,204,0.4)" strokeWidth={1.5} />
              )}
              {shape === "triangle" && (
                <polygon points="7,1.5 13,12.5 1,12.5" fill="#A89F91" stroke="rgba(236,223,204,0.4)" strokeWidth={1.5} strokeLinejoin="round" />
              )}
            </svg>
            <span style={{ fontSize: "0.6875rem", color: "#A89F91" }}>{label}</span>
          </div>
        ))}

        {/* Color = Status */}
        <p style={{ fontSize: "0.6rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5C5449", marginTop: 8, marginBottom: 5 }}>
          Status
        </p>
        {STATUS_LEGEND.map(({ color, shape, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            {shape === "hollow" ? (
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(90,138,176,0.25)", border: `1.5px solid ${color}`, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
            )}
            <span style={{ fontSize: "0.6875rem", color: "#A89F91" }}>{label}</span>
          </div>
        ))}
        {ordersFilterActive && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#c4373a", flexShrink: 0 }} />
            <span style={{ fontSize: "0.6875rem", color: "#A89F91" }}>Has open order</span>
          </div>
        )}
      </div>
    </div>
  );
}
