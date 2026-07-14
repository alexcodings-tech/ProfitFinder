
-- Add missing UPDATE/DELETE RLS policies

-- batch_ingredients: scope via parent batches table
CREATE POLICY "Users can update their batch ingredients"
ON public.batch_ingredients FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.batches b WHERE b.id = batch_ingredients.batch_id AND b.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.batches b WHERE b.id = batch_ingredients.batch_id AND b.user_id = auth.uid()));

CREATE POLICY "Users can delete their batch ingredients"
ON public.batch_ingredients FOR DELETE
USING (EXISTS (SELECT 1 FROM public.batches b WHERE b.id = batch_ingredients.batch_id AND b.user_id = auth.uid()));

-- ingredient_cost_history
CREATE POLICY "Users can update their ingredient cost history"
ON public.ingredient_cost_history FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their ingredient cost history"
ON public.ingredient_cost_history FOR DELETE
USING (auth.uid() = user_id);

-- product_cost_snapshots
CREATE POLICY "Users can update their cost snapshots"
ON public.product_cost_snapshots FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their cost snapshots"
ON public.product_cost_snapshots FOR DELETE
USING (auth.uid() = user_id);

-- user_settings DELETE
CREATE POLICY "Users can delete their own settings"
ON public.user_settings FOR DELETE
USING (auth.uid() = user_id);
