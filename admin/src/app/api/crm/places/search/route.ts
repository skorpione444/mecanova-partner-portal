import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Tile = { lat: number; lng: number; r: number };

type RawPlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  nationalPhoneNumber?: string;
  websiteUri?: string;
};

// In-process LRU cache — keyed by (keyword, tile center, tile radius), 24h TTL
const CACHE = new Map<string, { places: RawPlace[]; ts: number }>();
const CACHE_MAX = 500;
const CACHE_TTL = 24 * 60 * 60 * 1000;

function ck(kw: string, lat: number, lng: number, r: number) {
  return `${kw}|${lat.toFixed(4)}|${lng.toFixed(4)}|${Math.round(r)}`;
}

function cacheGet(key: string): RawPlace[] | null {
  const e = CACHE.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { CACHE.delete(key); return null; }
  CACHE.delete(key);
  CACHE.set(key, e); // move to end (LRU)
  return e.places;
}

function cacheSet(key: string, places: RawPlace[]) {
  if (CACHE.size >= CACHE_MAX) {
    const first = CACHE.keys().next().value;
    if (first !== undefined) CACHE.delete(first);
  }
  CACHE.set(key, { places, ts: Date.now() });
}

// Generate a grid of overlapping tiles that cover the search radius
function makeTiles(lat: number, lng: number, radiusM: number): Tile[] {
  const MAX_TILE_R = 20000; // 20 km per tile — stays within Google's useful range
  if (radiusM <= MAX_TILE_R) return [{ lat, lng, r: radiusM }];

  const gridHalf = radiusM <= 55000 ? 1 : 2; // 3×3 or 5×5
  const tileR = Math.min(MAX_TILE_R, radiusM / (gridHalf * 1.5));
  const stepDeg = (tileR * 2) / 111320; // 111320 m per degree lat
  const lngScale = Math.cos((lat * Math.PI) / 180);

  const tiles: Tile[] = [];
  for (let dy = -gridHalf; dy <= gridHalf; dy++) {
    for (let dx = -gridHalf; dx <= gridHalf; dx++) {
      tiles.push({ lat: lat + dy * stepDeg, lng: lng + dx * (stepDeg / lngScale), r: tileR });
    }
  }
  return tiles;
}

// Split a tile into 4 equal sub-tiles for adaptive subdivision
function subdivide(tile: Tile): Tile[] {
  const halfR = tile.r / 2;
  const latOff = halfR / 111320;
  const lngOff = halfR / (111320 * Math.cos((tile.lat * Math.PI) / 180));
  return [
    { lat: tile.lat - latOff, lng: tile.lng - lngOff, r: halfR },
    { lat: tile.lat - latOff, lng: tile.lng + lngOff, r: halfR },
    { lat: tile.lat + latOff, lng: tile.lng - lngOff, r: halfR },
    { lat: tile.lat + latOff, lng: tile.lng + lngOff, r: halfR },
  ];
}

function haverDist(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchTile(keyword: string, tile: Tile, apiKey: string): Promise<{ places: RawPlace[]; error?: string }> {
  const key = ck(keyword, tile.lat, tile.lng, tile.r);
  const cached = cacheGet(key);
  if (cached) return { places: cached };

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.nationalPhoneNumber,places.websiteUri",
    },
    body: JSON.stringify({
      textQuery: keyword,
      locationBias: {
        circle: {
          center: { latitude: tile.lat, longitude: tile.lng },
          radius: tile.r,
        },
      },
      maxResultCount: 20,
      languageCode: "de",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[places:search] Google returned", res.status, body);
    return { places: [], error: `Google ${res.status}: ${body.slice(0, 300)}` };
  }
  const data = await res.json();
  const places: RawPlace[] = data.places ?? [];
  cacheSet(key, places);
  return { places };
}

const RESULT_CAP = 20;
const MAX_QUERIES = 64;
const MAX_DEPTH = 2;
const CONCURRENCY = 8;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    return NextResponse.json({ error: "Google Places API key not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { lat, lng, radiusM = 5000, keywords } = body;

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const kwList: string[] =
    Array.isArray(keywords) && keywords.length > 0
      ? keywords
      : ["bar", "restaurant", "hotel"];

  const rootTiles = makeTiles(lat, lng, radiusM);

  type Task = { keyword: string; tile: Tile; depth: number };
  const pending: Task[] = [];
  for (const kw of kwList) {
    for (const tile of rootTiles) {
      pending.push({ keyword: kw, tile, depth: 0 });
    }
  }

  let queriesIssued = 0;
  let tilesSubdivided = 0;
  let truncated = false;
  let firstError: string | undefined;
  const allRaw: RawPlace[] = [];
  const start = Date.now();

  while (pending.length > 0) {
    const available = MAX_QUERIES - queriesIssued;
    if (available <= 0) { truncated = true; break; }

    const toTake = Math.min(CONCURRENCY, pending.length, available);
    const batch = pending.splice(0, toTake);
    queriesIssued += toTake;

    const batchResults = await Promise.all(
      batch.map(async (task) => {
        const result = await fetchTile(task.keyword, task.tile, apiKey);
        return { task, ...result };
      })
    );

    for (const { task, places, error } of batchResults) {
      if (error && !firstError) firstError = error;
      allRaw.push(...places);
      // When Google returns the result cap, there are likely more — subdivide the tile
      if (places.length >= RESULT_CAP && task.depth < MAX_DEPTH) {
        tilesSubdivided++;
        for (const sub of subdivide(task.tile)) {
          pending.push({ keyword: task.keyword, tile: sub, depth: task.depth + 1 });
        }
      }
    }
  }

  if (pending.length > 0) truncated = true;

  // Dedupe by place_id and trim to the user's actual radius (tiles overlap, so some results are outside)
  const seen = new Set<string>();
  const places = allRaw
    .filter((p) => {
      if (!p.id || !p.location) return false;
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return haverDist(lat, lng, p.location.latitude, p.location.longitude) <= radiusM;
    })
    .map((p) => ({
      placeId: p.id,
      name: p.displayName?.text ?? "Unknown",
      address: p.formattedAddress ?? "",
      lat: p.location!.latitude,
      lng: p.location!.longitude,
      types: p.types ?? [],
      phone: p.nationalPhoneNumber ?? null,
      website: p.websiteUri ?? null,
    }));

  return NextResponse.json({
    places,
    meta: { queriesIssued, tilesSubdivided, durationMs: Date.now() - start, truncated },
    ...(firstError ? { error: firstError } : {}),
  });
}
