# Planning Decisions

Living reference of decisions made during planning sessions for the inventory app. Source requirements live in `vision.md`. This file is updated as new decisions are made; treat it as the current source of truth, superseding earlier reasoning in conversation history.

## Status: Core product and UI planning complete, including rigor/scope clarifications (backdating, stock shortfall, corrections model, reliability, account admin, backups) — no implementation started yet. Data-model and business-rule specification in Roadmap Phase 0.5 is the next required step.

---

## Platform & Delivery
- **Responsive web app only.** No native app, no PWA install layer (may revisit PWA later if a home-screen icon is wanted).
- **No barcode scanning** — off the table unless the business grows significantly beyond current expectations.
- Hosted on **Railway**, database also on Railway.

## Tech Stack
- **Next.js (TypeScript)** — single full-stack app, one Railway service.
- **Postgres** (Railway-hosted) as the database.

## Authentication
- The two initial accounts are created once via a one-time seed script/migration run by the developer at setup — not user-facing.
- After that, each owner can change their own password via an in-app account/settings screen while logged in — no CLI/terminal ever required day-to-day.
- Before production use, verify Railway database backups and document a tested restore procedure. This is disaster-recovery only — no separate human-readable business-data export feature is needed.

- **Email/password auth**, two pre-created accounts (no public signup, no OAuth/third-party provider).
- Likely implementation: NextAuth/Auth.js credentials provider with hashed passwords.
- No public-facing domain expected, reinforcing that simple email/password is sufficient (not consumer-facing).

## Manufacturers
- One shared rating set per manufacturer (not per-owner) since only one of the two owners handles ordering:
  - **Quality rating**: numeric 1–5.
  - **Ease-of-use rating**: numeric 1–5.
  - Both ratings also support optional free-text notes for context.
- Manufacturer-level stats (avg delivery time and avg shipping fee) are **computed/aggregated from Shipment records**, not stored directly on the manufacturer.
- **Reliability rating**: shipments gain an optional **expected arrival date** field (entered when logging the shipment). Reliability (% delivered on or before expected date) is computed once a manufacturer has enough shipments with that field populated; shown as "not enough data yet" until then.

## Shipments (order/batch records)
- Shipment monetary values use fixed-precision decimal database types, never floating point.
- **Corrections — middle-ground rigor:** a sale creation transaction still protects against overselling (row-level check against remaining batch quantity), but shipments and sales themselves are directly editable/deletable by the owners, guarded by a confirmation dialog — no formal reversal-and-replacement ledger for now. Editing a shipment that's already been partially or fully sold against simply recalculates downstream remaining quantities/cost-per-unit live. Revisit a stricter audit-trail model later only if corrections turn out to be frequent or error-prone in practice.

- One product per shipment record (owner primarily places one order at a time; accepted tradeoff of more records if orders are ever bundled).
- Fields include:
  - Manufacturer (reference)
  - Product (reference)
  - Quantity ordered
  - Product cost (separate field)
  - Shipping fee (separate field)
  - Order date
  - Expected arrival date (optional, entered at order time — feeds the manufacturer reliability metric)
  - Arrival date (filled in once shipment arrives; null/pending until then)
  - Status (ordered / arrived, implied by presence of arrival date)
- **Total cost = product cost + shipping fee**, and this total is what's used to determine per-unit cost for that shipment/batch.
- Shipping fee is tracked separately from product cost specifically so manufacturer-level shipping-fee comparisons are possible independent of product pricing.

