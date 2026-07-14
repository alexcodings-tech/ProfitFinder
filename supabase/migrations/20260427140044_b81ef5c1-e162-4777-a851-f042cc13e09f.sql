-- 1. Packaging variants per product
CREATE TABLE public.product_packaging_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL,
  size_label TEXT NOT NULL,
  pack_size NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'kg',
  cover_cost NUMERIC NOT NULL DEFAULT 0,
  selling_price NUMERIC NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_packaging_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own variants" ON public.product_packaging_variants
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own variants" ON public.product_packaging_variants
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own variants" ON public.product_packaging_variants
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own variants" ON public.product_packaging_variants
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_packaging_variants_updated_at
  BEFORE UPDATE ON public.product_packaging_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add Utilities + Shipping + tax basis to production costs
ALTER TABLE public.product_production_costs
  ADD COLUMN utilities_cost NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN utilities_cost_mode TEXT NOT NULL DEFAULT 'per_batch',
  ADD COLUMN shipping_cost NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN shipping_cost_mode TEXT NOT NULL DEFAULT 'per_batch',
  ADD COLUMN tax_basis TEXT NOT NULL DEFAULT 'cost';
-- tax_basis: 'cost' = % applied to ingredient+overhead (existing), 'mrp' = % of selling price

-- Default new templates to 5% of MRP
ALTER TABLE public.product_production_costs
  ALTER COLUMN tax_value SET DEFAULT 5;

-- 3. Batch size mode + variant link
ALTER TABLE public.batches
  ADD COLUMN batch_size_mode TEXT NOT NULL DEFAULT 'units',
  ADD COLUMN batch_weight NUMERIC,
  ADD COLUMN batch_weight_unit TEXT,
  ADD COLUMN variant_id UUID;