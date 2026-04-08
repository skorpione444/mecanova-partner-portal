import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Auto-categorize a transaction based on its description
function categorize(
  description: string,
  direction: "in" | "out"
): { cost_type: string; category: string } {
  if (direction === "in") {
    return { cost_type: "income", category: "sale" };
  }

  const desc = description.toUpperCase();

  // Technical Infrastructure — subscriptions & tools
  if (
    /GITHUB|VERCEL|NETLIFY|SUPABASE|DIGITAL\s?OCEAN|AWS|GOOGLE\s?CLOUD|CLOUDFLARE|NAMECHEAP|STRIPE|SENDGRID|TWILIO|OPENAI|ANTHROPIC|POSTMARK|NOTION|FIGMA|LINEAR|SLACK/.test(
      desc
    )
  ) {
    return { cost_type: "infrastructure", category: "subscription" };
  }

  // Bank / account fees
  if (/HOLVI|SERVICEGEB|KONTOFÜHRUNG|KONTO.?GEB|BANK\s?FEE|BANKGEBÜHR/.test(desc)) {
    return { cost_type: "infrastructure", category: "bank_fee" };
  }

  // Domains / hosting
  if (/DOMAIN|HOSTING|SERVER|HETZNER|STRATO|1&1|IONOS/.test(desc)) {
    return { cost_type: "infrastructure", category: "hosting" };
  }

  // Logistics
  if (/DHL|UPS|FEDEX|GLS|HERMES|SPEDITION|FREIGHT|TRANSPORT|KURIER|SPEDITEUR/.test(desc)) {
    return { cost_type: "operational", category: "logistics" };
  }

  // Travel
  if (
    /LUFTHANSA|RYANAIR|EASYJET|EUROWINGS|IBERIA|AIR\s?BERLIN|BAHN|DEUTSCHE\s?BAHN|DB\s?FERN|FLIXBUS|HOTEL|BOOKING\.COM|AIRBNB|EXPEDIA|TAXI|UBER|BOLT|PARKGEBÜHR/.test(
      desc
    )
  ) {
    return { cost_type: "operational", category: "travel" };
  }

  // Marketing & advertising
  if (/INSTAGRAM|FACEBOOK|META\s?ADS|LINKEDIN|GOOGLE\s?ADS|MAILCHIMP|TYPEFORM|CANVA|ADOBE/.test(desc)) {
    return { cost_type: "operational", category: "marketing" };
  }

  // Production / import / customs
  if (/ZOLL|CUSTOMS|EINFUHR|IMPORT|MEXIKO|TEQUILA|MEZCAL|SPIRITS|PRODUKT|WARE/.test(desc)) {
    return { cost_type: "operational", category: "production" };
  }

  return { cost_type: "uncategorized", category: "" };
}

export async function POST() {
  const supabase = await createClient();
  // New tables not yet in generated types — remove cast after running `npm run sb:pull`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
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
    await db.from("holvi_sync_log").insert({
      transactions_fetched: 0,
      transactions_new: 0,
      status: "error",
      error_message: "HOLVI_API_TOKEN or HOLVI_ACCOUNT_ID not configured in environment",
    });
    return NextResponse.json(
      { error: "Holvi API not configured — set HOLVI_API_TOKEN and HOLVI_ACCOUNT_ID in .env.local" },
      { status: 503 }
    );
  }

  try {
    // Holvi REST API v1: GET /v1/accounts/{poolUid}/transactions/
    const res = await fetch(
      `https://holvi.com/api/v1/accounts/${accountId}/transactions/?limit=200`,
      {
        headers: {
          Authorization: `Token ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const body = await res.text();
      await db.from("holvi_sync_log").insert({
        transactions_fetched: 0,
        transactions_new: 0,
        status: "error",
        error_message: `Holvi returned ${res.status}: ${body}`,
      });
      return NextResponse.json({ error: `Holvi returned ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    // Holvi API returns { results: [...] } or { transactions: [...] }
    const rawTxs: Record<string, unknown>[] = data.results ?? data.transactions ?? [];

    if (rawTxs.length === 0) {
      await db.from("holvi_sync_log").insert({
        transactions_fetched: 0,
        transactions_new: 0,
        status: "success",
      });
      return NextResponse.json({ fetched: 0, new: 0 });
    }

    // Map Holvi transactions to our schema
    const rows = rawTxs.map((tx) => {
      // Holvi amount: negative = debit (money out), positive = credit (money in)
      const rawAmount = parseFloat(
        String(tx.amount ?? tx.net_amount ?? tx.value ?? "0")
      );
      const direction: "in" | "out" = rawAmount >= 0 ? "in" : "out";
      const amount = Math.abs(rawAmount);

      const description = String(
        tx.description ?? tx.message ?? tx.reference ?? tx.subject ?? ""
      );

      // transaction_date: Holvi uses ISO datetime in `time` or `created_at`
      const rawDate = String(tx.time ?? tx.created_at ?? tx.date ?? "");
      const transaction_date = rawDate ? rawDate.split("T")[0] : new Date().toISOString().split("T")[0];

      const { cost_type, category } = categorize(description, direction);

      return {
        holvi_transaction_id: String(tx.code ?? tx.uuid ?? tx.id ?? ""),
        amount,
        direction,
        description,
        transaction_date,
        cost_type,
        category: category || null,
        synced_at: new Date().toISOString(),
      };
    });

    // Filter rows with a valid holvi_transaction_id to allow dedup
    const validRows = rows.filter((r) => r.holvi_transaction_id);

    // Upsert — ignore duplicates (holvi_transaction_id is UNIQUE)
    const { count, error: upsertError } = await db
      .from("bank_transactions")
      .upsert(validRows, { onConflict: "holvi_transaction_id", ignoreDuplicates: true })
      .select("id", { count: "exact" });

    if (upsertError) {
      await db.from("holvi_sync_log").insert({
        transactions_fetched: rawTxs.length,
        transactions_new: 0,
        status: "error",
        error_message: upsertError.message,
      });
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    await db.from("holvi_sync_log").insert({
      transactions_fetched: rawTxs.length,
      transactions_new: count ?? 0,
      status: "success",
    });

    return NextResponse.json({ fetched: rawTxs.length, new: count ?? 0 });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    await db.from("holvi_sync_log").insert({
      transactions_fetched: 0,
      transactions_new: 0,
      status: "error",
      error_message: errMsg,
    });
    console.error("Holvi sync error:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
