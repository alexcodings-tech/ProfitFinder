-- Replace unique constraint on product_recipes to include variant_id so each
-- packaging variant can have its own row per ingredient.
ALTER TABLE public.product_recipes
  DROP CONSTRAINT IF EXISTS product_recipes_product_id_ingredient_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS product_recipes_product_variant_ingredient_unique
  ON public.product_recipes (product_id, ingredient_name, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Enable realtime so recipe changes propagate live without refresh
ALTER TABLE public.product_recipes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_recipes;