# Mecanova Partner Portal — Full Context

## What Mecanova Is

Mecanova is a Mexican spirits importer based in Germany, founded by 2 people. The company is **pre-revenue** — product arrives in 2–3 months. The business model: source tequila, mezcal, and raicilla from Mexican producers, handle export/import/customs, then distribute through regional partners (distributors) who sell to restaurants and bars (clients) in Germany.

This is a **closed B2B operations tool**, not a public webshop. Every user is invited by an admin.

---

## Architecture

**Monorepo** with npm workspaces:

```
mecanova_partner_portal/
├── portal/          → Partner-facing app (distributors + clients) — port 3000
├── admin/           → Internal admin dashboard (Mecanova staff) — port 3001
├── packages/shared/ → Shared types + constants (@mecanova/shared)
```

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, Edge Functions, RLS) · Netlify (deploy)

**Supabase project:** `maqbieodukmvycpxgqcd`

---

## Roles

| Role | Who | Access |
|------|-----|--------|
| `admin` | Mecanova founders/staff | Full access via admin panel. Can override orders, manage all partners, invite users, edit inventory, upload documents, track KPIs. |
| `distributor` | Regional partners | Portal access. Manage inventory, accept/reject client orders, create invoices, order from Mecanova, view analytics. |
| `client` | Restaurants/bars | Portal access. Browse products, place orders to assigned distributor, view invoices, mark invoices paid. |

Every user has a `profiles` row linking their `auth.users` record to a `partner_id` and `role`.

---

## Database Schema

### Tables

**partners** — Organizations (distributors, clients, suppliers, Mecanova itself)
- `id`, `name`, `partner_type` (client/distributor/supplier), `country`, `vat_id`
- `contact_person`, `contact_email`, `contact_phone`
- `billing_address` (jsonb), `shipping_address` (jsonb)
- `is_mecanova` (bool) — marks the internal company record
- `client_tier` (A/B/C, clients only), `capacity_status` (open/limited/paused, distributors only)
- `service_countries` (text[], distributors only)

**profiles** — User accounts linked to partners
- `user_id` (FK auth.users), `partner_id` (FK partners), `role`, `full_name`, `phone`

**products** — Spirit catalogue
- `id`, `name`, `brand`, `category` (tequila/mezcal/raicilla/other), `sku`
- `abv`, `size_ml`, `case_size`, `description`, `active`, `supplier_id` (FK partners)

**product_assets** — Media attached to products
- `product_id`, `type` (bottle_shot/label_pdf/spec_sheet/brand_deck), `title`, `file_path`

**order_requests** — Orders between parties
- `id`, `partner_id`, `client_id`, `distributor_id`, `created_by_user`
- `status`: created → submitted → accepted → delivered → fulfilled (or rejected/cancelled)
- Timestamps: `submitted_at`, `accepted_at`, `rejected_at`, `delivered_at`, `fulfilled_at`, `cancelled_at`
- `estimated_delivery_date`, `estimated_delivery_note`, `delivery_location` (jsonb), `notes`

**order_request_items** — Line items per order
- `order_request_id`, `product_id`, `cases_qty`

**client_distributors** — Which distributors serve which clients
- `client_id`, `distributor_id`, `is_default`, `contract_type` (exclusive/preferred/allowed)
- `assignment_locked`, `assignment_reason`

**inventory_status** — Current stock per distributor per product
- `distributor_id`, `product_id`, `on_hand_qty`, `status` (in_stock/limited/out), `note`
- UNIQUE(distributor_id, product_id)

**inventory_movements** — Immutable audit trail of stock changes
- `distributor_id`, `product_id`, `movement_type`, `qty_delta`, `order_request_id`, `note`

**invoices** — Payment invoices (distributor → client)
- `invoice_number`, `distributor_id`, `client_id`, `amount`, `currency`, `due_date`
- `status` (sent/paid/overdue), `file_path`, `paid_at`, `last_reminder_at`, `created_by_user`

**documents** — Shared files (compliance, marketing, spec sheets, etc.)
- `title`, `type`, `file_path`, `partner_id`, `product_id`
- `audience` (all/distributor/client/internal), `is_shared`, `is_highlight`

