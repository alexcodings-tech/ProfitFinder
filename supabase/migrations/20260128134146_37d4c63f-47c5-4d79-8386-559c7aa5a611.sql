-- Create product_recipes table for defining ingredient requirements per product unit
CREATE TABLE public.product_recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  quantity_required NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, ingredient_name)
);

-- Create batches table for tracking production runs
CREATE TABLE public.batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity_produced NUMERIC NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create batch_ingredients table for tracking ingredients used in each batch
CREATE TABLE public.batch_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  quantity_used NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_ingredients ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_recipes
CREATE POLICY "Users can view their own recipes" ON public.product_recipes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recipes" ON public.product_recipes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recipes" ON public.product_recipes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recipes" ON public.product_recipes
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for batches
CREATE POLICY "Users can view their own batches" ON public.batches
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own batches" ON public.batches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own batches" ON public.batches
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own batches" ON public.batches
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for batch_ingredients (through batch ownership)
CREATE POLICY "Users can view batch ingredients of their batches" ON public.batch_ingredients
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.batches WHERE batches.id = batch_ingredients.batch_id AND batches.user_id = auth.uid()
  ));

CREATE POLICY "Users can create batch ingredients for their batches" ON public.batch_ingredients
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.batches WHERE batches.id = batch_ingredients.batch_id AND batches.user_id = auth.uid()
  ));

-- Add triggers for updated_at
CREATE TRIGGER update_product_recipes_updated_at
  BEFORE UPDATE ON public.product_recipes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();