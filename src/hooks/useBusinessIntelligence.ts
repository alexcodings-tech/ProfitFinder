import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { convertUnit, areUnitsCompatible, toBaseUnit } from "@/lib/unitConversion";
import { computeProductionCost, ProductionCostTemplate } from "@/lib/productionCost";

export interface ProductIntelligence {
  productId: string;
  productName: string;
  sellingPrice: number;
  ingredientCostPerUnit: number;
  overheadCostPerUnit: number;
  currentCost: number; // total per-unit cost (ingredients + overheads)
  currentProfit: number;
  currentMargin: number;
  // Baseline (previous distinct snapshot) for delta comparison
  previousCost: number;
  previousMargin: number;
  costDelta: number; // ₹ per unit (current - previous)
  marginDelta: number; // % change (current - previous), negative = margin dropped
  hasBaseline: boolean;
  // True when product is currently sold at a loss (cost > price)
  isAtLoss: boolean;
  lossPerUnit: number; // ₹ lost per unit when isAtLoss
  // Suggested price to restore previous margin OR reach a safe target
  suggestedPrice: number | null;
  suggestedPriceReason: "restore_previous" | "cover_loss" | null;
  // Production feasibility
  maxProducibleUnits: number;
  producibleBaseQty: number; // total kg/L producible from current ingredient stock
  producibleBaseUnit: string | null; // 'kg' | 'L' | null
  bottleneckIngredient: string | null;
  bottleneckShortage: { needed: number; available: number; unit: string } | null;
  // Estimated total loss based on stock-on-hand
  totalPotentialLoss: number;
  // Per-kg (or per-L) normalization based on default packaging variant
  perBaseUnit: string | null; // 'kg' | 'L' | null when not weight/volume
  packSizeInBase: number | null; // pack size converted to base unit
  currentCostPerBase: number | null;
  previousCostPerBase: number | null;
  suggestedPricePerBase: number | null;
  // Raw snapshot + batch output for "Cost / Unit = new_total_cost ÷ total_batch_quantity"
  snapshotNewTotalCost: number;
  batchOutputQty: number;
  batchOutputUnit: string | null;
  // AI Recommended Cost = total cost per batch output + 30% margin markup
  aiRecommendedCost: number;
  // Manufacturing cost per unit = ingredient update total / batch output qty
  manufacturingCost: number;
}

export interface BusinessIntelligenceData {
  products: ProductIntelligence[];
  totalEstimatedLoss: number;
  productsAtRisk: number;
}

// Target margin used when we have no sane baseline but need to recover from a loss
const FALLBACK_TARGET_MARGIN = 30;

