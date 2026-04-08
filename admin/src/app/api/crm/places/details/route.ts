import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get("placeId");

  if (!placeId) {
    return NextResponse.json({ error: "placeId is required" }, { status: 400 });
  }

  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,location,types,nationalPhoneNumber,websiteUri,addressComponents",
        "Accept-Language": "de",
      },
    }
  );

  if (!res.ok) {
    const error = await res.text();
    console.error("Google Places details error:", error);
    return NextResponse.json(
      { error: "Google Places details request failed" },
      { status: 502 }
    );
  }

  const p = await res.json();

  // Extract country from address components
  const countryComponent = (p.addressComponents ?? []).find(
    (c: { types: string[] }) => c.types.includes("country")
  );
  const country: string | null = countryComponent?.longText ?? null;

  const place = {
    placeId: p.id,
    name: p.displayName?.text ?? "Unknown",
    address: p.formattedAddress ?? "",
    country,
    lat: p.location?.latitude ?? 0,
    lng: p.location?.longitude ?? 0,
    types: p.types ?? [],
    phone: p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
  };

  return NextResponse.json({ place });
}
