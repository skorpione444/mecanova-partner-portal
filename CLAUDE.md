# Mecanova Partner Portal

## Project Overview
B2B portal for Mecanova, a Mexican spirits importer in Germany. Closed, role-based operations tool for distributors and buyers — not a public webshop.

## Architecture
- **Monorepo**: `portal/` (partner-facing), `admin/` (internal), `packages/shared/` (types/constants)
- **Stack**: Next.js 16 + React 19 + TypeScript + Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, RLS)
- **Deploy**: Netlify (portal + admin as separate sites)

## Key Commands
```bash
# Development
npm run dev                          # Portal on :3000
npm run dev --workspace=admin        # Admin on :3001

# Supabase
npm run sb:start                     # Local Supabase
npm run sb:stop
npm run sb:reset                     # Reset local DB
npm run sb:pull                      # Pull remote schema
npm run sb:push                      # Push migrations to remote
npm run sb:link                      # Link to remote project

# Build
npm run build                        # Build portal
npm run build --workspace=admin      # Build admin
```

## Database
- Supabase project: `maqbieodukmvycpxgqcd`
- Migrations in `portal/supabase/migrations/`
- RLS enforced on all tables — helper functions: `mecanova_is_admin()`, `mecanova_current_role()`, `mecanova_current_partner_id()`
- Edge function: `email-outbox-worker` for async email

## Roles
- `admin` — Mecanova staff (full access via admin panel)
- `distributor` — Regional partners (inventory, orders from clients)
- `client` — Buyers (order submission, product browsing)

## Design System
- Colors: Black/charcoal neutrals, cream accents
- Fonts: Jost (headings), Manrope (body)
- Sharp corners (no border-radius)
- See `portal/src/app/globals.css` for full token definitions

## Conventions
- Shared types live in `packages/shared/src/types.ts`
- Supabase clients: `lib/supabase/client.ts` (browser), `server.ts` (SSR), `admin.ts` (service role)
- All pages under `(portal)/` and `(admin)/` route groups are auth-protected
- Order status lifecycle: submitted → accepted → delivered → fulfilled (or rejected/cancelled)

## Bank integration (Revolut Business)
- Auth helper: `admin/src/lib/revolut.ts` — JWT client assertion → refresh-token flow → Bearer fetch.
- Routes: `admin/src/app/api/revolut/{balance,sync}/route.ts`.
- Credentials live in DB table `revolut_credentials` (singleton, id=1) — refresh tokens rotate on each use, so they cannot be in env vars. The auth helper persists the rotated token after every refresh; if persistence fails the integration breaks until manual re-consent.
- Env vars (admin/.env.local): `REVOLUT_ACCOUNT_ID` (EUR account UUID, optional — falls back to all active EUR accounts), `REVOLUT_API_BASE` (optional, defaults to production `https://b2b.revolut.com/api/1.0`; set to `https://sandbox-b2b.revolut.com/api/1.0` for sandbox).
- The self-signed cert uploaded to Revolut Business has a 5-year lifetime (default) — re-upload before expiry.