**kpi_manual_entries** — Snapshot-based KPI tracking (admin only)
- `kpi_type`, `value_numeric`, `value_json` (jsonb), `product_id`, `recorded_by`
- Types: bank_balance, monthly_burn, target_launch_date, pipeline_distributor, pipeline_client, landed_cost

**audit_log** — Action audit trail
- `user_id`, `action`, `entity_type`, `entity_id`, `details` (jsonb)

**email_outbox** — Async email queue
- `to_email`, `template`, `subject`, `payload` (jsonb), `status` (pending/sent/failed)
- `attempt_count`, `next_retry_at`, `locked_at`, `locked_by`

### RLS (Row-Level Security)

Every table has RLS enabled. Three helper functions power all policies:
- `mecanova_is_admin()` — checks if current user has role = 'admin'
- `mecanova_current_role()` — returns current user's role
- `mecanova_current_partner_id()` — returns current user's partner_id

**General pattern:**
- Admins get full access to everything
- Distributors/clients see only their own data (filtered by partner_id)
- Cross-partner visibility uses `client_distributors` junction table
- Clients can see products from their assigned distributors' inventory
- Order items visible to both parties in the order

### Database Functions

**Order lifecycle:**
- `create_order(p_distributor_id)` — client creates order (validates client_distributors mapping)
- `create_supply_order()` — distributor orders from Mecanova
- `submit_order(p_order_id)` — created → submitted
- `accept_order(p_order_id)` — submitted → accepted (deducts inventory atomically with row locks)
- `reject_order(p_order_id)` — submitted → rejected
- `deliver_order(p_order_id)` — accepted → delivered
- `fulfill_order(p_order_id)` — accepted → fulfilled

**Other:**
- `adjust_inventory(p_product_id, p_qty_delta, p_movement_type, p_note)` — manual stock adjustment with audit trail
- `get_order_client_info(p_order_id)` — SECURITY DEFINER; returns client company info for delivery docs
- `send_invoice_reminder(p_invoice_id)` — SECURITY DEFINER; enqueues reminder email

**Triggers:**
- `trigger_enqueue_order_emails` — on order_requests status change, populates email_outbox
- `trg_invoices_updated_at` / `trg_order_requests_updated_at` — auto-set updated_at
- `rls_auto_enable()` — event trigger on CREATE TABLE; auto-enables RLS

---

## Edge Functions

### email-outbox-worker
Processes the `email_outbox` table. Triggered by cron with CRON_SECRET header.

- Batch: 25 emails per invocation
- Row locking prevents concurrent processing
- Exponential backoff retry: 1 → 5 → 15 → 60 → 360 min, max 10 attempts
- Sends via Resend API (or dry-run mode for dev)
- Templates: order_submitted_to_distributor, order_accepted_to_client, order_rejected_to_client, order_delivered_to_client, invoice_reminder

---

## Portal (Partner-Facing App)

### Auth Flow
- Middleware validates every request via `supabase.auth.getUser()`
- Public routes: `/login`, `/auth/*`
- Everything under `(portal)/` requires authentication
- Root `/` redirects to `/dashboard` or `/login`

### Pages

**Dashboard** (`/dashboard`)
- Role-aware greeting + quick access cards
- Distributor: Open Invoices, Products, Orders, Buy Products
- Client: Open Invoices, Products, Orders, Documents
- Inventory summary (products tracked, total stock, low/out alerts)

**Products** (`/products`)
- Two tabs: Catalogue + Documents
- Catalogue: filterable product list with expandable details (brand, ABV, SKU, description)
- Product access based on role + assigned inventory
- Documents tab: downloadable files filtered by audience/access level

**Orders** (`/orders`) — Distributor only
- Two tabs: Client Orders (received) + Buy from Mecanova (placed)
- Tables with status, partner names, item counts

**New Order** (`/orders/new`) — Client only
- Selects from assigned distributor's inventory
- Dynamic line items with +/- quantity
- Submit creates order via RPCs (create_order → add items → submit_order)

**Order Detail** (`/orders/[id]`)
- Full order view with timeline, items, notes
- Distributor actions: Accept (with delivery estimate modal), Reject, Mark Delivered
- Client information card (company, contacts, addresses)
- Delivery estimate editing

