-- Production cost templates per product (defaults)
CREATE TABLE public.product_production_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL UNIQUE,
  packing_cover NUMERIC NOT NULL DEFAULT 0,
  packing_cover_mode TEXT NOT NULL DEFAULT 'per_unit', -- per_unit | per_batch
  label_cost NUMERIC NOT NULL DEFAULT 0,
  label_cost_mode TEXT NOT NULL DEFAULT 'per_unit',
  labor_cost NUMERIC NOT NULL DEFAULT 0,
  labor_cost_mode TEXT NOT NULL DEFAULT 'per_batch',
  machine_cost NUMERIC NOT NULL DEFAULT 0,
  machine_cost_mode TEXT NOT NULL DEFAULT 'per_batch',
  eb_cost NUMERIC NOT NULL DEFAULT 0,
  eb_cost_mode TEXT NOT NULL DEFAULT 'per_batch',
  tax_value NUMERIC NOT NULL DEFAULT 0,
  tax_mode TEXT NOT NULL DEFAULT 'percent', -- percent | flat
  default_batch_size NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_production_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own production costs"
  ON public.product_production_costs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own production costs"
  ON public.product_production_costs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own production costs"
  ON public.product_production_costs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own production costs"
  ON public.product_production_costs FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_ppc_updated_at
  BEFORE UPDATE ON public.product_production_costs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-batch overhead snapshot (linked to a produced batch)
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS ingredient_cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overhead_cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_batch_cost NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overhead_breakdown JSONB;