
-- Add selling_price to products table
ALTER TABLE public.products ADD COLUMN selling_price numeric NOT NULL DEFAULT 0;

-- Create ingredient_cost_history table
CREATE TABLE public.ingredient_cost_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ingredient_name text NOT NULL,
  old_price numeric NOT NULL DEFAULT 0,
  new_price numeric NOT NULL DEFAULT 0,
  bill_id uuid REFERENCES public.bills(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create product_cost_snapshots table
CREATE TABLE public.product_cost_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  bill_id uuid REFERENCES public.bills(id) ON DELETE SET NULL,
  old_total_cost numeric NOT NULL DEFAULT 0,
  new_total_cost numeric NOT NULL DEFAULT 0,
  selling_price numeric NOT NULL DEFAULT 0,
  old_profit numeric NOT NULL DEFAULT 0,
  new_profit numeric NOT NULL DEFAULT 0,
  old_margin numeric NOT NULL DEFAULT 0,
  new_margin numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ingredient_cost_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_cost_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS for ingredient_cost_history
CREATE POLICY "Users can view their own cost history"
  ON public.ingredient_cost_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cost history"
  ON public.ingredient_cost_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS for product_cost_snapshots
CREATE POLICY "Users can view their own cost snapshots"
  ON public.product_cost_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cost snapshots"
  ON public.product_cost_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add unit_price column to product_ingredients for per-unit pricing
ALTER TABLE public.product_ingredients ADD COLUMN unit_price numeric NOT NULL DEFAULT 0;