**Supply Orders** (`/supply-orders`) — Distributor only
- Orders from Mecanova (all active products available)
- Create + detail views

**Invoices** (`/invoices`)
- Distributor: create invoices (file upload, amount, currency, due date) + send reminders
- Client: view received invoices + mark as paid
- Search + status filters (sent/paid/overdue)
- Invoice detail: download file, payment actions

**Inventory** (`/inventory`) — Distributor only
- Summary cards: products tracked, total stock, low/out alerts
- Stock Levels tab: table with on-hand qty, status badges, search
- Movement History tab: recent 50 movements with type + qty delta
- Stock Adjustment modal: product selector, adjustment type, quantity (cases/bottles), note

**Analytics** (`/analytics`)
- KPI cards: total orders, acceptance rate, rejection rate, avg order size
- Financial summary: invoiced vs paid vs outstanding with progress bar
- Orders by status: horizontal bar distribution
- Top products by volume
- Activity summary: delivered, pending, payment rate, fulfillment rate

**Documents** (`/documents`)
- Filterable document list with type/access filters
- Download via signed URLs

### Key Components
- **PortalShell**: sidebar nav (filtered by role), mobile drawer, user profile card, logout
- **OnboardingTooltip**: interactive tour with role-specific steps, localStorage-persisted
- **PageHeader**, **StatCard**, **StatusBadge**, **EmptyState**, **Timeline**

---

## Admin Dashboard (Internal App)

### Auth Flow
- Same Supabase auth, but middleware additionally checks admin role
- Non-admin users get signed out and redirected with `?error=unauthorized`

### Pages

**Dashboard** (`/dashboard`)
- Stat cards: total partners, active products, active orders, low stock alerts
- Recent orders table with partner names
- Module quick links grid (all admin sections)

**KPIs** (`/kpis`)
- Collapsible "Update Metrics" panel for manual data entry
- Section A — Survival Metrics: cash runway gauge + sparkline, days to market countdown
- Section B — Pipeline: distributor + client funnel bars with conversion percentages
- Section C — Unit Economics: landed cost breakdown bars per product (purchase, export, shipping, customs, duties, labeling)
- Section D — Post-Launch Placeholders: grayed-out cards for future auto-computed metrics

**Partners** (`/partners`)
- Full CRUD: list, detail, create, edit
- Detail page: partner info, recent orders, users list, invite form
- Relationship management: link/unlink clients↔distributors, set contract types, default flags, assignment locks
- Supplier view: linked products

**Products** (`/products`)
- Full CRUD: list, detail, create, edit
- Detail: product specs + inventory by distributor
- Toggle active/inactive

**Orders** (`/orders`)
- View all orders system-wide with search/filter
- Detail page: order info + items + admin status override (dropdown to force any status)

**Inventory** (`/inventory`)
- Stock levels with inline quantity editing (creates admin_adjustment movement)
- Movement log: recent 20 movements

**Documents** (`/documents`)
- Upload form: title, type, audience, file, partner/product links, shared/highlight flags
- Download (signed URLs), toggle shared/highlight, delete

**Settings** (`/settings`)
- Read-only: account info + system info (env, Supabase URL)

**Placeholder pages** (coming soon): Logistics, Finance, CRM, Contracts

### API Routes

**POST `/api/admin/invite-user`**
- Creates user via Supabase admin API (email_confirm: true)
- Creates profile with partner_id + role
- Returns magic link for password setup

### Key Components
- **AdminShell**: sidebar with 4 nav sections (Overview, Operations, Business, System), user card, mobile drawer
- **KPIInputPanel**: collapsible metric entry form
- **SparklineCSS**, **FunnelBar**, **RunwayGauge**, **CostBreakdownBar**: pure CSS visualizations
- **SearchableSelect**: dropdown with search for partner/product selection
- **StatCard**, **StatusBadge**, **PageHeader**, **EmptyState**

---

## Design System

