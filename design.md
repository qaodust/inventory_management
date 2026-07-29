# Design Decisions

Living reference of page/dashboard layout decisions for the inventory app. Builds on `vision.md` (requirements) and `planning-decisions.md` (data/feature decisions). Treat this file as current source of truth for UI/layout, superseding earlier reasoning in conversation history.

## Status: Core page/dashboard layout complete for all sections — PC and mobile. Inventory-adjustment UX, corrections (direct edit/delete with confirmation, no backdating), reliability, and account admin are all resolved; visual styling and detailed form/validation behavior still remain.

---

## Information Architecture

- **Top-level sections:** Dashboard, Products, Shipments, Manufacturers, Sales, Reports.
  - Shipments is its own top-level item (not nested under Products) — logging a new order and marking arrivals are frequent, standalone actions.
- **PC:** all 6 sections shown in a persistent left sidebar (no need to compress).
- **Mobile:** bottom nav bar limited to **4 items** for thumb reach — full 6-item list would be cramped.
  - Priority order (per owner day-to-day usage): **Dashboard, Sales, Shipments**, + **More** as the 4th slot.
  - "More" is a simple list (not a hamburger drawer, to keep tap targets big) linking to Products, Manufacturers, and Reports.

## Dashboard (Home)

- **Quick actions lead the page** (above stats) — "Log a Sale" and "Log a Shipment" as two large, prominent buttons, since those are the most frequent daily actions.
- **Default stats range: all-time**, with a date-range filter control to narrow down (this month / this year / custom). Filter applies to the stats cards, not to Pending Deliveries (which is always "current," not time-bound).
- **Stat cards:** Total Profit, Total Revenue, Units Sold, Active Batches (count of batches with remaining qty > 0) — scoped to the selected date range.
- **Pending Deliveries:** list of shipments with `arrival_date IS NULL` (ordered, not yet arrived) — product, manufacturer, order date, quantity ordered.
- **Recent Sales:** short list of most recent sale records (product, qty, price, route, date) as a quick log/glance.
- Route-of-sale breakdown and other deeper metrics live on the **Reports** page, not the dashboard (dashboard stays glanceable).

