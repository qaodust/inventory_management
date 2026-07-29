# Development Roadmap

Step-by-step build plan for the inventory app, derived from `vision.md` (requirements), `planning-decisions.md` (data/feature decisions), and `design.md` (page/layout decisions). This is a living document — update task and phase statuses as work happens. Exact schema and integrity rules are decided in Phase 0.5; visual styling and detailed validation behavior are decided in their relevant implementation phases.

## How to use this document

- Each task line uses a status marker: `[ ]` not started, `[~]` in progress, `[x]` complete.
- Each phase has an overall **Phase Status** line — update it as its tasks move along (`Not Started` → `In Progress` → `Testing` → `Complete`).
- Every phase ends with a **Phase Testing (with user)** checklist — this must be run through with both owners before moving to the next phase. Don't start the next phase until sign-off, since later phases build on earlier data/pages.
- Update this file directly as tasks complete — it's the source of truth for "where are we," not git history or chat context.

## Status Overview

| Phase | Name | Status |
|---|---|---|
| 0 | Foundation & Deployment Skeleton | Tasks complete, pending user sign-off |
| 0.5 | Data Model & Business Rules | Not Started |
| 1 | Authentication | Not Started |
| 2 | Manufacturers | Not Started |
| 3 | Products | Not Started |
| 4 | Shipments (Batches) | Not Started |
| 5 | Sales | Not Started |
| 6 | Dashboard | Not Started |
| 7 | Reports / Metrics | Not Started |
| 8 | Polish & Hardening | Not Started |
| 9 | Post-Launch Backlog (future) | Not Started |

---

## Phase 0: Foundation & Deployment Skeleton

**Phase Status:** Tasks complete, pending user sign-off
**Goal:** Prove the full pipeline — code to live URL — works before building real features on top of it.

### Tasks
- [x] Scaffold Next.js (TypeScript) app.
- [x] Set up Railway project with Postgres database attached.
- [x] Connect app to Postgres (connection string via env vars).
- [x] Set up chosen ORM/migration tool (e.g., Prisma or Drizzle) with a trivial test table to confirm DB connectivity.
- [x] Deploy skeleton app to Railway; confirm live URL is reachable. Live at https://inventory-production-fd08.up.railway.app
- [x] Add a placeholder home page confirming responsive shell (basic nav per `design.md` IA, even if links are dead).
- [x] Set up basic repo structure/conventions (folders for pages, components, db, etc.) and a README with local dev setup steps.
- [x] Verify Railway database backup capabilities and document a tested restore procedure (disaster recovery only — no separate business-data export feature). See `docs/backup-restore.md`.

### Phase Testing (with user)
- [ ] User visits the live Railway URL from a PC browser.
- [ ] User visits the live Railway URL from an Android and/or iOS phone browser.
- [ ] Confirm the placeholder page loads without errors on both.
- [ ] Confirm basic responsive layout shift is visible between PC and mobile (even if just nav placeholder).

---

## Phase 0.5: Data Model & Business Rules

**Phase Status:** Not Started
**Goal:** Lock down financially correct history, inventory behavior, and database constraints before building feature pages.

### Tasks
- [ ] Write the exact Postgres/ORM schema for users, manufacturers, categories, products, shipments/batches (incl. optional expected-arrival date), inventory adjustments, sale routes, sales, and sale allocations.
- [ ] Define foreign keys, indexes, uniqueness rules, quantity/money/rating checks, timestamps, and audit-user fields.
- [ ] Define fixed-precision money types and a deterministic fractional-cent reconciliation rule.
- [ ] Derive remaining inventory from received quantity, sale allocations, and inventory adjustments.
- [ ] Specify FIFO ordering, including a stable tie-breaker for equal arrival dates.
- [ ] Specify sale creation as one atomic transaction with stock validation and row-level concurrency protection (prevents overselling; insufficient stock rejects the whole sale).
- [ ] Specify direct edit/delete behavior (confirmation-gated) for sales and shipments, and how downstream remaining quantity, cost/unit, and allocations recompute live when one is edited. No formal reversal ledger.
- [ ] Enforce sale date = today only (no backdating) at the schema/application level.
- [ ] Define business-date/report behavior for `America/New_York`, UTC timestamps, and date-only events.
- [ ] Define manufacturer profit attribution through consumed shipment batches.
- [ ] Define the reliability calculation (% delivered on/before expected-arrival date) and the "not enough data yet" threshold.
- [ ] Implement automated tests for single-batch FIFO, multi-batch FIFO, exact sell-out, insufficient stock (rejection), simultaneous sales (oversell protection), fractional costs, and inventory adjustments.

