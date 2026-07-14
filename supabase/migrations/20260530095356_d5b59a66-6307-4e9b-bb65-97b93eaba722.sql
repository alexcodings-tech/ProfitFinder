CREATE TABLE public.product_batch_sizes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL,
  batch_size NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_batch_sizes TO authenticated;
GRANT ALL ON public.product_batch_sizes TO service_role;

ALTER TABLE public.product_batch_sizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own batch sizes"
ON public.product_batch_sizes
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own batch sizes"
ON public.product_batch_sizes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own batch sizes"
ON public.product_batch_sizes
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own batch sizes"
ON public.product_batch_sizes
FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_product_batch_sizes_updated_at
BEFORE UPDATE ON public.product_batch_sizes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();