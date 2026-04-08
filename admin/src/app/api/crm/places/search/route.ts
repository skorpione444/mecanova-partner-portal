import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Maps our venue_type_enum to Google Places includedTypes
const VENUE_TYPE_MAP: Record<string, string[]> = {
  bar: ["bar"],
  restaurant: ["restaurant"],
  hotel: ["hotel", "lodging"],
  wholesaler: ["wholesale_store", "liquor_store"],
  private_customer: ["establishment"],
  other: ["establishment"],
};

export async function POST(request: Request) {
  // Auth guard — admin only
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Places API key not configured" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const { lat, lng, radius = 5000, venueType } = body;

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const includedTypes = venueType
    ? (VENUE_TYPE_MAP[venueType] ?? ["establishment"])
    : ["bar", "restaurant", "hotel"];

  // For large radii, tile the search area into overlapping circles to get more results.
  // Google Places caps at 20 results per request, so tiling lets us cover the full area.
  const TILE_RADIUS = 20000; // 20 km per tile
  const searchCenters: { latitude: number; longitude: number }[] = [];

  if (radius <= 25000) {
    // Small radius — single search
    searchCenters.push({ latitude: lat, longitude: lng });
  } else {
    // Large radius — grid of tiles
    const step = 0.27; // ~30 km lat offset
    const lngScale = Math.cos((lat * Math.PI) / 180);
    const lngStep = step / lngScale;
    const gridSize = radius >= 75000 ? 2 : 1; // 5x5 for 100km, 3x3 for 50km

    for (let dy = -gridSize; dy <= gridSize; dy++) {
      for (let dx = -gridSize; dx <= gridSize; dx++) {
        searchCenters.push({
          latitude: lat + dy * step,
          longitude: lng + dx * lngStep,
        });
      }
    }
  }

  const tileRadius = radius <= 25000 ? radius : TILE_RADIUS;

  async function searchOne(center: { latitude: number; longitude: number }) {
    const reqBody = {
      includedTypes,
      maxResultCount: 20,
      locationRestriction: {
        circle: { center, radius: tileRadius },
      },
      languageCode: "de",
    };
    const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey!,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.nationalPhoneNumber,places.websiteUri",
      },
      body: JSON.stringify(reqBody),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.places ?? [];
  }

  const results = await Promise.all(searchCenters.map(searchOne));
  const rawPlaces = results.flat();

  // Deduplicate by place ID
  const seen = new Set<string>();
  const places = rawPlaces
    .filter((p: { id: string }) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    })
    .map((p: {
      id: string;
      displayName?: { text: string };
      formattedAddress?: string;
      location?: { latitude: number; longitude: number };
      types?: string[];
      nationalPhoneNumber?: string;
      websiteUri?: string;
    }) => ({
      placeId: p.id,
      name: p.displayName?.text ?? "Unknown",
      address: p.formattedAddress ?? "",
      lat: p.location?.latitude ?? 0,
      lng: p.location?.longitude ?? 0,
      types: p.types ?? [],
      phone: p.nationalPhoneNumber ?? null,
      website: p.websiteUri ?? null,
    }));

  return NextResponse.json({ places });
}