### Phase Testing (with user)
- [ ] Walk through representative shipment and sale examples with both owners and manually reconcile inventory and profit.
- [ ] Confirm correction, damage/loss, return, sample, and stock-count workflows match business operations.
- [ ] Confirm the no-backdating policy and the direct-edit-with-confirmation correction model are understandable and acceptable.
- [ ] Review the schema and automated test results before starting feature implementation.

---

## Phase 1: Authentication

**Phase Status:** Not Started
**Goal:** Both owners can log in securely; no page is usable without auth.

### Tasks
- [ ] Implement Auth.js (NextAuth) credentials provider.
- [ ] Create two pre-set accounts (email/password, hashed) — no public signup, no OAuth.
- [ ] Build login page per `design.md` (centered form, PC and mobile).
- [ ] Add route/middleware protection so all app pages require login.
- [ ] Add logout action.
- [ ] Build an in-app account/settings screen where each logged-in owner can change their own password.
- [ ] Document the one-time account seed/bootstrap script used to create the two initial accounts at setup.

### Phase Testing (with user)
- [ ] Each owner logs in with their own account on PC.
- [ ] Each owner logs in with their own account on mobile.
- [ ] Confirm an incorrect password is rejected with a clear error.
- [ ] Confirm visiting any app page while logged out redirects to login.
- [ ] Confirm logout works and re-protects the app.

---

## Phase 2: Manufacturers

**Phase Status:** Not Started
**Goal:** First real data vertical — proves the CRUD + ratings pattern that Products will reuse.

### Tasks
- [ ] Implement the Phase 0.5 `manufacturers` schema: name, quality rating (1–5) + note, ease-of-use rating (1–5) + note.
- [ ] Build Manufacturers list page (PC table / mobile cards per `design.md`).
- [ ] Build "Add Manufacturer" flow.
- [ ] Build Manufacturer detail page: editable name + ratings/notes.
- [ ] Stub computed-stats section on detail page (avg delivery time, avg shipping fee) — will populate once Shipments (Phase 4) exists; show "no shipments yet" placeholder for now.

### Phase Testing (with user)
- [ ] User adds a real manufacturer with quality + ease-of-use ratings and notes.
- [ ] User edits an existing manufacturer's rating/notes.
- [ ] Confirm list and detail views render correctly on PC and mobile.
- [ ] Confirm ratings persist correctly after a page refresh.

---

## Phase 3: Products

**Phase Status:** Not Started
**Goal:** Product catalog exists; quantity-available and batch details will light up fully once Shipments (Phase 4) lands.

### Tasks
- [ ] Implement the Phase 0.5 `products` and `categories` schema: name, goal price, user-managed category reference, hidden/archived flag.
- [ ] Build category management into product entry/filtering so new categories do not require code or schema changes.
- [ ] Build Products list page (PC table / mobile cards), with category filter and archived-hidden-by-default toggle, per `design.md`.
- [ ] Build "Add Product" flow.
- [ ] Build Product detail page: editable fields + archive action, with a Batches section placeholder (populates in Phase 4).
- [ ] Quantity Available field wired to derive from batches — safe to show `0`/empty until Phase 4 adds real batch data.

### Phase Testing (with user)
- [ ] User adds a few real products across different categories.
- [ ] User archives a product and confirms it disappears from the default list, then reappears via the archived-toggle.
- [ ] User filters the list by category.
- [ ] Confirm list/detail views render correctly on PC and mobile.

---

## Phase 4: Shipments (Batches)

