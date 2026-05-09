import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revolutFetch } from "@/lib/revolut";

interface RevolutAccount {
  id: string;
  name: string;
  balance: number;
  currency: string;
  state: string;
  public: boolean;
}

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

  try {
    const res = await revolutFetch("/accounts");
    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `Revolut returned ${res.status}: ${body}` },
        { status: res.status }
      );
    }

    const accounts = (await res.json()) as RevolutAccount[];
    const targetId = process.env.REVOLUT_ACCOUNT_ID;

    const eurAccounts = targetId
      ? accounts.filter((a) => a.id === targetId)
      : accounts.filter((a) => a.currency === "EUR" && a.state === "active");

    if (eurAccounts.length === 0) {
      return NextResponse.json(
        { error: "No matching Revolut account — set REVOLUT_ACCOUNT_ID or activate an EUR account" },
        { status: 404 }
      );
    }

    const balance = eurAccounts.reduce((sum, a) => sum + Number(a.balance), 0);
    const account_name =
      eurAccounts.length === 1 ? eurAccounts[0].name : `${eurAccounts.length} accounts`;

    return NextResponse.json({
      balance,
      currency: "EUR",
      account_name,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Revolut balance fetch error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
