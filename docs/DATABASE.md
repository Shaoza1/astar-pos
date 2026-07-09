# Astar POS — Database Documentation

> PostgreSQL 16+ | 23 tables | Author: Kutloano Moshao

---

## Table Reference

### `staff`
The root identity table for the entire system. Every other table that records "who performed this action" holds a foreign key back to `staff.id`. Stores a bcrypt hash of each staff member's 6-digit PIN — the plain PIN is never persisted. The optional `webauthn_credential_id` and `webauthn_public_key` columns support biometric authentication (fingerprint/face) added in Phase 1. The `role` column drives permission checks: `owner` and `manager` can void orders and change prices; `waiter` and `barman` can only take orders.

### `staff_sessions`
Tracks every clock-in and clock-out event per staff member. `clocked_out_at` is NULL while the session is open. The `flagged` column is set to `true` by the application when the device that clocked out differs from the device that clocked in — a signal of potential buddy-punching. `clock_in_method` distinguishes PIN from biometric logins for the fraud audit trail.

### `ingredient_groups`
Logical categories for grouping ingredients in stock reports and the delivery UI (e.g. Proteins, Dairy, Alcohol - Spirits). `sort_order` controls the display sequence. Groups have no business logic — they exist purely for human readability.

### `ingredients`
The core inventory catalogue. Every stockable item lives here. The critical design decision is that `current_stock` is always stored in `consumption_unit` (slices, ml, g, measures), not in `purchase_unit` (loaves, bottles, kg). This means the application never needs to perform unit conversion at query time — conversion happens once at delivery receipt. `low_stock_threshold` triggers an alert on the manager dashboard when `current_stock` falls below it.

### `menu_groups`
Top-level sections of the menu as displayed on the POS terminal (Breakfast, Starters, Mains - Steaks, etc.). `sort_order` controls the tab sequence. Deactivating a group (`is_active = false`) hides the entire section from the ordering screen without deleting any data.

### `menu_items`
Individual sellable items. `price` is the current selling price. `is_comp` marks items that can be added to an order at R0.00 — the application requires a logged reason when a comp item is added. Prices are never edited in-place; a price change writes a new row to `price_history` and then updates `menu_items.price`.

### `price_history`
An immutable audit trail of every price change. `reason` is mandatory at the application layer when the price change exceeds 20% — this prevents accidental large price changes going unnoticed. Old and new prices are both stored so the full price timeline of any item can be reconstructed.

### `recipes`
A one-to-one mapping between a menu item and its ingredient list. The `UNIQUE` constraint on `menu_item_id` enforces this. `notes` holds free-text instructions for the kitchen or for the stock deduction logic (e.g. "choose one of: boerewors OR beef patty"). Items without a recipe (e.g. a bottle of wine sold as-is) have no recipe row — the application skips stock deduction for them.

### `recipe_items`
The line items of a recipe. Each row says "this recipe requires X units of ingredient Y". `quantity` is always in `consumption_unit`. `is_optional` and `option_group` model choice-based items: if a burger comes with "chips OR mash OR salad", all three are `is_optional = true` with `option_group = 'side_choice'` — the application deducts only the chosen option.

### `tables`
Physical restaurant tables and bar positions. `table_number` is the human-readable label shown on the POS floor plan (T1, T2, BAR1). `location` distinguishes indoor, outdoor, and bar seating for reporting.

### `table_sessions`
A session represents guests being seated from the moment a table is opened to the moment the bill is paid. A table can only have one open session at a time — enforced by the `UNIQUE (table_id, closed_at)` constraint (PostgreSQL treats each NULL as distinct, so only one NULL per `table_id` is permitted). `is_flagged` is set by a background job if a session has been open for more than 4 hours with no new orders.

### `orders`
A table session can accumulate multiple orders (starter round, main round, drinks round). Each order has a `status` that drives the kitchen display: `pending` → `sent_to_kitchen` → `ready` → `served`. An order can be `cancelled` at any point before `served`, but individual items are voided via `order_items.is_voided` rather than deleting rows.

### `order_items`
Individual line items within an order. `unit_price` is a snapshot of the menu item's price at the moment the order was placed — it is never a live reference to `menu_items.price`. This means price changes never retroactively alter historical bills. `modifiers` stores the guest's chosen options as a JSON string. Voided items are soft-deleted: `is_voided = true`, `void_reason`, `voided_by`, and `voided_at` are all populated.

