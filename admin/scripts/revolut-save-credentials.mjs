#!/usr/bin/env node
// Upsert an already-obtained refresh/access token pair into the
// revolut_credentials table. Use this if revolut-init.mjs successfully
// exchanged the auth code but the DB upsert failed (e.g. migration not
// yet applied) — re-running the init script would require a fresh code.
//
// Usage:
//   node admin/scripts/revolut-save-credentials.mjs <client_id> <refresh_token> <access_token> <expires_in_seconds>

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "..", ".env.local");
const PRIVATE_KEY_PATH = "C:\\Users\\sebas\\.revolut\\privatecert.pem";

const [, , clientId, refreshToken, accessToken, expiresInRaw] = process.argv;
if (!clientId || !refreshToken || !accessToken || !expiresInRaw) {
  console.error("Usage: node admin/scripts/revolut-save-credentials.mjs <client_id> <refresh_token> <access_token> <expires_in_seconds>");
  process.exit(1);
}
const expiresIn = Number(expiresInRaw);
if (!Number.isFinite(expiresIn)) {
  console.error("expires_in_seconds must be a number");
  process.exit(1);
}

function loadEnv(path) {
  const content = readFileSync(path, "utf8");
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[m[1]] = value;
  }
  return env;
}

const env = loadEnv(ENV_PATH);
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const privateKeyPem = readFileSync(PRIVATE_KEY_PATH, "utf8");

const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
const row = {
  id: 1,
  client_id: clientId,
  private_key_pem: privateKeyPem,
  refresh_token: refreshToken,
  access_token: accessToken,
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
  console.error(`Supabase upsert failed (${res.status}): ${text}`);
  process.exit(1);
}
const result = JSON.parse(text);
console.log(`✓ Saved revolut_credentials row (id=${result[0]?.id}, expires_at=${result[0]?.access_token_expires_at})`);
