-- Allow recipes to be scoped to a specific packaging variant (e.g. 1kg vs 500g pack).
-- NULL variant_id = legacy / generic recipe that applies when no variant is chosen.
ALTER TABLE public.product_recipes
  ADD COLUMN IF NOT EXISTS variant_id uuid NULL;

-- Helpful index for lookups by (product, variant)
CREATE INDEX IF NOT EXISTS idx_product_recipes_product_variant
  ON public.product_recipes (product_id, variant_id);