### `transactions`
The payment event that closes a table session. `payment_method = 'split'` indicates the bill was divided — child rows in `transaction_splits` hold the individual payment legs. `payment_reference` stores the Yoco or Peach Payments gateway reference for card transactions.

### `transaction_splits`
Child rows of a split-payment transaction. Each row represents one payment leg (e.g. guest A pays R150 cash, guest B pays R200 card). The sum of all `split_amount` values must equal `transactions.total_amount` — enforced at the application layer.

### `staff_accounts`
A running tab for each staff member. `balance` can go negative (the staff member owes the restaurant). `credit_limit` is the maximum debt allowed before further charges are blocked. The balance is not computed from entries at query time — it is maintained as a denormalised column updated atomically with each new entry to keep reads fast.

### `staff_account_entries`
An append-only ledger of every debit and credit on a staff account. Negative `amount` = charge (meal or drink taken on account). Positive `amount` = payment (staff pays off their tab). Rows are never updated or deleted — the full history is always preserved.

### `deliveries`
Header record for a supplier delivery. `status` moves from `pending` (just recorded) to `verified` (quantities confirmed correct) or `disputed` (discrepancies found and unresolved). `invoice_reference` links to the supplier's paper invoice for reconciliation.

### `delivery_items`
Line items for a delivery, all quantities in `purchase_unit`. `discrepancy` is a PostgreSQL generated column: `quantity_received - COALESCE(quantity_ordered, quantity_received)`. A positive discrepancy means more was received than ordered; negative means a short delivery. `quantity_ordered` is nullable to support unplanned deliveries.

### `stock_movements`
An append-only ledger of every change to ingredient stock levels. `quantity_change` is negative for consumption (sales, waste) and positive for additions (deliveries, manual adjustments). `reference_id` and `reference_type` form a polymorphic link back to the source record (`order_item`, `delivery_item`, or `manual_adjustment`). This table is the source of truth for reconstructing stock at any point in time.

### `shift_reports`
A summary record created when a shift opens and finalised when it closes. `total_sales`, `total_cash`, `total_card`, and `total_voids` are computed and written at close time — they are not live-calculated. The `UNIQUE (shift_date, shift)` constraint prevents duplicate shift records.

### `variance_reports`
Per-ingredient stock variance for a shift. `variance` and `variance_type` are PostgreSQL generated columns — they are always mathematically consistent with the entered counts and cannot be manually overridden. See the Variance Calculation section below.

### `audit_log`
An immutable, append-only log of every INSERT, UPDATE, and DELETE on audited tables. Populated by database triggers (implemented in Phase 1), not by application code — this means it cannot be bypassed by a bug or a direct database connection. `old_data` and `new_data` store the full row as JSONB for forensic reconstruction of any historical state.

---

## Unit Conversion System

Stock is purchased in one unit but consumed in another. A loaf of bread is bought as one unit but consumed slice by slice. A bottle of spirits is bought as one bottle but poured as 25ml measures.

The `ingredients` table stores three columns that define this relationship:

| Column | Example (bread) | Example (whisky) |
|---|---|---|
| `purchase_unit` | `loaf` | `bottle` |
| `consumption_unit` | `slice` | `measure` |
| `units_per_purchase` | `20` | `30` |

**The rule:** `current_stock` is always stored in `consumption_unit`. When a delivery is received, the application converts before writing to stock:

```
stock_added (consumption units) = quantity_received × units_per_purchase
```

For example, receiving 3 loaves of bread adds `3 × 20 = 60 slices` to `current_stock`.

When a recipe item specifies `quantity = 2` for bread, it means 2 slices — always in consumption units. No conversion is needed at sale time.

This design means:
- `current_stock` can always be compared directly to `low_stock_threshold` without conversion
- Recipe quantities are always in the same unit as stock — no runtime arithmetic
- `cost_per_consumption_unit` can be derived on demand: `cost_per_purchase_unit / units_per_purchase`

---

## Recipe-Level Stock Deduction Flow

When a waiter marks an order as `sent_to_kitchen`, the following happens in a single database transaction:

