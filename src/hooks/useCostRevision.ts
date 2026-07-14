import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cascadeRecalcForIngredients } from "@/lib/cascadeRecalc";

export interface RecipeIngredient {
  ingredient_name: string;
  quantity_required: number;
  unit: string;
  old_price: number; // from product_ingredients.unit_price
  new_price: number; // user input
}

export interface CostRevisionResult {
  old_total_cost: number;
  new_total_cost: number;
  selling_price: number;
  old_profit: number;
  new_profit: number;
  old_margin: number;
  new_margin: number;
  ingredients: RecipeIngredient[];
}

export function useCostRevision() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const fetchRecipeWithPrices = async (
    productId: string
  ): Promise<RecipeIngredient[] | null> => {
    if (!user) return null;
    setIsLoading(true);

    try {
      // Fetch ingredients directly from product_ingredients (matched by product_id)
      const { data: ingredients, error: ingError } = await supabase
        .from("product_ingredients")
        .select("ingredient_name, quantity, unit, unit_price, total_cost, price")
        .eq("product_id", productId)
        .eq("user_id", user.id);

      if (ingError) throw ingError;
      if (!ingredients || ingredients.length === 0) return [];

      return ingredients.map((i) => {
        const qty = i.quantity || 0;
        // Use the dedicated price (per-kg) column; fallback to calculated value
        const perKgPrice = (i.price && i.price > 0)
          ? i.price
          : qty > 0
            ? (i.total_cost || 0) / qty
            : (i.unit_price || 0);
        const roundedPrevCost = Math.round(perKgPrice * 100) / 100;
        return {
          ingredient_name: i.ingredient_name,
          quantity_required: qty,
          unit: i.unit,
          old_price: roundedPrevCost,
          new_price: roundedPrevCost,
        };
      });
    } catch (error) {
      console.error("Error fetching recipe with prices:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const calculateRevision = (
    ingredients: RecipeIngredient[],
    sellingPrice: number
  ): Omit<CostRevisionResult, "ingredients"> => {
    const old_total_cost = ingredients.reduce(
      (sum, i) => sum + i.quantity_required * i.old_price,
      0
    );
    const new_total_cost = ingredients.reduce(
      (sum, i) => sum + i.quantity_required * i.new_price,
      0
    );

    const old_profit = sellingPrice - old_total_cost;
    const new_profit = sellingPrice - new_total_cost;
    const old_margin = sellingPrice > 0 ? (old_profit / sellingPrice) * 100 : 0;
    const new_margin = sellingPrice > 0 ? (new_profit / sellingPrice) * 100 : 0;

    return {
      old_total_cost: Math.round(old_total_cost * 100) / 100,
      new_total_cost: Math.round(new_total_cost * 100) / 100,
      selling_price: sellingPrice,
      old_profit: Math.round(old_profit * 100) / 100,
      new_profit: Math.round(new_profit * 100) / 100,
      old_margin: Math.round(old_margin * 100) / 100,
      new_margin: Math.round(new_margin * 100) / 100,
    };
  };

  const saveRevision = async (
    productId: string,
    billId: string | null,
    ingredients: RecipeIngredient[],
    revision: Omit<CostRevisionResult, "ingredients">
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      // Save ingredient cost history
      const costHistoryRows = ingredients
        .filter((i) => i.old_price !== i.new_price)
        .map((i) => ({
          user_id: user.id,
          product_id: productId,
          ingredient_name: i.ingredient_name,
          old_price: i.old_price,
          new_price: i.new_price,
          ...(billId ? { bill_id: billId } : {}),
        }));

      if (costHistoryRows.length > 0) {
        const { error: histError } = await supabase
          .from("ingredient_cost_history")
          .insert(costHistoryRows);
        if (histError) throw histError;
      }

      // Save product cost snapshot
      const recommendedPrice = Math.round(
        (revision.selling_price + (revision.new_total_cost - revision.old_total_cost)) * 100
      ) / 100;
      const { error: snapError } = await supabase
        .from("product_cost_snapshots")
        .insert({
          user_id: user.id,
          product_id: productId,
          ...(billId ? { bill_id: billId } : {}),
          old_total_cost: revision.old_total_cost,
          new_total_cost: revision.new_total_cost,
          selling_price: revision.selling_price,
          old_profit: revision.old_profit,
          new_profit: revision.new_profit,
          old_margin: revision.old_margin,
          new_margin: revision.new_margin,
          recommended_price: recommendedPrice,
        } as any);
      if (snapError) throw snapError;

      // Update price, unit_price, and total_cost in product_ingredients
      // Fetch current quantities from DB to avoid overwriting bill-save updates
      for (const ing of ingredients) {
        if (ing.old_price !== ing.new_price) {
          const { data: currentIng } = await supabase
            .from("product_ingredients")
            .select("quantity")
            .eq("product_id", productId)
            .eq("ingredient_name", ing.ingredient_name)
            .eq("user_id", user.id)
            .maybeSingle();

          const currentQty = currentIng?.quantity ?? ing.quantity_required;
          const newTotalCost = ing.new_price * currentQty;
          await supabase
            .from("product_ingredients")
            .update({
              unit_price: ing.new_price,
              price: ing.new_price,
              total_cost: Math.round(newTotalCost * 100) / 100,
            })
            .eq("product_id", productId)
            .eq("ingredient_name", ing.ingredient_name)
            .eq("user_id", user.id);
        }
      }

      // Phase 4: cascade recalculation for any other products sharing these ingredients
      try {
        const changedNames = ingredients
          .filter((i) => i.old_price !== i.new_price)
          .map((i) => i.ingredient_name);
        if (changedNames.length > 0) {
          await cascadeRecalcForIngredients(user.id, changedNames, billId);
        }
      } catch (e) {
        console.error("Cascade recalc failed (non-fatal):", e);
      }

      return true;
    } catch (error) {
      console.error("Error saving cost revision:", error);
      return false;
    }
  };

  const fetchSellingPrice = async (productId: string): Promise<number> => {
    const { data, error } = await supabase
      .from("products")
      .select("selling_price")
      .eq("id", productId)
      .single();

    if (error || !data) return 0;
    return data.selling_price || 0;
  };

  return {
    fetchRecipeWithPrices,
    calculateRevision,
    saveRevision,
    fetchSellingPrice,
    isLoading,
  };
}
