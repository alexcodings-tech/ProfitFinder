ALTER TABLE public.product_recipes
  ADD COLUMN IF NOT EXISTS planned_quantity numeric,
  ADD COLUMN IF NOT EXISTS planned_unit text;