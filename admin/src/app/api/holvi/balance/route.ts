import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = process.env.HOLVI_API_TOKEN;
  const accountId = process.env.HOLVI_ACCOUNT_ID;

  if (!token || !accountId) {
    return NextResponse.json(
      { error: "Holvi API not configured — set HOLVI_API_TOKEN and HOLVI_ACCOUNT_ID in .env.local" },
      { status: 503 }
    );
  }

  try {
    // Holvi REST API v1: GET /v1/accounts/{poolUid}/
    const res = await fetch(`https://holvi.com/api/v1/accounts/${accountId}/`, {
      headers: {
        Authorization: `Token ${token}`,
        Accept: "application/json",
      },
      // Always fetch fresh
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `Holvi returned ${res.status}: ${body}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      balance: parseFloat(data.balance ?? data.available_balance ?? "0"),
      currency: data.currency ?? "EUR",
    });
  } catch (err) {
    console.error("Holvi balance fetch error:", err);
    return NextResponse.json({ error: "Failed to reach Holvi API" }, { status: 500 });
  }
}
