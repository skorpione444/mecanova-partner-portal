import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revolutFetch } from "@/lib/revolut";

interface RevolutMerchant {
  name?: string;
  city?: string;
  category_code?: string;
}

interface RevolutLeg {
  leg_id: string;
  amount: number;
  currency: string;
  description?: string;
  account_id?: string;
}

interface RevolutTransaction {
  id: string;
  type: string;
  state: string;
  created_at: string;
  completed_at?: string;
  reference?: string;
  merchant?: RevolutMerchant;
  legs: RevolutLeg[];
}

// MCC sets — primary categorization signal.
// Reference: ISO 18245 / Visa Merchant Category Codes.
const SAAS_MCC = new Set(["5734", "5817", "7372", "4816"]);
const TRAVEL_AIRLINES_MCC_RANGE: [number, number] = [3000, 3299];
const TRAVEL_LODGING_MCC_RANGE: [number, number] = [3501, 3835];
const TRAVEL_OTHER_MCC = new Set(["4111", "4112", "4131", "4511", "4582", "7011", "7512"]);
const LOGISTICS_MCC = new Set(["4214", "4215", "4225"]);
const MARKETING_MCC = new Set(["7311", "5968"]);

function inMccRange(mcc: string, range: [number, number]): boolean {
  const n = Number(mcc);
  return Number.isFinite(n) && n >= range[0] && n <= range[1];
}

function categorize(
  tx: RevolutTransaction,
  leg: RevolutLeg
): { cost_type: string; category: string } {
  if (leg.amount > 0) {
    return { cost_type: "income", category: "sale" };
  }

  const mcc = tx.merchant?.category_code;
  if (mcc) {
    if (SAAS_MCC.has(mcc)) return { cost_type: "infrastructure", category: "subscription" };
    if (
      inMccRange(mcc, TRAVEL_AIRLINES_MCC_RANGE) ||
      inMccRange(mcc, TRAVEL_LODGING_MCC_RANGE) ||
      TRAVEL_OTHER_MCC.has(mcc)
    ) {
      return { cost_type: "operational", category: "travel" };
    }
    if (LOGISTICS_MCC.has(mcc)) return { cost_type: "operational", category: "logistics" };
    if (MARKETING_MCC.has(mcc)) return { cost_type: "operational", category: "marketing" };
  }

  // Fallback: text match on merchant name + leg description.
  const text = `${tx.merchant?.name ?? ""} ${leg.description ?? ""} ${tx.reference ?? ""}`.toUpperCase();

  if (
    /GITHUB|VERCEL|NETLIFY|SUPABASE|DIGITAL\s?OCEAN|AWS|GOOGLE\s?CLOUD|CLOUDFLARE|NAMECHEAP|STRIPE|SENDGRID|TWILIO|OPENAI|ANTHROPIC|POSTMARK|NOTION|FIGMA|LINEAR|SLACK/.test(
      text
    )
  ) {
    return { cost_type: "infrastructure", category: "subscription" };
  }

  if (/REVOLUT(?!\s?BUSINESS\s?DEPOSIT)|SERVICEGEB|KONTOFÜHRUNG|KONTO.?GEB|BANK\s?FEE|BANKGEBÜHR|FX\s?FEE/.test(text)) {
    return { cost_type: "infrastructure", category: "bank_fee" };
  }

  if (/DOMAIN|HOSTING|SERVER|HETZNER|STRATO|1&1|IONOS/.test(text)) {
    return { cost_type: "infrastructure", category: "hosting" };
  }

  if (/DHL|UPS|FEDEX|GLS|HERMES|SPEDITION|FREIGHT|TRANSPORT|KURIER|SPEDITEUR/.test(text)) {
    return { cost_type: "operational", category: "logistics" };
  }

  if (
    /LUFTHANSA|RYANAIR|EASYJET|EUROWINGS|IBERIA|AIR\s?BERLIN|BAHN|DEUTSCHE\s?BAHN|DB\s?FERN|FLIXBUS|HOTEL|BOOKING\.COM|AIRBNB|EXPEDIA|TAXI|UBER|BOLT|PARKGEBÜHR/.test(
      text
    )
  ) {
    return { cost_type: "operational", category: "travel" };
  }

  if (/INSTAGRAM|FACEBOOK|META\s?ADS|LINKEDIN|GOOGLE\s?ADS|MAILCHIMP|TYPEFORM|CANVA|ADOBE/.test(text)) {
    return { cost_type: "operational", category: "marketing" };
  }

  if (/ZOLL|CUSTOMS|EINFUHR|IMPORT|MEXIKO|TEQUILA|MEZCAL|SPIRITS|PRODUKT|WARE/.test(text)) {
    return { cost_type: "operational", category: "production" };
  }

  return { cost_type: "uncategorized", category: "" };
}

