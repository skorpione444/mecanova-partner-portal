"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import type { Partner, Prospect, PartnerType } from "@mecanova/shared";
import type { SelectedEntity, GooglePlaceResult } from "@/components/crm/MapView";
import CRMFilters, { type CRMFilterState } from "@/components/crm/CRMFilters";
import CRMSidebar from "@/components/crm/CRMSidebar";
import PlacesSearchBar from "@/components/crm/PlacesSearchBar";
import ConvertProspectModal from "@/components/crm/ConvertProspectModal";

// Dynamic import prevents mapbox-gl SSR issues
const MapView = dynamic(() => import("@/components/crm/MapView"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#111111",
        color: "#7D7468",
        fontSize: "0.875rem",
        letterSpacing: "0.05em",
      }}
    >
      Loading map…
    </div>
  ),
});

const DEFAULT_FILTERS: CRMFilterState = {
  partnerType: "all",
  crmStatus: "all",
  source: "all",
};

export default function CRMPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [placeResults, setPlaceResults] = useState<GooglePlaceResult[]>([]);
  const [selected, setSelected] = useState<SelectedEntity | null>(null);
  const [filters, setFilters] = useState<CRMFilterState>(DEFAULT_FILTERS);
  const [convertTarget, setConvertTarget] = useState<Prospect | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [mapCenter, setMapCenter] = useState({ lat: 51.17, lng: 10.45 });
  const [searchArea, setSearchArea] = useState<{ lat: number; lng: number; radius: number } | null>(null);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number; label?: string } | null>(null);
  const [searchPreviewRadiusM, setSearchPreviewRadiusM] = useState(5000);
  const [ordersFilterActive, setOrdersFilterActive] = useState(false);
  const [openOrderPartnerIds, setOpenOrderPartnerIds] = useState<Set<string>>(new Set());

  const supabase = createClient();

  // Load current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, [supabase]);

  // Load prospects
  const loadProspects = useCallback(async () => {
    const { data } = await supabase
      .from("prospects")
      .select("*")
      .order("created_at", { ascending: false });
    setProspects(data ?? []);
  }, [supabase]);

  // Load partners (with CRM fields)
  const loadPartners = useCallback(async () => {
    const { data } = await supabase
      .from("partners")
      .select("*")
      .not("lat", "is", null);
    setPartners(data ?? []);
  }, [supabase]);

  // Load partner IDs that have at least one open order
  // (status in submitted/accepted/delivered — not fulfilled/rejected/cancelled)
  const loadOpenOrderPartnerIds = useCallback(async () => {
    const { data } = await supabase
      .from("order_requests")
      .select("client_id")
      .in("status", ["submitted", "accepted", "delivered"])
      .not("client_id", "is", null);
    setOpenOrderPartnerIds(
      new Set((data ?? []).map((r) => r.client_id as string))
    );
  }, [supabase]);

  useEffect(() => {
    loadProspects();
    loadPartners();
    loadOpenOrderPartnerIds();
  }, [loadProspects, loadPartners, loadOpenOrderPartnerIds]);

  // Refresh open-order set when the tab regains focus
  // (e.g. after closing an order in Operations and switching back)
  useEffect(() => {
    const onFocus = () => loadOpenOrderPartnerIds();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadOpenOrderPartnerIds]);

  // Refresh when the user activates the toggle, so it always reflects the latest state
  useEffect(() => {
    if (ordersFilterActive) loadOpenOrderPartnerIds();
  }, [ordersFilterActive, loadOpenOrderPartnerIds]);

  // Apply filters to what's shown on the map
  const filteredProspects = prospects.filter((p) => {
    if (filters.source === "partners") return false;
    if (filters.partnerType !== "all" && p.prospect_type !== filters.partnerType) return false;
    if (filters.crmStatus !== "all" && p.crm_status !== filters.crmStatus) return false;
    return true;
  });

  const filteredPartners = partners.filter((p) => {
    if (filters.source === "prospects") return false;
    if (filters.partnerType !== "all" && p.partner_type !== filters.partnerType) return false;
    if (filters.crmStatus !== "all" && p.crm_status !== filters.crmStatus) return false;
    return true;
  });

  // Handle adding a Google Place as a prospect
  const handleAddProspect = useCallback(
    async (place: GooglePlaceResult, prospectType: PartnerType = "client") => {
      const { data, error } = await supabase
        .from("prospects")
        .upsert(
          {
            name: place.name,
            address: place.address,
            lat: place.lat,
            lng: place.lng,
            google_place_id: place.placeId,
            crm_status: "uncontacted",
            contact_phone: place.phone ?? null,
            website: place.website ?? null,
            prospect_type: prospectType,
          },
          { onConflict: "google_place_id" }
        )
        .select()
        .single();

      if (!error && data) {
        await loadProspects();
        // Switch selection to the newly created prospect
        setSelected({ type: "prospect", data: data as Prospect });
      }
    },
    [supabase, loadProspects]
  );

  // Handle prospect status/data update
  const handleProspectUpdated = useCallback(
    (updated: Prospect) => {
      setProspects((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
      if (selected?.type === "prospect" && selected.data.id === updated.id) {
        setSelected({ type: "prospect", data: updated });
      }
    },
    [selected]
  );

  // Handle partner status/data update
  const handlePartnerUpdated = useCallback(
    (updated: Partner) => {
      setPartners((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
      if (selected?.type === "partner" && selected.data.id === updated.id) {
        setSelected({ type: "partner", data: updated });
      }
    },
    [selected]
  );

  // Handle partner deleted (undo conversion)
  const handlePartnerDeleted = useCallback(
    (id: string) => {
      setPartners((prev) => prev.filter((p) => p.id !== id));
      setSelected(null);
      loadProspects(); // Restore prospect that was unlinked
    },
    [loadProspects]
  );

  // Handle conversion success
  const handleConverted = useCallback(
    async (partnerId: string) => {
      setConvertTarget(null);
      setSelected(null);
      await loadProspects();
      await loadPartners();
      await loadOpenOrderPartnerIds();
    },
    [loadProspects, loadPartners, loadOpenOrderPartnerIds]
  );

  // Handle map click in center-pick mode — optimistic update then reverse-geocode
  const handlePickCenter = useCallback(async (lng: number, lat: number) => {
    setSearchCenter({ lat, lng });
    try {
      const res = await fetch(`/api/crm/places/reverse-geocode?lat=${lat}&lng=${lng}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.address) return;
      setSearchCenter((prev) => {
        if (prev && prev.lat === lat && prev.lng === lng) {
          return { lat, lng, label: data.address };
        }
        return prev;
      });
    } catch {
      // Network error — keep coords-only label
    }
  }, []);

  return (
    // Break out of AdminShell's max-w-7xl padding container
    <div
      className="-mx-5 lg:-mx-8 -mt-6 lg:-mt-8 flex flex-col"
      style={{ height: "100vh", overflow: "hidden" }}
    >
      {/* Filter bar */}
      <CRMFilters
        filters={filters}
        onChange={setFilters}
        prospectCount={prospects.length}
        partnerCount={partners.length}
        ordersFilterActive={ordersFilterActive}
        onOrdersFilterChange={setOrdersFilterActive}
        openOrderCount={openOrderPartnerIds.size}
      />

      {/* Map + Sidebar */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        {/* Map area */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {/* Nearby Search pill — top-right of map */}
          <PlacesSearchBar
            center={searchCenter}
            onCenterChange={setSearchCenter}
            radiusM={searchPreviewRadiusM}
            onRadiusChange={setSearchPreviewRadiusM}
            onPanelOpenChange={setSearchPanelOpen}
            onResults={setPlaceResults}
            onSearchExecuted={(center, radius) => setSearchArea({ ...center, radius })}
            onClear={() => { setSearchArea(null); }}
          />

          <MapView
            prospects={filteredProspects}
            partners={filteredPartners}
            placeResults={placeResults}
            selected={selected}
            onSelect={setSelected}
            onCenterChange={setMapCenter}
            searchArea={searchArea}
            pickCenterMode={searchPanelOpen}
            onPickCenter={handlePickCenter}
            centerMarker={searchCenter}
            previewArea={
              searchCenter
                ? { lat: searchCenter.lat, lng: searchCenter.lng, radius: searchPreviewRadiusM }
                : null
            }
            ordersFilterActive={ordersFilterActive}
            openOrderPartnerIds={openOrderPartnerIds}
          />
        </div>

        {/* Sidebar — slides in when something is selected */}
        {selected && (
          <CRMSidebar
            entity={selected}
            userId={userId}
            onClose={() => setSelected(null)}
            onProspectUpdated={handleProspectUpdated}
            onPartnerUpdated={handlePartnerUpdated}
            onPartnerDeleted={handlePartnerDeleted}
            onAddProspect={handleAddProspect}
            onConvertClick={setConvertTarget}
          />
        )}
      </div>

      {/* Convert modal */}
      {convertTarget && (
        <ConvertProspectModal
          prospect={convertTarget}
          onConverted={handleConverted}
          onClose={() => setConvertTarget(null)}
        />
      )}
    </div>
  );
}
