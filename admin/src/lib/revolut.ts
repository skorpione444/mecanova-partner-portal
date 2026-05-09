import { createSign } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const REVOLUT_API_BASE =
  process.env.REVOLUT_API_BASE ?? "https://b2b.revolut.com/api/1.0";

interface RevolutCredentials {
  client_id: string;
  private_key_pem: string;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function buildClientAssertion(clientId: string, privateKeyPem: string): string {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "mecanova.de",
    sub: clientId,
    aud: "https://revolut.com",
    exp: now + 300,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(payload)
  )}`;
  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .sign(privateKeyPem);
  return `${signingInput}.${base64url(signature)}`;
}

async function refreshAccessToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  creds: RevolutCredentials
): Promise<string> {
  const assertion = buildClientAssertion(creds.client_id, creds.private_key_pem);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: creds.refresh_token,
    client_assertion_type:
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion,
  });

  const res = await fetch(`${REVOLUT_API_BASE}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Revolut token refresh failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as TokenResponse;
  const expiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString();

  // Persist rotated refresh token (defensive: write even if unchanged).
  // If this write fails the integration breaks — let it throw.
  const { error } = await db
    .from("revolut_credentials")
    .update({
      access_token: json.access_token,
      access_token_expires_at: expiresAt,
      refresh_token: json.refresh_token ?? creds.refresh_token,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) {
    throw new Error(
      `Failed to persist Revolut tokens — manual re-auth may be required: ${error.message}`
    );
  }

  return json.access_token;
}

export async function getRevolutAccessToken(): Promise<string> {
  const db = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const creds: any = await db
    .from("revolut_credentials")
    .select(
      "client_id, private_key_pem, refresh_token, access_token, access_token_expires_at"
    )
    .eq("id", 1)
    .maybeSingle();

  if (creds.error) {
    throw new Error(`Failed to read revolut_credentials: ${creds.error.message}`);
  }
  if (!creds.data) {
    throw new Error(
      "No Revolut credentials configured — insert a row into revolut_credentials (id=1)"
    );
  }

  const row = creds.data as RevolutCredentials;

  // Use cached access token if it has >60s of life left.
  if (row.access_token && row.access_token_expires_at) {
    const expiresAt = new Date(row.access_token_expires_at).getTime();
    if (expiresAt - Date.now() > 60_000) {
      return row.access_token;
    }
  }

  return refreshAccessToken(db, row);
}

export async function revolutFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = await getRevolutAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  return fetch(`${REVOLUT_API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
