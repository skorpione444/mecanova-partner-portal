#!/usr/bin/env node
// One-shot: exchange a Revolut OAuth auth code for a refresh token,
// then upsert the credentials row in Supabase.
//
// Usage:
//   node admin/scripts/revolut-init.mjs <client_id> <auth_code> [--sandbox]
//
// Reads:
//   - private key from C:\Users\sebas\.revolut\privatecert.pem
//   - NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from admin/.env.local

import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "..", ".env.local");
const PRIVATE_KEY_PATH = "C:\\Users\\sebas\\.revolut\\privatecert.pem";

const [, , clientId, code, sandboxFlag] = process.argv;
if (!clientId || !code) {
  console.error("Usage: node admin/scripts/revolut-init.mjs <client_id> <auth_code> [--sandbox]");
  process.exit(1);
}
const isSandbox = sandboxFlag === "--sandbox";
const REVOLUT_BASE = isSandbox
  ? "https://sandbox-b2b.revolut.com/api/1.0"
  : "https://b2b.revolut.com/api/1.0";

// --- Load env (minimal parser, no dotenv dep) ---
function loadEnv(path) {
  const content = readFileSync(path, "utf8");
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let value = m[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[m[1]] = value;
  }
  return env;
}

const env = loadEnv(ENV_PATH);
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in admin/.env.local");
  process.exit(1);
}

const privateKeyPem = readFileSync(PRIVATE_KEY_PATH, "utf8");

// --- Build JWT client assertion ---
const base64url = (input) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

function buildClientAssertion() {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "mecanova.de",
    sub: clientId,
    aud: "https://revolut.com",
    exp: now + 300,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = createSign("RSA-SHA256").update(signingInput).sign(privateKeyPem);
  return `${signingInput}.${base64url(signature)}`;
}

// --- Exchange auth code for refresh token ---
async function exchangeCode() {
  const assertion = buildClientAssertion();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion,
  });
  const res = await fetch(`${REVOLUT_BASE}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Revolut token exchange failed (${res.status}):`);
    console.error(text);
    process.exit(1);
  }
  return JSON.parse(text);
}

// --- Upsert credentials into Supabase via REST ---
async function upsertCredentials({ refresh_token, access_token, expires_in }) {
  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
  const row = {
    id: 1,
    client_id: clientId,
    private_key_pem: privateKeyPem,
    refresh_token,
    access_token,
    access_token_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/revolut_credentials?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(row),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Supabase upsert failed (${res.status}):`);
    console.error(text);
    process.exit(1);
  }
  return JSON.parse(text);
}

// --- Run ---
console.log(`Exchanging auth code with Revolut (${isSandbox ? "sandbox" : "production"})...`);
const tokens = await exchangeCode();
console.log(`✓ Got tokens. Capture these in case the next step fails:`);
console.log(`  refresh_token: ${tokens.refresh_token}`);
console.log(`  access_token:  ${tokens.access_token}`);
console.log(`  expires_in:    ${tokens.expires_in}s`);
console.log("");

console.log("Upserting credentials row in Supabase...");
try {
  const result = await upsertCredentials(tokens);
  console.log(`✓ Saved revolut_credentials row (id=${result[0]?.id}, updated_at=${result[0]?.updated_at})`);
  console.log("\nDone. The Finance page should now be able to call Revolut.");
} catch (err) {
  console.error("\nDB upsert failed (likely the migration is not applied yet).");
  console.error("The refresh_token printed above is still valid — re-run the upsert manually after applying the migration:");
  console.error(`  npm run sb:push`);
  console.error("then INSERT the row via Supabase SQL editor using the values above.");
  console.error("\nUnderlying error:", err.message ?? err);
  process.exit(1);
}
