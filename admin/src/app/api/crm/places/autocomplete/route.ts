import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).single();
  if (!profile || profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  const { input, sessionToken } = await request.json();
  if (!input || input.length < 2) return NextResponse.json({ suggestions: [] });

  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
    },
    body: JSON.stringify({
      input,
      sessionToken,
      regionCode: "de",
      languageCode: "de",
      includedPrimaryTypes: ["establishment", "street_address", "premise"],
    }),
  });

  if (!res.ok) return NextResponse.json({ suggestions: [] });

  const data = await res.json();
  const suggestions = (data.suggestions ?? []).map((s: {
    placePrediction?: {
      placeId?: string;
      structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
      text?: { text: string };
    };
  }) => ({
    placeId: s.placePrediction?.placeId ?? "",
    mainText: s.placePrediction?.structuredFormat?.mainText?.text ?? "",
    secondaryText: s.placePrediction?.structuredFormat?.secondaryText?.text ?? "",
    fullText: s.placePrediction?.text?.text ?? "",
  }));

  return NextResponse.json({ suggestions });
}
