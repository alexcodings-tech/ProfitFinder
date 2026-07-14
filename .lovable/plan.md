# Production Management System Upgrade – Implementation Plan

This PRD has 7 items spanning Dashboard, Recipes, Production & Costing, AI Insights, and realtime sync. Below is what I'll build, grouped by area, with the files I plan to touch.

---

## 1. Recipe Manager – Auto Total Batch Quantity
**File:** `src/components/production/RecipeManager.tsx`

- Sum all `quantity_required` rows (normalized to a single base unit – kg or L via `toBaseUnit`) and display **"Total Batch Quantity: X kg"** near the Save button.
- The displayed total updates live as the user edits any row.
- On save, also write the computed sum back into `product_recipes.total_batch_quantity` for every row of that product so per-kg costing stays accurate (this is what feeds AI Insights / Margin table).

## 2. Dashboard – "Total Batches We Can Produce"
**Files:** `src/components/dashboard/StatsCards.tsx` (or a new small component), `src/hooks/useBusinessIntelligence.ts`

- New stat card titled **"Total Batches We Can Produce"** per product (top product shown on dashboard summary; full list already exists under AI Insights "Can produce").
- Logic: for each ingredient in the recipe, `floor(inventory_available_in_base_unit / qty_required_in_base_unit)`. Take the **min** across ingredients = max producible batches.
- This already exists partially as `maxProducibleUnits` in `useBusinessIntelligence`; I'll rename/expose it as **batches** (since recipe is per batch, not per unit) and surface a new dashboard header that aggregates across products too.

## 3. Production & Costing – Per-KG Profit
**Files:** `src/components/production/RecipeManager.tsx`, `src/hooks/useCostingAnalytics.ts`, any costing display in `src/pages/Production.tsx`

- Profit/margin formula everywhere becomes:
  `profit_per_kg = selling_price_per_kg − (total_batch_cost / total_batch_quantity_kg)`
- Replace any place still multiplying by total quantity for margin %.

## 4. Dynamic Margin & Suggested Price on Ingredient Cost Change
**Files:** `src/lib/cascadeRecalc.ts`, `src/hooks/useCostRevision.ts`, `src/hooks/useProfitInsights.ts`

- The cascade already recomputes snapshots; I'll confirm it triggers on every `product_ingredients.unit_price` update (via Sales/Purchase save, OCR revision, and manual recipe edits) and refreshes margin + suggested price.
- Suggested price stays `cost_per_kg / (1 − target_margin)` using user-settings target margin (default 30%).

## 5. Realtime Sync Across Pages
**Files:** add Supabase `postgres_changes` subscriptions in:
- `src/hooks/useProducts.ts`
- `src/hooks/useBusinessIntelligence.ts`
- `src/hooks/useProfitInsights.ts`
- `src/hooks/useCostingAnalytics.ts`
- `src/hooks/useDashboardStats.ts`

Each will invalidate/refetch on changes to `products`, `product_ingredients`, `product_recipes`, `batches`, `sales`, `bills`, `product_cost_snapshots`.

Migration: `ALTER PUBLICATION supabase_realtime ADD TABLE …` for these tables (only those not already added).

## 6. Shared Ingredient Mapping
**Files:** `src/hooks/useBusinessIntelligence.ts`, inventory aggregation logic

- Inventory lookup keys on `lower(trim(ingredient_name))` across **all** of the user's `product_ingredients` rows (sum `quantity`, weighted-avg `unit_price`), instead of per-product rows.
- Producibility & cost lookup both read from this shared map.
- No schema change; purely a query/aggregation change.

## 7. AI Recommendations – Show All Products Dynamically
**File:** `src/hooks/useBusinessIntelligence.ts`, `src/components/dashboard/AIInsights.tsx`

- Today the list is `data.products.slice(0, 6)`. I'll:
  - Remove the slice (show all) **or** keep slice(0,6) with a "Show all" expander – I'll go with **show all, scrollable** for completeness.
  - Ensure the hook iterates over **every** product from `useProducts`, including those without a snapshot yet (currently it may skip products lacking a recipe or snapshot).
  - Realtime subscription (item 5) ensures new products appear without refresh.

---

## Technical Notes

- All unit math goes through `src/lib/unitConversion.ts` (`toBaseUnit`) – no ad-hoc conversions.
- No schema changes required for items 1, 3, 4, 6, 7. Only item 5 needs a tiny migration to enable realtime publication on the relevant tables.
- I'll keep changes UI-/hook-layer focused; business rules stay in hooks/lib so the existing per-kg fixes from the prior session remain the single source of truth.

## Order of Work

1. RecipeManager total batch qty + write-back (items 1, 3 base)
2. Hook updates: shared-ingredient map, all-products iteration, per-kg margin (items 3, 6, 7)
3. Realtime migration + subscriptions (item 5)
4. Dashboard "Total Batches" card (item 2)
5. AIInsights show-all + verify cascade (items 4, 7)
6. Smoke-test build, verify console/network.