**Phase Status:** Not Started
**Goal:** Orders can be logged and marked arrived; this is what makes Products' quantities and Manufacturers' stats real.

### Tasks
- [ ] Implement the Phase 0.5 `shipments` schema: manufacturer ref, product ref, quantity, fixed-precision product cost, shipping fee, order date, expected arrival date (nullable), arrival date (nullable).
- [ ] Build Shipments page with Pending/Arrived/All tabs, defaulting to Pending, per `design.md`.
- [ ] Build "Log New Shipment" flow, including optional Expected Arrival Date.
- [ ] Build one-tap "Mark Arrived" quick action (date picker defaulting to today).
- [ ] Wire Product detail page's Batches section to real shipment data (arrival date, remaining qty, cost/unit).
- [ ] Wire Products list's Quantity Available to sum remaining quantity across a product's open batches.
- [ ] Wire Manufacturer detail page's computed stats (avg delivery time, avg shipping fee, reliability once enough expected-arrival data exists) to aggregate from real shipment records.
- [ ] Add Pending Deliveries data source (shipments with null arrival date) — will be consumed by the Dashboard in Phase 6.
- [ ] Build inventory adjustments for damage, loss, samples, returns, and count corrections, with negative-stock prevention.
- [ ] Allow direct edit/delete of shipments (confirmation-gated), recalculating downstream batch quantities and cost/unit live.

### Phase Testing (with user)
- [ ] User logs a new shipment (real or test order) for an existing product/manufacturer.
- [ ] User marks a pending shipment as arrived and confirms it moves to the Arrived tab.
- [ ] Confirm the related product's Quantity Available and Batches section update correctly.
- [ ] Confirm the related manufacturer's avg delivery time / shipping fee stats update correctly.
- [ ] Confirm Pending vs Arrived vs All tabs filter correctly on PC and mobile.

---

## Phase 5: Sales

**Phase Status:** Not Started
**Goal:** Individual sales can be logged against FIFO batches with accurate profit calculation — the core value of the app.

### Tasks
- [ ] Implement the Phase 0.5 `sales` and `sale_allocations` schema, including quantity and cost basis per batch allocation.
- [ ] Design/implement `routes` as an extensible list (seeded with common routes; supports adding new ones inline).
- [ ] Implement FIFO batch-consumption logic: deduct from oldest arrived batch with remaining qty; span into next-oldest batch(es) if a sale exceeds one batch's remaining quantity, splitting cost basis accordingly.
- [ ] Run validation, allocation, stock consumption, and persistence in one transaction with row-level concurrency protection.
- [ ] Enforce sale date = today only (no backdating) and apply the stable FIFO tie-breaker.
- [ ] Allow direct edit/delete of sales (confirmation-gated), recomputing FIFO allocations live.
- [ ] Build Log Sale form (product, quantity, price/unit, route incl. "add new route") opening directly from the Sales nav item, per `design.md`. Sale date is auto-set to today, not entered.
- [ ] Implement live profit preview (price × qty − FIFO cost basis) shown before submit.
- [ ] Build Sales History tab/list with filters (date range, product, route).
- [ ] Implement sell-through time capture: when a batch's last unit sells, record/derive the sell-through duration (arrival date → that sale's date) for use in Phase 7 reporting and the Product detail Batches section.

### Phase Testing (with user)
- [ ] User logs a normal sale against a single batch and confirms the profit preview matches manual expectations.
- [ ] User logs a sale that intentionally exceeds the oldest batch's remaining quantity, confirming it correctly spans into the next batch and splits cost basis.
- [ ] User adds a new sale route inline and confirms it's available for future sales.
- [ ] User sells out a batch entirely and confirms sell-through time appears correctly on the Product detail page.
- [ ] User reviews Sales History and filters by date range, product, and route.
- [ ] Two owners attempt simultaneous sales against the last stock and confirm overselling is prevented.
- [ ] Verify fractional-cost reconciliation, and that editing/deleting a sale correctly recomputes inventory and allocations.

---

## Phase 6: Dashboard

**Phase Status:** Not Started
**Goal:** Assemble the home page — by this point all underlying data (manufacturers, products, shipments, sales) is real, so this phase is mostly composition.

