
-- Add price column (per-kg cost) to product_ingredients
ALTER TABLE public.product_ingredients ADD COLUMN price numeric NOT NULL DEFAULT 0;

-- Backfill existing rows: price = total_cost / quantity (per-kg), fallback to unit_price
UPDATE public.product_ingredients 
SET price = CASE 
  WHEN quantity > 0 THEN ROUND(total_cost / quantity, 2)
  ELSE unit_price 
END;