| Token | Value |
|-------|-------|
| Headings font | Jost (`--font-jost`) |
| Body font | Manrope (`--font-manrope`) |
| Border radius | 0px (sharp corners everywhere) |
| Background | Black/charcoal neutrals |
| Accent | Cream tones (`--mc-cream`, `--mc-cream-muted`, `--mc-cream-subtle`) |
| Success | Green (`--mc-success`) |
| Warning | Amber (`--mc-warning`) |
| Error | Red (`--mc-error`) |
| Info | Blue (`--mc-info`) |

**CSS classes:** `mc-card`, `mc-card-interactive`, `mc-btn-primary`, `mc-btn-ghost`, `mc-input`, `mc-select`, `mc-table`, `mc-label`, `mc-skeleton`, `mc-stagger`, `mc-animate-page`, `mc-animate-fade`

**Animations:** `fadeInUp` (slide + fade), `fadeIn` (opacity), `shimmer` (skeleton loading), staggered children via `mc-stagger`

---

## Shared Package (`@mecanova/shared`)

### Types (`types.ts`)
Generated from Supabase schema. Exports:
- `Database` type with all table Row/Insert/Update types
- Convenience aliases: `Partner`, `Profile`, `Product`, `OrderRequest`, `Invoice`, `KPIManualEntry`, etc.
- Enum types: `UserRole`, `OrderStatus`, `PartnerType`, `ProductCategory`, etc.

### Constants (`constants.ts`)
- `ORDER_STATUS_LABELS` / `ORDER_STATUS_COLORS` — display mapping for order lifecycle
- `INVOICE_STATUS_LABELS` / `INVOICE_STATUS_COLORS` — invoice states
- `PRODUCT_CATEGORIES` — tequila, mezcal, raicilla, other
- `DOCUMENT_TYPES` / `DOCUMENT_TYPE_LABELS` / `DOCUMENT_AUDIENCES`
- `INVENTORY_STATUS_LABELS` / `INVENTORY_ADJUSTMENT_TYPES` / `INVENTORY_ADJUSTMENT_LABELS`
- `CONTRACT_TYPES` — exclusive, preferred, allowed
- `CLIENT_TIERS` — A (priority), B (standard), C (basic)
- `CAPACITY_STATUSES` — open, limited, paused
- `PARTNER_TYPE_LABELS` / `USER_ROLE_LABELS`

---

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

# Build
npm run build                        # Build portal
npm run build --workspace=admin      # Build admin
```

---

## Migrations (chronological)

1. `20260217115049` — Initial schema (all tables, enums, RLS, functions)
2. `20260217152626` — Drop email_outbox cleanup
3. `20260218000000` — Email outbox table + order email triggers
4. `20260218010000` — Email retry logic (attempt_count, exponential backoff)
5. `20260304120000` — Partners RLS for linked org visibility
6. `20260304130000` — Orders RLS refactor + supply orders function
7. `20260312000000` — Invoices, delivery status, inventory adjustments, client info function, invoice reminders
8. `20260315000000` — Client can mark own invoices as paid
9. `20260316000000` — KPI manual entries table

---

## Data Flows

### Client places order
1. Load assigned distributor(s) from `client_distributors`
2. Load products from distributor's `inventory_status`
3. Build order lines (product + quantity)
4. `create_order` RPC → insert items → `submit_order` RPC
5. Trigger enqueues email to distributor

### Distributor processes order
1. View submitted orders
2. Accept → `accept_order` RPC (deducts inventory atomically) → set delivery estimate
3. Or Reject → `reject_order` RPC
4. Mark Delivered → `deliver_order` RPC → prompt to create invoice
5. Each status change triggers email to client

### Inventory management
1. Distributor opens adjustment modal
2. Select product, type (stock_in/damaged/lost/etc.), quantity
3. `adjust_inventory` RPC creates movement record + updates on-hand qty

### Invoice lifecycle
1. Distributor creates invoice: uploads PDF, sets amount/currency/due date
2. Invoice status = "sent"
3. Distributor can send reminder (enqueues email)
4. Client or distributor marks as paid → status = "paid", sets paid_at

### KPI tracking (admin)
1. Open "Update Metrics" panel on KPIs page
2. Enter current values (bank balance, burn rate, pipeline stages, landed costs, target date)
3. "Save Snapshot" inserts new rows (preserving history)
4. Page computes: runway = balance/burn, days to market = target - today
5. Sparklines show last 8 balance snapshots as trend