export async function POST() {
  const supabase = await createClient();
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

  const accountId = process.env.REVOLUT_ACCOUNT_ID;

  // Determine `from`: 7 days before max(transaction_date) for safety overlap,
  // or 90 days back if the table is empty.
  const { data: latestRow } = await db
    .from("bank_transactions")
    .select("transaction_date")
    .order("transaction_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fromDate = (() => {
    if (latestRow?.transaction_date) {
      const d = new Date(latestRow.transaction_date);
      d.setDate(d.getDate() - 7);
      return d;
    }
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d;
  })();
  const fromIso = fromDate.toISOString();

  try {
    // Paginated fetch: Revolut returns up to `count` results per page,
    // sorted by created_at DESC. We page by passing the oldest created_at
    // from the prior page as `to`.
    const allTxs: RevolutTransaction[] = [];
    let to: string | undefined;
    const pageSize = 1000;

    for (let page = 0; page < 20; page++) {
      const params = new URLSearchParams({
        from: fromIso,
        count: String(pageSize),
      });
      if (accountId) params.set("account", accountId);
      if (to) params.set("to", to);

      const res = await revolutFetch(`/transactions?${params.toString()}`);
      if (!res.ok) {
        const body = await res.text();
        await db.from("revolut_sync_log").insert({
          transactions_fetched: 0,
          transactions_new: 0,
          status: "error",
          error_message: `Revolut returned ${res.status}: ${body}`,
        });
        return NextResponse.json(
          { error: `Revolut returned ${res.status}` },
          { status: res.status }
        );
      }

      const page_txs = (await res.json()) as RevolutTransaction[];
      if (page_txs.length === 0) break;
      allTxs.push(...page_txs);
      if (page_txs.length < pageSize) break;
      to = page_txs[page_txs.length - 1].created_at;
    }

    if (allTxs.length === 0) {
      await db.from("revolut_sync_log").insert({
        transactions_fetched: 0,
        transactions_new: 0,
        status: "success",
      });
      return NextResponse.json({ fetched: 0, new: 0 });
    }

    // Flatten transactions into per-leg rows.
    const rows = allTxs
      .filter((tx) => tx.state === "completed" && Array.isArray(tx.legs))
      .flatMap((tx) =>
        tx.legs.map((leg) => {
          const direction: "in" | "out" = leg.amount >= 0 ? "in" : "out";
          const amount = Math.abs(leg.amount);
          const description = leg.description ?? tx.reference ?? "";
          const completedAt = tx.completed_at ?? tx.created_at;
          const transaction_date = completedAt.split("T")[0];
          const { cost_type, category } = categorize(tx, leg);

          return {
            revolut_transaction_id: `${tx.id}:${leg.leg_id}`,
            amount,
            direction,
            description,
            transaction_date,
            cost_type,
            category: category || null,
            merchant_name: tx.merchant?.name ?? null,
            mcc_code: tx.merchant?.category_code ?? null,
            currency: leg.currency,
            synced_at: new Date().toISOString(),
          };
        })
      );

    const { count, error: upsertError } = await db
      .from("bank_transactions")
      .upsert(rows, {
        onConflict: "revolut_transaction_id",
        ignoreDuplicates: true,
      })
      .select("id", { count: "exact" });

    if (upsertError) {
      await db.from("revolut_sync_log").insert({
        transactions_fetched: allTxs.length,
        transactions_new: 0,
        status: "error",
        error_message: upsertError.message,
      });
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    await db.from("revolut_sync_log").insert({
      transactions_fetched: allTxs.length,
      transactions_new: count ?? 0,
      status: "success",
    });

    return NextResponse.json({ fetched: allTxs.length, new: count ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db.from("revolut_sync_log").insert({
      transactions_fetched: 0,
      transactions_new: 0,
      status: "error",
      error_message: message,
    });
    console.error("Revolut sync error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