### Tasks
- [ ] Build Dashboard page layout per `design.md`: quick-action buttons (Log a Sale, Log a Shipment) at top.
- [ ] Build stat cards: Total Profit, Total Revenue, Units Sold, Active Batches — default all-time, with date-range filter.
- [ ] Build Pending Deliveries section (reuses Phase 4 data).
- [ ] Build Recent Sales section (reuses Phase 5 data).
- [ ] Confirm bottom-nav (mobile) wiring: Dashboard, Sales, Shipments, More (Products/Manufacturers/Reports).

### Phase Testing (with user)
- [ ] User opens the dashboard on PC and mobile and confirms stat totals match their own manual expectations from real data entered so far.
- [ ] User taps both quick-action buttons and confirms they land on the right forms.
- [ ] User changes the date-range filter and confirms stat cards update accordingly.
- [ ] User confirms Pending Deliveries and Recent Sales lists show accurate, current data.

---

## Phase 7: Reports / Metrics

**Phase Status:** Not Started
**Goal:** Deeper reporting views for business decision-making — the payoff of the batch/FIFO data model.

### Tasks
- [ ] Build Reports page shell with tabs: Overview, By Product, By Manufacturer, By Route, and a global date-range filter, per `design.md`.
- [ ] Build Overview tab (date-range-scoped totals + avg sell-through time).
- [ ] Build By Product tab (per-product profit, units sold, avg sell-through time, sortable).
- [ ] Build By Manufacturer tab (profit attributed through consumed manufacturer batches, avg delivery time, avg shipping fee, ratings, and reliability once a manufacturer has enough shipments with an expected-arrival date on file).
- [ ] Build By Route tab (unit count, avg profit/unit, total profit per route).

### Phase Testing (with user)
- [ ] User cross-checks Overview totals against a manually tallied expectation for a known date range.
- [ ] User reviews By Product and confirms numbers match specific known products.
- [ ] User reviews By Manufacturer and confirms it lines up with manufacturer ratings/expectations.
- [ ] User reviews By Route and confirms per-route breakdown looks correct.
- [ ] User changes the global date-range filter and confirms all tabs respect it.

---

## Phase 8: Polish & Hardening

**Phase Status:** Not Started
**Goal:** Full end-to-end quality pass before calling this "done" for daily use.

### Tasks
- [ ] Responsive QA pass across every page at the ~768px breakpoint (per `design.md`'s general rules) — no cut-off content, touch targets ≥ ~44px on mobile.
- [ ] Add loading states and empty states (e.g., "no products yet," "no pending deliveries") across all list/dashboard views.
- [ ] Add form validation and clear error messaging on all forms (Manufacturers, Products, Shipments, Sales, Auth).
- [ ] Add confirmation prompts for destructive/impactful actions (archiving a product, editing historical sale/shipment data if allowed).
- [ ] Basic security review: auth guards on all routes/API endpoints, input sanitization, no secrets in client code.
- [ ] Basic performance check on Railway (page load times acceptable on mobile network conditions).
- [ ] Run and document a backup restore drill (disaster recovery only).

### Phase Testing (with user)
- [ ] Both owners run a full real-world workflow end-to-end: add manufacturer → add product → log shipment → mark arrived → log sale(s) → review dashboard → review reports — on both PC and mobile.
- [ ] Both owners intentionally try "bad" inputs (empty fields, negative numbers, etc.) and confirm errors are clear, not crashes.
- [ ] Sign-off: app is ready for real daily use.

---

## Phase 9: Post-Launch Backlog (future, not scheduled)

Items explicitly deferred per `vision.md` / `planning-decisions.md` / `design.md` — revisit only if the business need arises:

- [ ] PWA install layer (home-screen icon) — deferred unless specifically wanted.
- [ ] Barcode scanning — off the table unless the business grows significantly.
- [ ] Self-service "forgot password" flow — currently manual/admin-reset only.
- [ ] Visual design system refinement (colors, typography, component library) beyond functional styling.
- [ ] Structured product variant/family system, if product catalog complexity grows.