### PC layout
```
┌─────────────────────────────────────────────────────────────┐
│ Sidebar │  Dashboard                      [Date range ▾]    │
│         │  ┌──────────────┐ ┌──────────────┐                │
│ Dashboard│  │ Log a Sale   │ │ Log a Shipment│               │
│ Products│  └──────────────┘ └──────────────┘                │
│ Shipments│  ┌────────┐┌────────┐┌────────┐┌────────┐         │
│ Manufact.│  │ Profit ││Revenue ││ Units  ││ Active │         │
│ Sales    │  │  $X    ││  $X    ││ Sold X ││Batches X│        │
│ Reports  │  └────────┘└────────┘└────────┘└────────┘         │
│         │  ┌─────────────────────┐ ┌─────────────────────┐  │
│         │  │ Pending Deliveries  │ │ Recent Sales        │  │
│         │  │ - ...               │ │ - ...               │  │
│         │  └─────────────────────┘ └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Mobile layout
```
┌───────────────────────┐
│ Dashboard   [Range ▾] │
│ ┌───────────────────┐ │
│ │   Log a Sale      │ │
│ └───────────────────┘ │
│ ┌───────────────────┐ │
│ │  Log a Shipment   │ │
│ └───────────────────┘ │
│ ┌────────┐┌─────────┐ │
│ │ Profit ││ Revenue │ │
│ └────────┘└─────────┘ │
│ ┌────────┐┌─────────┐ │
│ │ Units  ││ Active  │ │
│ │ Sold   ││ Batches │ │
│ └────────┘└─────────┘ │
│ Pending Deliveries     │
│ - ...                  │
│ Recent Sales           │
│ - ...                  │
├───────────────────────┤
│ [Dash][Sale][Ship][More]│ ← bottom nav
└───────────────────────┘
```

## Products

- Categories come from a user-managed controlled list. Product forms allow selecting an existing category and adding a new one without a deployment.

- **List view (summary only):** name, category, goal price, total quantity available (summed across open batches). No inline batch detail — click/tap into the product detail page for batches, per-batch cost, and sell-through time.
- **Archived/hidden products hidden by default**, with a toggle/filter to reveal them — keeps the everyday list clean.
- **Category filter:** dropdown or filter chips above the list, populated from the user-managed category list in `planning-decisions.md`.
- **Detail page** (per product): name, goal price, category, edit/archive actions, plus a **Batches** section listing that product's shipments (arrival date, remaining qty, cost/unit, sell-through time if sold out) — oldest first (matches FIFO mental model).
- **"Add Product"** action available from the list (button, top-right on PC / floating or top on mobile).

### PC layout
- Standard data table: columns = Name, Category, Goal Price, Qty Available, actions (edit/archive). Sortable by column. "Add Product" button top-right, category filter + archived-toggle above the table.
- Detail page: two-column — left: product fields/edit form; right: Batches table (Arrival Date, Qty Remaining, Cost/Unit, Sell-Through Time).

### Mobile layout
- Card list, one product per card (name, category badge, goal price, qty available). Category filter + archived toggle collapse into a filter bar/sheet above the list. "Add Product" as a floating action button.
- Detail page: stacked — product fields/edit form on top, Batches shown as a stacked list of cards below.

## Shipments (Batches)

- Shipments (including ones that already affected inventory or sales) are directly editable/deletable by the owners, guarded by a confirmation dialog — no separate correction/reversal flow. Editing recalculates downstream remaining quantities and cost/unit live.
- Currency fields display conventional currency precision while calculations retain the higher internal precision defined by the data model.

- **Default view: Pending tab** (shipments with `arrival_date IS NULL`) — that's the actionable list. Tabs: **Pending | Arrived | All**.
- **Mark Arrived = one-tap quick action** directly on the pending row/card: a "Mark Arrived" button opens a small date picker (defaulting to today), no need to open a full detail page.
- **Log New Shipment** action available from the page (button top-right on PC / FAB on mobile): fields = Manufacturer, Product, Quantity, Product Cost, Shipping Fee, Order Date, Expected Arrival Date (optional — feeds the manufacturer reliability metric).
- **List columns/fields shown:** Product, Manufacturer, Quantity, Total Cost (product cost + shipping, computed), Order Date, Arrival Date (or "Mark Arrived" button if pending).
- Arrived shipments are otherwise **read-only history** from this list — deeper batch info (remaining qty, sell-through time) lives on the Product detail page's Batches section, to avoid duplicating that view.

### PC layout
- Table with tabs (Pending/Arrived/All) above it. Columns: Product, Manufacturer, Qty, Product Cost, Shipping Fee, Total Cost, Order Date, Arrival Date/Action. "Log New Shipment" button top-right.

### Mobile layout
- Tabs as a segmented control at top (Pending/Arrived/All). Card list below: each card shows Product + Manufacturer, Qty, Total Cost, Order Date, and — if pending — a prominent "Mark Arrived" button. FAB for "Log New Shipment".

## Manufacturers

- **List view:** manufacturer name, quality rating, ease-of-use rating, avg delivery time, avg shipping fee (latter two computed/aggregated from Shipment records per `planning-decisions.md`).
- **Rating notes are a single editable field** per rating (overwritten on update, not an accumulating log) — matches the "current rating" mental model; simpler UI.
- **Detail page:** manufacturer name/edit, Quality rating (1–5, editable) + note, Ease-of-use rating (1–5, editable) + note, computed stats section (avg delivery time, avg shipping fee, total shipments, reliability once enough shipments have an expected-arrival date on file — shows "not enough data yet" otherwise), and a list/link of that manufacturer's shipments.
- **"Add Manufacturer"** action from the list.

### PC layout
- Table: Name, Quality, Ease-of-Use, Avg Delivery Time, Avg Shipping Fee. "Add Manufacturer" button top-right.
- Detail page: two-column — left: name + ratings/notes (editable); right: computed stats cards + filtered shipments list below.

### Mobile layout
- Card list: name, star-style ratings, avg delivery/shipping shown compactly. "Add Manufacturer" as FAB.
- Detail page: stacked — ratings/notes editable section on top, computed stats cards below, filtered shipments list at the bottom.

## Sales

- Completed sales are directly editable/deletable by the owners, guarded by a confirmation dialog — no reversal/replacement flow. Editing a sale live-recomputes its FIFO allocation(s).
- No backdating: Sale Date is not a user-editable field — every sale is recorded as of today automatically, sidestepping FIFO/allocation conflicts entirely.

- **Nav opens the Log Sale form directly** (not a history list first) — Sales is a bottom-nav item chosen specifically for frequent quick-entry. History is a secondary tab/link from this page.
- **Log Sale form fields:** Product (searchable select), Quantity, Price per unit, Sale Route (dropdown from extensible fixed list, with an "add new route" option inline). Sale Date is auto-set to today and shown read-only, not entered.
- **Live profit preview:** once Product + Quantity + Price are entered, show computed profit (price × qty − FIFO cost basis from oldest open batch(es)) before submitting — confirms the sale price makes sense.
- Batch(es) consumed and per-unit cost basis are derived automatically (FIFO, spanning multiple batches if needed per `planning-decisions.md`) — not shown as an editable field, but the preview can note "drawing from batch arrived [date]" for transparency.
- **Sales History** (secondary tab/link): list of past sales — product, qty, price/unit, route, date, profit — filterable by date range, product, and route.

### PC layout
- Log Sale form as a focused card/panel (not full-page modal) with the form on the left and the live profit preview alongside it on the right. "History" tab/link at the top switches to a full sales table with filters.

### Mobile layout
- Log Sale form fills the screen, fields stacked, profit preview appears as a summary line/card once enough fields are filled, above the Submit button. "History" accessible via a link/tab at the top or in the "More" section.

## Reports / Metrics

- **Organized as tabs**, one view at a time: **Overview | By Product | By Manufacturer | By Route**. Keeps each view focused, works well on mobile.
- **Global date-range filter** at the top of the page, applies to whichever tab is active — consistent comparisons across tabs without re-setting per tab. Presets (this month, this year) + custom range.
- **Overview tab:** total profit, total revenue, total units sold, avg sell-through time across all products — the same style of stat cards as the Dashboard, but fully date-range-scoped (Dashboard defaults to all-time; this always respects the filter).
- **By Product tab:** table/list of products with total profit, units sold, avg sell-through time (rollup across that product's batches) for the selected range. Sortable (e.g., by profit).
- **By Manufacturer tab:** table/list of manufacturers with profit attributed through consumed shipment batches, avg delivery time, avg shipping fee, and quality/ease-of-use ratings. Do not show a reliability percentage unless shipments later gain an expected-arrival target.
- **By Route tab:** per route — unit count, avg profit/unit, total profit (e.g., "eBay: 40 units, $10/unit profit, $400 total profit").
- **Per-batch/shipment drill-down** is not duplicated here — it's already covered by the Batches section on each Product's detail page (arrival date, cost/unit, sell-through time per batch).

### PC layout
- Tabs as a horizontal row below the page title, date-range filter top-right (persists across tab switches). Each tab renders as a data table, sortable columns.

### Mobile layout
- Tabs as a horizontal scrollable segmented control. Date-range filter as a dropdown/pill below the tabs (applies globally). Each tab's content as stacked cards rather than a wide table.

## Auth (Login)

- **Single centered login form** (email + password), no signup link, no OAuth buttons — matches the two-pre-created-accounts decision in `planning-decisions.md`. Same layout on PC and mobile (just narrower on mobile), no separate design needed.
- **In-app account/settings screen** lets each logged-in owner change their own password — no CLI/terminal required day-to-day. The two initial accounts are still bootstrapped once via a one-time seed script at setup, not through any UI. No email-based "forgot password" flow is needed (only two known users); if a password is fully forgotten (can't log in to self-service), that's a rare manual DB fix, not a built feature.

## Inventory Adjustments

- Add an **Adjust Inventory** action to each batch on the Product detail page.
- Require quantity change, reason (damage, loss, sample, return, count correction, or user-managed reason), effective date, and optional note.
- Preview current and resulting quantity; block any adjustment that would make inventory negative.
- Show adjustments in batch history alongside sales consumption so stock can be reconciled without changing the original shipment.
- On PC, use a focused dialog or side panel with compact batch history. On mobile, use a full-width form with large reason choices and a clear before/after quantity summary.

## Responsive Behavior — General Rules

- **Single breakpoint** (~768px) switches between the two layouts discussed per page — no separate tablet-specific design, since this app only needs to support "PC" and "mobile" per the original requirement (two users, phones + PC, not a broad public device matrix).
- **PC:** persistent left sidebar nav (6 items), data-dense tables with sortable columns, multi-column layouts for detail pages.
- **Mobile:** bottom nav bar (4 items: Dashboard, Sales, Shipments, More), tables become stacked card lists, detail pages become single-column, forms are full-width and full-screen (not modals) for easier thumb entry.
- **Touch targets on mobile:** buttons/tappable rows sized generously (min ~44px height) given this is used in the field, possibly one-handed.
- **FABs (floating action buttons)** used on mobile for primary "add new" actions (Add Product, Add Manufacturer, Log New Shipment) where no bottom-nav slot already covers that action.

---

## Next Topics To Discuss

- Visual design: color palette, typography, spacing scale, component library choice (e.g., shadcn/ui, Tailwind UI) vs. custom.
- Form/validation specifics: required fields, error states, confirmation dialogs for destructive actions (archive, delete, edit of a shipment/sale).
- Exact Postgres schema, allocation logic, and concurrency behavior derived from `planning-decisions.md` — to be completed in Roadmap Phase 0.5.
