CREATE TABLE public.inventory_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ingredient_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, ingredient_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_ingredients TO authenticated;
GRANT ALL ON public.inventory_ingredients TO service_role;

ALTER TABLE public.inventory_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own inventory ingredients"
ON public.inventory_ingredients
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_inventory_ingredients_updated_at
BEFORE UPDATE ON public.inventory_ingredients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();