export function useBusinessIntelligence() {
  const { user } = useAuth();
  const [data, setData] = useState<BusinessIntelligenceData>({
    products: [],
    totalEstimatedLoss: 0,
    productsAtRisk: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const run = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [productsRes, recipesRes, ingredientsRes, snapshotsRes, prodCostsRes, variantsRes, batchSizesRes] =
        await Promise.all([
          supabase.from("products").select("id, name, selling_price").eq("user_id", user.id),
          (supabase as any)
            .from("product_recipes")
            .select(
              "product_id, ingredient_name, quantity_required, unit, total_batch_quantity, batch_unit, planned_quantity, planned_unit",
            )
            .eq("user_id", user.id),
          supabase
            .from("product_ingredients")
            .select("product_id, ingredient_name, quantity, unit, price, total_cost")
            .eq("user_id", user.id),
          supabase
            .from("product_cost_snapshots")
            .select("product_id, old_total_cost, old_margin, new_total_cost, new_margin, selling_price, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          (supabase as any).from("product_production_costs").select("*").eq("user_id", user.id),
          (supabase as any)
            .from("product_packaging_variants")
            .select("product_id, pack_size, unit, is_default")
            .eq("user_id", user.id),
          (supabase as any).from("product_batch_sizes").select("product_id, batch_size, unit").eq("user_id", user.id),
        ]);

      const products = productsRes.data || [];
      const recipes = recipesRes.data || [];
      const ingredients = ingredientsRes.data || [];
      const snapshots = snapshotsRes.data || [];
      const prodCosts: any[] = prodCostsRes.data || [];
      const variants: any[] = variantsRes.data || [];
      const batchSizes: any[] = batchSizesRes.data || [];

      // User-defined batch size (kg/L per batch) per product
      const userBatchSizeByProduct = new Map<string, { qty: number; unit: string }>();
      for (const b of batchSizes) {
        const base = toBaseUnit(Number(b.batch_size) || 0, b.unit || "kg");
        if ((base.unit === "kg" || base.unit === "L") && base.quantity > 0) {
          userBatchSizeByProduct.set(b.product_id, { qty: base.quantity, unit: base.unit });
        }
      }

      // Per-kg ingredient cost from current inventory (mirrors Product Margin Changes table)
      const ingredientCostPerKgByProduct = new Map<string, number>();
      const ingredientsByProductLocal = new Map<string, any[]>();
      for (const ing of ingredients as any[]) {
        const list = ingredientsByProductLocal.get(ing.product_id) || [];
        list.push(ing);
        ingredientsByProductLocal.set(ing.product_id, list);
      }
      for (const [pid, list] of ingredientsByProductLocal) {
        let totalAmountSpent = 0;
        let totalWeightInKg = 0;
        for (const ing of list) {
          const quantity = Number(ing.quantity) || 0;
          const price = Number(ing.price) || 0;
          const unit = ing.unit || "kg";
          const base = toBaseUnit(quantity, unit);
          if (base.unit === "kg") {
            totalWeightInKg += base.quantity;
            totalAmountSpent += quantity * price;
          }
        }
        if (totalWeightInKg > 0) {
          ingredientCostPerKgByProduct.set(pid, totalAmountSpent / totalWeightInKg);
        }
      }

      // Mirrors Ingredient Cost Update exactly: product_ingredients quantity × current price.
      // Do not use shared inventory averages or product_recipes here, because the panel's
      // displayed total is based on the product's own ingredient rows.
      const ingredientUpdateTotalByProduct = new Map<string, number>();
      for (const [pid, list] of ingredientsByProductLocal) {
        const total = list.reduce((sum, ing) => {
          const quantity = Number(ing.quantity) || 0;
          const price = Number(ing.price) || 0;
          return sum + quantity * price;
        }, 0);
        ingredientUpdateTotalByProduct.set(pid, Math.round(total * 100) / 100);
      }

      const variantByProduct = new Map<string, any>();
      for (const v of variants) {
        const existing = variantByProduct.get(v.product_id);
        if (!existing || v.is_default) variantByProduct.set(v.product_id, v);
      }

      const prodCostByProduct = new Map<string, ProductionCostTemplate>();
      for (const p of prodCosts) prodCostByProduct.set(p.product_id, p);

      // Group snapshots per product (already ordered DESC by created_at)
      const snapshotsByProduct = new Map<string, any[]>();
      for (const s of snapshots as any[]) {
        const list = snapshotsByProduct.get(s.product_id) || [];
        list.push(s);
        snapshotsByProduct.set(s.product_id, list);
      }

      // ── Shared ingredient inventory map (across ALL products) ──
      // Aggregates by normalized ingredient name so e.g. "Sugar" in Cake and
      // "Sugar" in Cookies use one combined stock & weighted-avg unit price.
      const sharedInventory = new Map<
        string,
        { quantity: number; unit: string; totalCost: number; totalQty: number }
      >();
      for (const i of ingredients as any[]) {
        const key = (i.ingredient_name || "").trim().toLowerCase();
        if (!key) continue;
        const qty = Number(i.quantity) || 0;
        const price = Number(i.price) || 0;
        const unit = i.unit || "kg";
        const existing = sharedInventory.get(key);
        if (!existing) {
          sharedInventory.set(key, {
            quantity: qty,
            unit,
            totalCost: qty * price,
            totalQty: qty,
          });
        } else {
          // Sum only when units are compatible; otherwise keep the dominant entry
          if (existing.unit === unit) {
            existing.quantity += qty;
            existing.totalCost += qty * price;
            existing.totalQty += qty;
          } else if (areUnitsCompatible(existing.unit, unit)) {
            const converted = convertUnit(qty, unit, existing.unit) || 0;
            existing.quantity += converted;
            existing.totalCost += converted * price; // price approx per stock-unit
            existing.totalQty += converted;
          }
          // weighted-avg price across products will be derived on lookup
        }
      }
      const lookupInventory = (name: string) => {
        const key = (name || "").trim().toLowerCase();
        const inv = sharedInventory.get(key);
        if (!inv) return null;
        const avgPrice = inv.totalQty > 0 ? inv.totalCost / inv.totalQty : 0;
        return { quantity: inv.quantity, unit: inv.unit, price: avgPrice };
      };

      const productIntelligence: ProductIntelligence[] = [];
      let totalLoss = 0;
      let atRisk = 0;

      for (const product of products) {
        const productRecipes = recipes.filter((r: any) => r.product_id === product.id);
        const sellingPrice = Number(product.selling_price) || 0;

        // Product with no recipe yet: still surface it so AI Recommendations lists every product.
        if (productRecipes.length === 0) {
          const ingredientUpdateTotal = ingredientUpdateTotalByProduct.get(product.id) || 0;
          productIntelligence.push({
            productId: product.id,
            productName: product.name,
            sellingPrice,
            ingredientCostPerUnit: 0,
            overheadCostPerUnit: 0,
            currentCost: 0,
            currentProfit: sellingPrice,
            currentMargin: sellingPrice > 0 ? 100 : 0,
            previousCost: 0,
            previousMargin: 0,
            costDelta: 0,
            marginDelta: 0,
            hasBaseline: false,
            isAtLoss: false,
            lossPerUnit: 0,
            suggestedPrice: null,
            suggestedPriceReason: null,
            maxProducibleUnits: 0,
            producibleBaseQty: 0,
            producibleBaseUnit: null,
            bottleneckIngredient: "No recipe set",
            bottleneckShortage: null,
            totalPotentialLoss: 0,
            perBaseUnit: null,
            packSizeInBase: null,
            currentCostPerBase: null,
            previousCostPerBase: null,
            suggestedPricePerBase: null,
            snapshotNewTotalCost: 0,
            batchOutputQty: 0,
            batchOutputUnit: null,
            aiRecommendedCost: Math.round(ingredientUpdateTotal * 1.3 * 100) / 100,
            manufacturingCost: ingredientUpdateTotal,
          });
          continue;
        }

        let currentCost = 0;
        let totalRecipeQuantityInBase = 0;
        let recipeBaseUnit: string | null = null;
        let totalIngredientSpend = 0;
        let canCompute = true;
        let maxUnits = Infinity;
        let bottleneck: string | null = null;
        let bottleneckInfo: ProductIntelligence["bottleneckShortage"] = null;

        for (const recipe of productRecipes) {
          // ✨ Shared inventory lookup (by name, across all products) — used for COST only
          const ing = lookupInventory(recipe.ingredient_name);
          if (!ing) {
            canCompute = false;
            maxUnits = 0;
            bottleneck = recipe.ingredient_name;
            bottleneckInfo = { needed: Number(recipe.quantity_required), available: 0, unit: recipe.unit };
            break;
          }

          const recipeUnit = recipe.unit || "kg";
          const stockUnit = ing.unit || "kg";
          const recipeBase = toBaseUnit(Number(recipe.quantity_required) || 0, recipeUnit);
          if (recipeBase.unit === "kg" || recipeBase.unit === "L") {
            if (!recipeBaseUnit) recipeBaseUnit = recipeBase.unit;
            if (recipeBaseUnit === recipeBase.unit) totalRecipeQuantityInBase += recipeBase.quantity;
          }
          // Spend estimate from shared inventory (avg cost × qty)
          totalIngredientSpend += (Number(recipe.quantity_required) || 0) * (ing.price || 0);
          let neededInStockUnit = Number(recipe.quantity_required);

          if (recipeUnit !== stockUnit) {
            if (!areUnitsCompatible(recipeUnit, stockUnit)) {
              canCompute = false;
              break;
            }
            const converted = convertUnit(neededInStockUnit, recipeUnit, stockUnit);
            if (converted === null) {
              canCompute = false;
              break;
            }
            neededInStockUnit = converted;
          }

          currentCost += neededInStockUnit * (Number(ing.price) || 0);

          // Producible capacity comes from the PRODUCTION PLAN quantity on the
          // recipe row (NOT from inventory stock). If no plan qty set, treat
          // this ingredient as not limiting (skip from min).
          const plannedQtyRaw = (recipe as any).planned_quantity;
          const plannedUnit = (recipe as any).planned_unit || recipeUnit;
          if (plannedQtyRaw != null && Number(plannedQtyRaw) > 0) {
            let plannedInRecipeUnit = Number(plannedQtyRaw);
            if (plannedUnit !== recipeUnit) {
              const conv = convertUnit(plannedInRecipeUnit, plannedUnit, recipeUnit);
              if (conv !== null) plannedInRecipeUnit = conv;
            }
            const perUnit = Number(recipe.quantity_required) || 0;
            const producible = perUnit > 0 ? Math.floor(plannedInRecipeUnit / perUnit) : Infinity;
            if (producible < maxUnits) {
              maxUnits = producible;
              bottleneck = recipe.ingredient_name;
              bottleneckInfo = { needed: perUnit, available: plannedInRecipeUnit, unit: recipeUnit };
            }
          }
        }

        // If no ingredient had a planned quantity, producible capacity is 0.
        if (!Number.isFinite(maxUnits)) {
          maxUnits = 0;
        }

        if (!canCompute) {
          // Still surface the product so the user sees it & the missing ingredient.
          productIntelligence.push({
            productId: product.id,
            productName: product.name,
            sellingPrice,
            ingredientCostPerUnit: 0,
            overheadCostPerUnit: 0,
            currentCost: 0,
            currentProfit: sellingPrice,
            currentMargin: sellingPrice > 0 ? 100 : 0,
            previousCost: 0,
            previousMargin: 0,
            costDelta: 0,
            marginDelta: 0,
            hasBaseline: false,
            isAtLoss: false,
            lossPerUnit: 0,
            suggestedPrice: null,
            suggestedPriceReason: null,
            maxProducibleUnits: 0,
            producibleBaseQty: 0,
            producibleBaseUnit: null,
            bottleneckIngredient: bottleneck,
            bottleneckShortage: bottleneckInfo,
            totalPotentialLoss: 0,
            perBaseUnit: null,
            packSizeInBase: null,
            currentCostPerBase: null,
            previousCostPerBase: null,
            suggestedPricePerBase: null,
            snapshotNewTotalCost: 0,
            batchOutputQty: 0,
            batchOutputUnit: null,
            aiRecommendedCost: 0,
            manufacturingCost: 0,
          });
          continue;
        }

        // Prefer latest snapshot's new_total_cost (matches Product Margin Changes table)
        const latestSnapshot = (snapshotsByProduct.get(product.id) || []).find(
          (s: any) => Number(s.new_total_cost) > 0,
        );
        const snapshotNewCost = latestSnapshot ? Number(latestSnapshot.new_total_cost) : 0;

        if (snapshotNewCost > 0 && recipeBaseUnit && totalRecipeQuantityInBase > 0) {
          // Per-base unit cost from snapshot ÷ aggregated recipe quantity
          currentCost = snapshotNewCost / totalRecipeQuantityInBase;
        } else if (recipeBaseUnit && totalRecipeQuantityInBase > 0 && totalIngredientSpend > 0) {
          currentCost = totalIngredientSpend / totalRecipeQuantityInBase;
        }

        const usedSnapshotPerBase = snapshotNewCost > 0 && !!recipeBaseUnit && totalRecipeQuantityInBase > 0;

        const ingredientCostPerUnit = Math.round(currentCost * 100) / 100;
        const tpl = prodCostByProduct.get(product.id) || null;
        const batchSize = tpl?.default_batch_size || 1;
        let overheadCostPerUnit = 0;
        if (!usedSnapshotPerBase) {
          const computed = computeProductionCost(ingredientCostPerUnit, tpl, batchSize);
          currentCost = computed.totalCostPerUnit;
          overheadCostPerUnit = computed.overheadCostPerUnit;
        }

        // ── Determine batch base quantity for per-kg/L normalization ──
        const recipeBatchQty = Number(productRecipes[0]?.total_batch_quantity) || 0;
        const recipeBatchUnit = productRecipes[0]?.batch_unit || null;
        const variantEarly = variantByProduct.get(product.id);
        let baseQty = totalRecipeQuantityInBase > 0 ? totalRecipeQuantityInBase : 0;
        let baseUnit: string | null = recipeBaseUnit;
        if (!baseUnit && recipeBatchQty > 0 && recipeBatchUnit) {
          const rb = toBaseUnit(recipeBatchQty, recipeBatchUnit);
          if (rb.unit === "kg" || rb.unit === "L") {
            baseQty = rb.quantity;
            baseUnit = rb.unit;
          }
        }
        if (!baseUnit && variantEarly && Number(variantEarly.pack_size) > 0) {
          const base = toBaseUnit(Number(variantEarly.pack_size), variantEarly.unit || "kg");
          if (base.unit === "kg" || base.unit === "L") {
            baseQty = base.quantity;
            baseUnit = base.unit;
          }
        }

        // If recipe spend was not already normalized, convert batch/pack cost to base unit.
        if (
          baseUnit &&
          baseQty > 0 &&
          !usedSnapshotPerBase &&
          !(recipeBaseUnit && totalRecipeQuantityInBase > 0 && totalIngredientSpend > 0)
        ) {
          currentCost = Math.round((currentCost / baseQty) * 100) / 100;
        }

        let currentProfit = Math.round((sellingPrice - currentCost) * 100) / 100;
        let currentMargin = sellingPrice > 0 ? Math.round((currentProfit / sellingPrice) * 1000) / 10 : 0;

        // ── Baseline detection (FIX) ──
        // Walk snapshots from newest → oldest. Pick the first one whose
        // new_total_cost meaningfully DIFFERS from the current computed cost
        // AND has sane margin/price values. That snapshot represents the
        // "previous stable state" we are comparing against.
        let previousCost = currentCost;
        let previousMargin = currentMargin;
        let hasBaseline = false;
        const candidates = snapshotsByProduct.get(product.id) || [];
        for (const s of candidates) {
          const sp = Number(s.selling_price) || 0;
          const nc = Number(s.new_total_cost);
          const nm = Number(s.new_margin);
          if (!(sp > 0 && nc > 0 && nm > -100 && nm <= 100)) continue;
          if (Math.abs(nc - currentCost) < 0.01) continue; // same cost → not a real "previous"
          previousCost = nc;
          previousMargin = nm;
          hasBaseline = true;
          break;
        }

        const costDelta = Math.round((currentCost - previousCost) * 100) / 100;
        let marginDelta = Math.round((currentMargin - previousMargin) * 10) / 10;

        // ── Loss detection (HARD RULE) ──
        let isAtLoss = sellingPrice > 0 && currentCost > sellingPrice;
        let lossPerUnit = isAtLoss ? Math.round((currentCost - sellingPrice) * 100) / 100 : 0;

        // ── Suggested price ──
        // Based on SELLING PRICE + cost increase (delta from baseline).
        // If costs rise, suggested price rises proportionally from selling price,
        // even if the product is currently profitable.
        let suggestedPrice: number | null = null;
        let suggestedPriceReason: ProductIntelligence["suggestedPriceReason"] = null;
        {
          if (sellingPrice > 0 && hasBaseline && costDelta > 0) {
            suggestedPrice = Math.ceil(sellingPrice + costDelta);
            suggestedPriceReason = isAtLoss ? "cover_loss" : "restore_previous";
          } else if (isAtLoss && sellingPrice > 0) {
            // At loss with no baseline: suggest enough to cover cost + small margin
            suggestedPrice = Math.ceil(currentCost * 1.05);
            suggestedPriceReason = "cover_loss";
          }
        }

        // ── Total potential loss on stock ──
        let totalPotentialLoss = 0;
        if (Number.isFinite(maxUnits)) {
          if (isAtLoss) {
            // Every unit produced loses lossPerUnit
            totalPotentialLoss = Math.round(lossPerUnit * maxUnits * 100) / 100;
          } else if (marginDelta < -0.5 && costDelta > 0) {
            totalPotentialLoss = Math.round(costDelta * maxUnits * 100) / 100;
          }
        }

        const productAtRisk = isAtLoss || marginDelta < -0.5;
        if (productAtRisk) atRisk++;
        totalLoss += totalPotentialLoss;

        // ── Per-base-unit (per kg/L) normalization ──
        // Costs/prices are now already per base unit if baseUnit was detected.
        let perBaseUnit: string | null = baseUnit;
        let packSizeInBase: number | null = baseUnit ? baseQty : null;
        let currentCostPerBase: number | null = baseUnit ? currentCost : null;
        let previousCostPerBase: number | null = baseUnit ? previousCost : null;
        let suggestedPricePerBase: number | null = baseUnit && suggestedPrice !== null ? suggestedPrice : null;

        // ── Match Product Margin Changes table: per-kg ingredient cost from current inventory
        //    PLUS add production overheads so AI Recommendations reflects true per-kg cost.
        const invPerKg = ingredientCostPerKgByProduct.get(product.id);
        if (invPerKg && invPerKg > 0 && (perBaseUnit === "kg" || !perBaseUnit)) {
          perBaseUnit = "kg";
          // Match Production page: amortize per-batch overheads over the template's
          // default batch size (or 1) so AI Recommendations cost matches the
          // "True cost / kg" shown on Production & Costing.
          const sizeForKg = Math.max(Number(tpl?.default_batch_size) || 1, 1);
          const computedPerKg = computeProductionCost(invPerKg, tpl, sizeForKg, { sellingPrice });
          currentCostPerBase = Math.round(computedPerKg.totalCostPerUnit * 100) / 100;

          // Recompute loss against the per-kg cost actually shown (matches Production page).
          if (sellingPrice > 0 && currentCostPerBase > sellingPrice) {
            isAtLoss = true;
            lossPerUnit = Math.round((currentCostPerBase - sellingPrice) * 100) / 100;
          } else {
            isAtLoss = false;
            lossPerUnit = 0;
          }
          // Recompute total potential loss on stock with the updated per-kg loss.
          totalLoss -= totalPotentialLoss;
          totalPotentialLoss = 0;
          if (Number.isFinite(maxUnits) && isAtLoss) {
            totalPotentialLoss = Math.round(lossPerUnit * maxUnits * 100) / 100;
          }
          totalLoss += totalPotentialLoss;

          // Recompute margin using the per-kg cost actually shown so the margin
          // strip matches the Product Margin Changes table.
          if (sellingPrice > 0 && currentCostPerBase !== null) {
            currentProfit = Math.round((sellingPrice - currentCostPerBase) * 100) / 100;
            currentMargin = Math.round((currentProfit / sellingPrice) * 1000) / 10;
            if (hasBaseline) {
              marginDelta = Math.round((currentMargin - previousMargin) * 10) / 10;
            }
          }
        }

        // ── User-defined batch size overrides producible units (Dashboard Production Capacity) ──
        let producibleBatches = Number.isFinite(maxUnits) ? maxUnits : 0;
        const userBatch = userBatchSizeByProduct.get(product.id);
        if (userBatch && userBatch.qty > 0 && baseQty > 0 && baseUnit === userBatch.unit) {
          const totalProducibleBase = (Number.isFinite(maxUnits) ? maxUnits : 0) * baseQty;
          producibleBatches = Math.floor(totalProducibleBase / userBatch.qty);
        }

        // ── Recompute suggestedPrice off the combined per-kg cost when available ──
        // Use cost delta (per-base) added to selling price so suggestion scales
        // with cost increases regardless of profitability.
        let suggestedPriceFinal: number | null = suggestedPrice;
        if (
          sellingPrice > 0 &&
          currentCostPerBase !== null &&
          previousCostPerBase !== null &&
          currentCostPerBase > previousCostPerBase
        ) {
          const perBaseDelta = currentCostPerBase - previousCostPerBase;
          suggestedPriceFinal = Math.ceil(sellingPrice + perBaseDelta);
          suggestedPricePerBase = suggestedPriceFinal;
        } else if (suggestedPriceFinal !== null) {
          suggestedPricePerBase = suggestedPriceFinal;
        }

        // ── AI Recommended Cost: Ingredient Cost Update Cost / Unit + 30% margin markup ──
        // Uses the exact live total from Ingredient Cost Update (product_ingredients
        // quantity × current price), divides by the panel's total batch output, then adds 30% markup.
        const ingredientUpdateTotal =
          ingredientUpdateTotalByProduct.get(product.id) || (snapshotNewCost > 0 ? snapshotNewCost : 0);
        const ingredientUpdateCostPerUnit = ingredientUpdateTotal / (recipeBatchQty > 0 ? recipeBatchQty : 1);
        const aiRecommendedCost = Math.round(ingredientUpdateCostPerUnit * 1.3 * 100) / 100;

        productIntelligence.push({
          productId: product.id,
          productName: product.name,
          sellingPrice,
          ingredientCostPerUnit,
          overheadCostPerUnit,
          currentCost,
          currentProfit,
          currentMargin,
          previousCost,
          previousMargin,
          costDelta,
          marginDelta,
          hasBaseline,
          isAtLoss,
          lossPerUnit,
          suggestedPrice: suggestedPriceFinal ?? suggestedPrice,
          suggestedPriceReason,
          maxProducibleUnits: producibleBatches,
          producibleBaseQty:
            baseUnit && baseQty > 0 && Number.isFinite(maxUnits)
              ? Math.round((maxUnits as number) * baseQty * 1000) / 1000
              : 0,
          producibleBaseUnit: baseUnit,
          bottleneckIngredient: bottleneck,
          bottleneckShortage: bottleneckInfo,
          totalPotentialLoss,
          perBaseUnit,
          packSizeInBase,
          currentCostPerBase,
          previousCostPerBase,
          suggestedPricePerBase,
          snapshotNewTotalCost: snapshotNewCost,
          batchOutputQty: recipeBatchQty,
          batchOutputUnit: recipeBatchUnit,
          aiRecommendedCost,
          manufacturingCost: Math.round(ingredientUpdateCostPerUnit * 100) / 100,
        });
      }

      // Sort: losses first, then biggest margin drop, then most loss ₹
      productIntelligence.sort(
        (a, b) =>
          Number(b.isAtLoss) - Number(a.isAtLoss) ||
          a.marginDelta - b.marginDelta ||
          b.totalPotentialLoss - a.totalPotentialLoss ||
          a.currentMargin - b.currentMargin,
      );

      setData({
        products: productIntelligence,
        totalEstimatedLoss: Math.round(totalLoss * 100) / 100,
        productsAtRisk: atRisk,
      });
    } catch (e) {
      console.error("useBusinessIntelligence error", e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // useEffect(() => {
  //   run();

  //   if (!user) return;

  //   // Real-time sync: refetch on any change to inputs that affect cost/margin/production
  //   const channel = supabase
  //     .channel("bi-sync")
  //     .on("postgres_changes", { event: "*", schema: "public", table: "product_ingredients" }, () => run())
  //     .on("postgres_changes", { event: "*", schema: "public", table: "product_recipes" }, () => run())
  //     .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => run())
  //     .on("postgres_changes", { event: "*", schema: "public", table: "product_cost_snapshots" }, () => run())
  //     .on("postgres_changes", { event: "*", schema: "public", table: "product_production_costs" }, () => run())
  //     .on("postgres_changes", { event: "*", schema: "public", table: "batches" }, () => run())
  //     .on("postgres_changes", { event: "*", schema: "public", table: "product_batch_sizes" }, () => run())

  //     .subscribe();

  //   return () => {
  //     supabase.removeChannel(channel);
  //   };
  // }, [user, run]);

  useEffect(() => {
    run();

    if (!user) return;

    let mounted = true;

    // Create a unique channel name to avoid conflicts when this hook is used in multiple components
    const channelName = `bi-sync-${user.id}-${Math.random().toString(36).substr(2, 9)}`;

    // Real-time sync: refetch on any change to inputs that affect cost/margin/production
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_ingredients" }, () => mounted && run())
      .on("postgres_changes", { event: "*", schema: "public", table: "product_recipes" }, () => mounted && run())
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => mounted && run())
      .on("postgres_changes", { event: "*", schema: "public", table: "product_cost_snapshots" }, () => mounted && run())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_production_costs" },
        () => mounted && run(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "batches" }, () => mounted && run())
      .on("postgres_changes", { event: "*", schema: "public", table: "product_batch_sizes" }, () => mounted && run())
      .subscribe((status, err) => {
        if (err) {
          console.error("Realtime subscription error in useBusinessIntelligence:", err);
        }
      });

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user, run]);

  return { data, isLoading, refetch: run };
}