1. For each `order_item` in the order (where `is_voided = false`):
2. Look up the `recipe` for that `menu_item_id`. If no recipe exists, skip (item has no tracked ingredients).
3. For each `recipe_item` in the recipe:
   - If `is_optional = true`, check the `modifiers` JSON on the `order_item` to determine which option was chosen. Only deduct the chosen ingredient.
   - If `is_optional = false`, always deduct.
4. Calculate deduction: `deduction = recipe_item.quantity × order_item.quantity`
5. Write a row to `stock_movements`: `movement_type = 'sale'`, `quantity_change = -deduction`, `reference_id = order_item.id`, `reference_type = 'order_item'`
6. Update `ingredients.current_stock`: `current_stock = current_stock - deduction`

Steps 5 and 6 happen atomically. If any deduction fails (e.g. stock goes below zero), the entire transaction rolls back and the order is not sent to the kitchen until the issue is resolved.

**Void reversal:** When an `order_item` is voided after stock has already been deducted, a reversal `stock_movement` is written with `movement_type = 'void_reversal'` and a positive `quantity_change`, and `current_stock` is incremented back.

---

## Variance Calculation Formula

At the end of each shift, a manager performs a physical stock count. The variance report compares what the system expected to what was actually counted.

```
variance = opening_stock + stock_received - expected_consumption - actual_count
```

| Term | Source |
|---|---|
| `opening_stock` | `current_stock` at the start of the shift (snapshot taken when shift opens) |
| `stock_received` | Sum of `delivery_items.quantity_received × units_per_purchase` during the shift |
| `expected_consumption` | Sum of all `stock_movements.quantity_change` where `movement_type = 'sale'` during the shift |
| `actual_count` | Physical count entered by the manager at shift close |

**Interpreting the result:**

- `variance < 0` → **shortage** — more stock was consumed than expected. Possible causes: unrecorded waste, theft, recipe quantities wrong, or counting error.
- `variance > 0` → **over** — less stock was consumed than expected. Possible causes: physical count error, items sold but not rung up (revenue leakage), or recipe quantities overstated.
- `variance = 0` → **exact** — system and physical count agree.

`variance` and `variance_type` are PostgreSQL `GENERATED ALWAYS AS ... STORED` columns — they are computed by the database engine and cannot be manually set.

---

## Audited Tables

The following tables are covered by the `audit_log` trigger (implemented in Phase 1):

| Table | Why audited |
|---|---|
| `staff` | Role changes and deactivations must be traceable |
| `menu_items` | Price and availability changes affect revenue |
| `price_history` | Already an audit table — trigger captures any tampering |
| `order_items` | Voids are the primary fraud vector |
| `transactions` | Payment records must be immutable |
| `stock_movements` | Manual adjustments can mask theft |
| `ingredients` | Direct stock edits bypass the movement ledger |
| `staff_accounts` | Balance changes must be fully traceable |

Tables that are already append-only (`stock_movements`, `staff_account_entries`, `audit_log` itself) do not need UPDATE/DELETE triggers — those operations are blocked at the application layer.

---

## Index Strategy

Indexes are chosen based on three query patterns:

**1. Foreign key lookups** — every FK column has a `btree` index. PostgreSQL does not create these automatically, and without them, joins on large tables degrade to sequential scans.

**2. Partial indexes** — used where a query always filters on a boolean or status column:
- `idx_staff_sessions_open` — `WHERE clocked_out_at IS NULL` for the "who is clocked in right now" query
- `idx_table_sessions_open` — `WHERE closed_at IS NULL` for the floor plan view
- `idx_order_items_voided` — `WHERE is_voided = true` for the void audit report
- `idx_ingredients_low_stock` — `WHERE is_active = true` for the low-stock alert query
- `idx_variance_reports_shortages` / `_overs` — for the filtered variance report views

**3. Composite indexes** — used where two columns are always queried together:
- `idx_stock_movements_ingredient_date` — `(ingredient_id, performed_at)` for the variance calculation query that sums movements per ingredient per shift

**4. GIN indexes** — on `audit_log.old_data` and `audit_log.new_data` (JSONB) to support forensic searches across historical record states without full table scans.

Indexes are not added to `audit_log.table_name + record_id` as a composite because the existing `idx_audit_log_table_record` covers that pattern.
