# MECANOVA PARTNER PORTAL — Platform Context Document

---

## What Is Mecanova?

Mecanova is a **Mexican spirits importer based in Germany**. They import premium agave spirits (tequila, mezcal, etc.) from Mexico and distribute them across European markets through a network of approved distributors and retail/gastronomy buyers.

---

## What Is the Platform?

A **private B2B portal** where Mecanova's approved partners (distributors and buyers) log in to manage orders, view products, track inventory, and access compliance documents.

**It is not** a public webshop, marketplace, or marketing site. It's a closed, role-based operations tool.

---

## Who Uses It?

### 1. Distributors
Regional partners who receive allocated inventory from Mecanova and fulfill orders to end buyers.

- View products allocated to them
- See their inventory (available, reserved, incoming)
- Receive and manage order requests from buyers
- Track fulfillment
- Access compliance docs and brand assets

### 2. Buyers (Retail / Gastronomy)
Bars, restaurants, shops — the end clients who order through distributors.

- Browse available products (filtered to what they can access)
- Submit structured order requests
- Track order status through a clear lifecycle
- View order history
- Access permitted documents

---

## Authentication & Access

- **Approved partners only** — no public registration. Partners are invited/approved by Mecanova.
- **Role-based auth** — on login, users are routed to their role-specific experience (distributor dashboard vs. buyer dashboard).
- **Data isolation** — distributors see only their own data. Buyers see only what's relevant to them. No cross-visibility.

---

## Core Features

### 1. Product Catalogue
A structured product listing visible to partners based on their role and allocation.

Each product includes:
- Name, type (tequila, mezcal, etc.), bottle size, ABV
- Availability status
- Distributor allocation (who can sell what)
- Optional: marketing materials, tasting notes, product sheets

**Key rule:** Visibility is filtered by role. A distributor only sees products allocated to them. A buyer sees products available through their distributor.

---

### 2. Inventory Transparency
Distributor-specific inventory view.

Shows:
- Available units
- Reserved units
- Incoming shipments
- Historical movement

**Goal:** Eliminate confusion about what's actually in stock.

---

### 3. Order Workflow
The core transaction loop. Orders follow a strict lifecycle:

```
Submitted → Under Review → Accepted / Rejected → Fulfilled → (or Cancelled)
```

- Buyers submit order requests
- Distributors review and accept/reject
- Every status change is timestamped and attributed
- No ambiguous states — the system always tells you where an order stands

---

### 4. Order Timeline / Activity Log
Each order carries a full history:
- Submission date
- Every status change with timestamp
- Comments between parties
- Delivery confirmation
- Attached documents

**Purpose:** Traceability and trust.

---

### 5. Compliance & Document Hub
Critical for alcohol import/distribution. Centralized access to:

- Label approvals
- Certificates of origin
- Analysis certificates
- Regulatory compliance files
- Import documentation

Documents are:
- Linked to specific products and/or markets
- Permission-based (not everyone sees everything)
- Version controlled

---

### 6. Communication Layer
Replaces email chains with structured, contextual messaging:

- Comments tied to specific orders
- Notifications on status changes
- Internal notes (admin-only, for later)

---

### 7. Brand & Asset Library
Downloadable marketing resources for partners:

- Logos, bottle renders, lifestyle imagery
- Sales decks, POS materials
- Categorized and version controlled

---

### 8. Performance Metrics *(later phase)*
Dashboards showing:
- Order volume and trends
- Fulfillment times
- Acceptance rates
- Inventory turnover

---

## Platform Principles

| Principle | Meaning |
|---|---|
| **Closed access** | Invitation-only. No public sign-up. |
| **Role-based visibility** | You only see what's yours. |
| **Status clarity** | Every order, every product — always has a clear state. |
| **Structured workflows** | No freeform chaos. Defined steps, defined outcomes. |
| **Compliance-first** | Documents are organized, versioned, and accessible. |
| **Scalable** | Built to add more distributors, markets, and product lines. |

---

## User Flows (High Level)

### Distributor Login Flow
```
Login → Auth check → Distributor Dashboard
  ├── My Products (allocated catalogue)
  ├── My Inventory (stock levels)
  ├── Orders (incoming from buyers, status management)
  ├── Documents (compliance files, brand assets)
  └── Profile / Settings
```

### Buyer Login Flow
```
Login → Auth check → Buyer Dashboard
  ├── Products (what I can order)
  ├── My Orders (submit new, track existing)
  ├── Documents (if permitted)
  └── Profile / Settings
```

---

## What to Build First (MVP Scope)

1. **Auth system** — login, role detection, proper routing
2. **Product catalogue** — role-filtered product listing
3. **Order workflow** — submit, review, accept/reject, fulfill lifecycle
4. **Order timeline** — status tracking with timestamps
5. **Document access** — basic file viewing per product/partner
6. **Dashboards** — simple role-specific landing pages

### Defer to Later
- Admin panel (Mecanova's internal management layer)
- Performance analytics
- Automated reordering / demand forecasting
- Multi-language support
- ERP / logistics integrations

---

## Technical Considerations (Brief)

- **Auth:** Role-based with redirect logic (distributor vs. buyer experiences)
- **Data model:** Products → Allocations → Distributors → Buyers → Orders
- **Permissions:** Strict row-level isolation. No partner sees another partner's data.
- **Documents:** Structured storage with product/market linking
- **State machine:** Orders must follow defined status transitions — no skipping steps

---

## Success Looks Like

- Orders happen in the portal, not over email
- Partners always know what's available and where their order stands
- Compliance docs are findable in seconds, not buried in inboxes
- Adding a new distributor or market is a configuration task, not a rebuild
- The platform communicates professionalism and reliability

---

*This document defines what to build. Implementation decisions (tech stack, architecture, database schema) are separate.*