## Products & Inventory
- **Decision: Option 3 — batch-based inventory.** Each shipment is its own inventory batch with its own remaining quantity and cost/unit (derived from that shipment's total cost ÷ quantity).
- Sales will be recorded against a batch, defaulting to **oldest-arrived-batch-first (FIFO)**, rather than against the product in the abstract.
- Rationale: matches the owner's mental model (already thinks in terms of "shipment of 75 units arrived on 7/26"), gives accurate per-unit profit when supplier costs fluctuate between shipments, and is required for the "sell-through time" metric (time from shipment arrival to last unit sold in that batch) called out in vision.md.

### Product fields
- **Name**: free-form text (e.g., "Squishy XL"). No structured variant/family system for now — each distinct sellable item is its own product row. Can be layered on later without restructuring if needed.
- **Goal price**: single current value on the product (the expected/target sale price at time of purchase). No history tracking — actual sale prices recorded per-sale are the real data of record; goal price is just a reference target.
- **Category**: user-managed controlled list used purely for filtering and historical grouping. It is not a hardcoded enum and does not drive category-specific fields/schema.
- **Quantity available**: not stored directly — derived/computed as the sum of remaining quantity across the product's open batches (shipments).
- **No explicit status field** (e.g. active/discontinued). `quantity available = 0` is sufficient signal that a product has nothing to sell; reordering is just logging a new shipment.
- **Hidden/archived flag**: boolean to hide old/inactive products from dashboards without deleting their historical data.
- **Pending deliveries**: no new field needed — this is just a view/query over Shipments where `arrival_date IS NULL` (i.e., ordered but not yet arrived), surfaced as its own dashboard section.

## Sales
- Each sale creates one or more **sale allocation** records linking it to the batch(es) consumed. Each allocation stores the batch, quantity consumed, and unit cost/cost basis used at the time of sale.
- Sale creation, stock validation, FIFO allocation, and inventory consumption occur in one database transaction with row-level protection against simultaneous overselling.
- If insufficient arrived inventory exists, the entire sale is rejected (no partial fulfillment); the owner must correct the quantity or log/mark-arrived more stock first.
- **No backdating:** sale date is always today's date at time of entry, not a past date the owner can pick. This sidesteps FIFO/allocation conflicts entirely — no backdated-sale recompute logic is needed. (If a sale was missed, log it today rather than reconstructing history.)
- Completed sales are directly editable/deletable by the owners (confirmation dialog required) — per the middle-ground rigor decision, no formal reversal-and-replacement ledger. Editing a sale live-recomputes its FIFO allocation(s).

- **Batch linkage: auto-FIFO.** When a sale is logged, the app automatically pulls from the oldest arrived batch (by arrival date) with remaining quantity — no manual batch selection.
- **Multi-batch spanning (Option A):** if a sale's quantity exceeds the remaining quantity in the oldest batch, the app automatically spans into the next-oldest batch(es) to fulfill it, splitting cost basis accordingly for profit calculations. No manual splitting of sale records required.
- **Quantity per sale:** a single sale record can cover more than 1 unit (not limited to 1 unit per transaction).
- **Sale price entered as per-unit price** (e.g., "$15/unit"), not a lump total. Total sale amount = price per unit × quantity. (Reasoning: keeps pricing consistent/comparable against per-unit batch cost and per-product goal price.)
- **Sale route:** fixed list (not free text) to keep route-based reporting consistent, but the list is user-extensible — owners can add new routes (e.g., a new marketplace) rather than being stuck with a hardcoded set baked into the code.
- **Sale fields:** product, quantity, price per unit, sale route (from extensible fixed list), sale date (auto-set to today, not editable). Batch(es) consumed and per-unit cost basis are derived automatically via FIFO, not entered manually.

## Metrics & Reporting
- **Manufacturer profit attribution:** profit is attributed through the shipment batches consumed by sale allocations. A product sourced from multiple manufacturers therefore credits the correct manufacturer for each allocated unit.
- **Reliability metric:** computed from the shipment's expected-arrival field (see Manufacturers section) once a manufacturer has enough shipments with that field populated; shown as "not enough data yet" until then.

- **Profit/loss granularity — all of the following are needed as views/aggregations of the same underlying sale & batch data:**
  - Overall business totals
  - Per-product
  - Per-manufacturer (pairs with manufacturer quality/delivery ratings — "is this manufacturer actually profitable for us?")
  - Per-batch/shipment (more of a drill-down/detail view than a dashboard section)
- **Sell-through time: tracked per-batch** (arrival date → date the batch's last unit sale was recorded), per vision.md's literal definition. A per-product average across its batches can be shown as a rollup, derived from the same per-batch numbers (no extra data needed).
- **Route-of-sale breakdown:** for each route, show unit count, average profit per unit, and total profit. Example: "eBay: 40 units, $10/unit profit, $400 total profit."
- **Adjustable time frames required** — all metrics/reports need date-range filtering (e.g., this month, this year, custom range), not just all-time totals.

---

## Inventory Adjustments

- Track damage, loss, samples, returns, and count corrections in an **inventory adjustment ledger** linked to a batch.
- Each adjustment records quantity delta, reason, effective date, optional note, and the user who recorded it.
- Adjustments do not rewrite the shipment's original quantity. Current quantity is derived from received quantity, sale allocations, and adjustments.
- An adjustment cannot reduce a batch below zero available units.

## FIFO, Dates, Money & Audit Rules

- FIFO always uses today's date (no backdating — see Sales section), ordered by arrival date and then a stable tie-breaker such as creation timestamp/ID for batches sharing an arrival date.
- Business dates and report boundaries use `America/New_York` (confirmed as the correct business timezone). Store timestamps in UTC and convert at application/report boundaries; use date columns for events where time-of-day is not meaningful.
- Store currency in fixed-precision decimal columns, never binary floating point.
- Preserve sufficient precision for per-unit costs when shipment totals do not divide evenly by quantity.
- A batch's allocated cost must reconcile exactly to product cost plus shipping. Define a deterministic remainder rule and round only for display/final currency totals.
- The schema must include, at minimum: users, manufacturers, products, categories, shipments/batches, inventory adjustments, sale routes, sales, and sale allocations.
- Use foreign keys, positive-quantity checks, rating bounds, non-negative monetary checks, timestamps, acting-user fields where useful, and appropriate uniqueness constraints.
- Quantity available, remaining batch quantity, revenue, profit, delivery time, and sell-through time are derived rather than independently editable totals.
- Automated tests are required for single- and multi-batch FIFO, exact sell-out, insufficient stock (rejection), simultaneous sales (oversell protection), fractional costs, and inventory adjustments. (No backdated-sale or reversal-workflow tests needed — those scenarios are designed out per the middle-ground rigor decision.)

## Next Topics To Discuss
All major topics from `vision.md` have been covered. Before feature implementation, complete Roadmap Phase 0.5: exact Postgres schema, constraints, transaction/locking behavior, decimal reconciliation rules, and automated FIFO tests. Visual styling and detailed form behavior can be decided in their relevant phases.
