import { supabase } from "@/integrations/supabase/client";
import { convertUnit, areUnitsCompatible, toBaseUnit } from "@/lib/unitConversion";
import { computeProductionCost, ProductionCostTemplate } from "@/lib/productionCost";

/**
 * Recalculate cost / profit / margin snapshots for every product whose recipe
 * contains any of the given ingredient names. Creates a product_cost_snapshots
 * row per affected product so the Profit Root Cause dashboard and Analytics
 * costing tab reflect the change instantly.
 */
export async function cascadeRecalcForIngredients(
  userId: string,
  ingredientNames: string[],
  billId: string | null = null
): Promise<{ updatedProducts: number }> {
  if (!userId || ingredientNames.length === 0) return { updatedProducts: 0 };

  const normalized = Array.from(
    new Set(ingredientNames.map((n) => n.trim().toLowerCase()).filter(Boolean))
  );
  if (normalized.length === 0) return { updatedProducts: 0 };

  // Find all recipes that include any of these ingredients
  const { data: recipes, error: recipesError } = await supabase
    .from("product_recipes")
    .select("product_id, ingredient_name, quantity_required, unit, total_batch_quantity, batch_unit")
    .eq("user_id", userId);

  if (recipesError || !recipes) {
    console.error("cascadeRecalc: recipes fetch failed", recipesError);
    return { updatedProducts: 0 };
  }

  const productIdsToUpdate = Array.from(
    new Set(
      recipes
        .filter((r) => normalized.includes(r.ingredient_name.trim().toLowerCase()))
        .map((r) => r.product_id)
    )
  );

  if (productIdsToUpdate.length === 0) return { updatedProducts: 0 };

  // Fetch products (selling price)
  const { data: products } = await supabase
    .from("products")
    .select("id, name, selling_price")
    .in("id", productIdsToUpdate);

  // Fetch all product_ingredients for those products (current prices)
  const { data: ingredients } = await supabase
    .from("product_ingredients")
    .select("product_id, ingredient_name, quantity, price, unit")
    .eq("user_id", userId);

  // Fetch production cost templates so snapshots include overheads
  const { data: prodCosts } = await (supabase as any)
    .from("product_production_costs")
    .select("*")
    .in("product_id", productIdsToUpdate);
  const prodCostByProduct = new Map<string, ProductionCostTemplate>();
  (prodCosts || []).forEach((p: any) => prodCostByProduct.set(p.product_id, p));

  // Fetch latest snapshot per product (for "old_*" baseline)
  const { data: existingSnapshots } = await supabase
    .from("product_cost_snapshots")
    .select("product_id, new_total_cost, new_profit, new_margin, created_at")
    .eq("user_id", userId)
    .in("product_id", productIdsToUpdate)
    .order("created_at", { ascending: false });

  const latestByProduct = new Map<string, any>();
  (existingSnapshots || []).forEach((s) => {
    if (!latestByProduct.has(s.product_id)) latestByProduct.set(s.product_id, s);
  });

  const sharedIngredients = new Map<string, { quantity: number; unit: string; totalCost: number; totalQty: number }>();
  (ingredients || []).forEach((i: any) => {
    const key = (i.ingredient_name || "").trim().toLowerCase();
    if (!key) return;
    const qty = Number(i.quantity) || 0;
    const unit = i.unit || "kg";
    const price = Number(i.price) || 0;
    const existing = sharedIngredients.get(key);
    if (!existing) sharedIngredients.set(key, { quantity: qty, unit, totalCost: qty * price, totalQty: qty });
    else if (existing.unit === unit) {
      existing.quantity += qty;
      existing.totalCost += qty * price;
      existing.totalQty += qty;
    } else if (areUnitsCompatible(existing.unit, unit)) {
      const converted = convertUnit(qty, unit, existing.unit) || 0;
      existing.quantity += converted;
      existing.totalCost += converted * price;
      existing.totalQty += converted;
    }
  });
  let updatedProducts = 0;

  for (const product of products || []) {
    const productRecipes = (recipes || []).filter((r) => r.product_id === product.id);
    if (productRecipes.length === 0) continue;

    let recipeSpend = 0;
    let canCompute = true;
    const first = productRecipes[0] as any;
    let batchQty = 0;
    const savedBatch = toBaseUnit(Number(first?.total_batch_quantity) || 0, first?.batch_unit || "kg");
    if (savedBatch.quantity > 0 && (savedBatch.unit === "kg" || savedBatch.unit === "L")) batchQty = savedBatch.quantity;
    if (batchQty <= 0) {
      batchQty = productRecipes.reduce((sum: number, r: any) => {
        const b = toBaseUnit(Number(r.quantity_required) || 0, r.unit || "kg");
        return b.unit === "kg" || b.unit === "L" ? sum + b.quantity : sum;
      }, 0);
    }

    for (const recipe of productRecipes) {
      const ing = sharedIngredients.get(recipe.ingredient_name.trim().toLowerCase());
      if (!ing || ing.totalQty <= 0) {
        canCompute = false;
        break;
      }
      const recipeUnit = recipe.unit || "kg";
      const stockUnit = ing.unit || "kg";
      let qtyInStockUnit = Number(recipe.quantity_required);
      if (recipeUnit !== stockUnit) {
        if (!areUnitsCompatible(recipeUnit, stockUnit)) {
          canCompute = false;
          break;
        }
        const converted = convertUnit(qtyInStockUnit, recipeUnit, stockUnit);
        if (converted === null) {
          canCompute = false;
          break;
        }
        qtyInStockUnit = converted;
      }
      const avgPrice = ing.totalCost / ing.totalQty;
      recipeSpend += qtyInStockUnit * avgPrice;
    }

    if (!canCompute || batchQty <= 0) continue;

    const ingPerUnit = Math.round((recipeSpend / batchQty) * 100) / 100;
    const tpl = prodCostByProduct.get(product.id) || null;
    const computed = computeProductionCost(ingPerUnit, tpl, tpl?.default_batch_size || 1);
    const newTotalCost = computed.totalCostPerUnit;

    const sellingPrice = Number(product.selling_price) || 0;
    const newProfit = Math.round((sellingPrice - newTotalCost) * 100) / 100;
    const newMargin =
      sellingPrice > 0 ? Math.round(((newProfit / sellingPrice) * 100) * 10) / 10 : 0;

    const prev = latestByProduct.get(product.id);
    const oldTotalCost = prev ? Number(prev.new_total_cost) : newTotalCost;
    const oldProfit = prev ? Number(prev.new_profit) : newProfit;
    const oldMargin = prev ? Number(prev.new_margin) : newMargin;

    // Skip if nothing actually changed
    if (
      prev &&
      Math.abs(oldTotalCost - newTotalCost) < 0.01 &&
      Math.abs(oldMargin - newMargin) < 0.05
    ) {
      continue;
    }

    const recommendedPrice = Math.round((sellingPrice + (newTotalCost - oldTotalCost)) * 100) / 100;

    const { error: snapErr } = await supabase.from("product_cost_snapshots").insert({
      user_id: userId,
      product_id: product.id,
      bill_id: billId,
      selling_price: sellingPrice,
      old_total_cost: oldTotalCost,
      new_total_cost: newTotalCost,
      old_profit: oldProfit,
      new_profit: newProfit,
      old_margin: oldMargin,
      new_margin: newMargin,
      recommended_price: recommendedPrice,
    } as any);

    if (!snapErr) updatedProducts++;
    else console.error("cascadeRecalc: snapshot insert failed", snapErr);
  }

  return { updatedProducts };
}
