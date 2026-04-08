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

const INITIAL_VIEW = {
  longitude: 10.45,
  latitude: 51.17,
  zoom: 6,
};

const LEGEND = [
  { color: "#7D7468", shape: "circle", label: "Uncontacted" },
  { color: "#c4a35a", shape: "circle", label: "Contacted" },
  { color: "#d4763a", shape: "circle", label: "Negotiating" },
  { color: "#6b8f6e", shape: "diamond", label: "Customer (partner)" },
  { color: "#5a8ab0", shape: "hollow", label: "Search result (unsaved)" },
];

export default function MapView({
  prospects,
  partners,
  placeResults,
  selected,
  onSelect,
  onCenterChange,
  searchArea,
}: MapViewProps) {
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const mapRef = useRef<MapRef>(null);

  const handleMapClick = useCallback(
    (e: { originalEvent: MouseEvent }) => {
      if ((e.originalEvent.target as HTMLElement).tagName === "CANVAS") {
        onSelect(null);
      }
    },
    [onSelect]
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
        onMove={(evt) => setViewState(evt.viewState)}
        onMoveEnd={handleMoveEnd}
        onClick={handleMapClick as never}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" showCompass={false} />

        {/* Search radius circle */}
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
                  status={partner.crm_status}
                  selected={isSelected}
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
        }}
      >
        <p
          style={{
            fontSize: "0.6rem",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#5C5449",
            marginBottom: 6,
          }}
        >
          Legend
        </p>
        {LEGEND.map(({ color, shape, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: shape === "diamond" ? 0 : "50%",
                transform: shape === "diamond" ? "rotate(45deg)" : undefined,
                background: shape === "hollow" ? "rgba(90,138,176,0.25)" : color,
                border: shape === "hollow" ? `2px solid ${color}` : undefined,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: "0.6875rem", color: "#A89F91" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
