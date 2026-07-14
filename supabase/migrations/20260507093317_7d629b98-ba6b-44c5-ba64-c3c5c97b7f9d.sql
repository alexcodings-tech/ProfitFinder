ALTER TABLE public.product_recipes
ADD COLUMN IF NOT EXISTS total_batch_quantity numeric NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS batch_unit text NOT NULL DEFAULT 'kg';