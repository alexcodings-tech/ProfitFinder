import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toBaseUnit } from "@/lib/unitConversion";

export interface MarginChange {
  productName: string;
  productId: string;
  oldMargin: number;
  newMargin: number;
  marginDelta: number;
  oldCost: number;
  newCost: number;
  sellingPrice: number;
  oldProfit: number;
  newProfit: number;
  perBaseUnit: string | null;
  packSizeInBase: number | null;
  oldCostPerBase: number | null;
  newCostPerBase: number | null;
  sellingPricePerBase: number | null;
  recommendedPrice: number; // total per pack/batch
  recommendedPricePerBase: number | null; // per kg / L
  hasBaseline: boolean;
}

export interface IngredientImpact {
  ingredientName: string;
  oldPrice: number;
  newPrice: number;
  pctIncrease: number;
  impactedProducts: string[];
}

export interface ProfitInsight {
  type: "margin_drop" | "cost_spike" | "action";
  severity: "critical" | "warning" | "info";
  message: string;
  detail?: string;
}

export interface ProfitInsightsData {
  marginChanges: MarginChange[];
  ingredientImpacts: IngredientImpact[];
  insights: ProfitInsight[];
  overallMarginTrend: "up" | "down" | "stable";
  totalProductsAtRisk: number;
}

export function useProfitInsights() {
  const { user } = useAuth();
  const [data, setData] = useState<ProfitInsightsData>({
    marginChanges: [],
    ingredientImpacts: [],
    insights: [],
    overallMarginTrend: "stable",
    totalProductsAtRisk: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetch = async () => {
      setIsLoading(true);
      try {
        // Fetch latest cost snapshots per product
        const { data: snapshots } = await supabase
          .from("product_cost_snapshots")
          .select("*, products!inner(name)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        // Fetch current product ingredients for proper cost per kg calculation
        const { data: ingredients } = await supabase
          .from("product_ingredients")
          .select("product_id, ingredient_name, quantity, unit, price, total_cost")
          .eq("user_id", user.id);

        // Calculate proper cost per kg from ingredient inventory
        const ingredientCostPerKgByProduct = new Map<string, number>();
        const ingredientTotalCostByProduct = new Map<string, number>();
        const ingredientsByProduct = new Map<string, any[]>();

        for (const ing of ingredients || []) {
          const productIngredients = ingredientsByProduct.get(ing.product_id) || [];
          productIngredients.push(ing);
          ingredientsByProduct.set(ing.product_id, productIngredients);
        }

        // Calculate cost per kg for each product based on actual ingredient purchases
        for (const [productId, productIngredients] of ingredientsByProduct) {
          let totalAmountSpent = 0;
          let totalWeightInKg = 0;

          for (const ing of productIngredients) {
            const quantity = Number(ing.quantity) || 0;
            const price = Number(ing.price) || 0;
            const unit = ing.unit || "kg";

            totalAmountSpent += quantity * price;

            const base = toBaseUnit(quantity, unit);
            if (base.unit === "kg") {
              totalWeightInKg += base.quantity;
            }
          }

          ingredientTotalCostByProduct.set(productId, totalAmountSpent);
          if (totalWeightInKg > 0) {
            const costPerKg = totalAmountSpent / totalWeightInKg;
            ingredientCostPerKgByProduct.set(productId, costPerKg);
          }
        }
        // Fetch ingredient cost history
        const { data: costHistory } = await supabase
          .from("ingredient_cost_history")
          .select("*, products!inner(name)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        // Fetch current product selling prices (live, not snapshot)
        const { data: productsList } = await supabase
          .from("products")
          .select("id, selling_price")
          .eq("user_id", user.id);
        const sellingPriceByProduct = new Map<string, number>();
        for (const p of productsList || []) {
          sellingPriceByProduct.set(p.id, Number(p.selling_price) || 0);
        }

        // Fetch packaging variants for per-base-unit normalization
        const { data: variants } = await (supabase as any)
          .from("product_packaging_variants")
          .select("product_id, pack_size, unit, is_default")
          .eq("user_id", user.id);

        const variantByProduct = new Map<string, any>();
        for (const v of variants || []) {
          const existing = variantByProduct.get(v.product_id);
          if (!existing || v.is_default) variantByProduct.set(v.product_id, v);
        }

        // Fetch recipes for per-kg normalization (preferred over packaging variant)
        const { data: recipes } = await supabase
          .from("product_recipes")
          .select("product_id, quantity_required, unit, total_batch_quantity, batch_unit")
          .eq("user_id", user.id);

        // Aggregate recipe quantity per product (in base units kg/L)
        const recipeBaseQtyByProduct = new Map<string, { qty: number; unit: string }>();
        for (const r of recipes || []) {
          const b = toBaseUnit(Number(r.quantity_required) || 0, r.unit || "kg");
          if (b.unit !== "kg" && b.unit !== "L") continue;
          const existing = recipeBaseQtyByProduct.get(r.product_id);
          if (!existing) {
            recipeBaseQtyByProduct.set(r.product_id, { qty: b.quantity, unit: b.unit });
          } else if (existing.unit === b.unit) {
            existing.qty += b.quantity;
          }
        }

        // Also capture explicit batch yields (preferred when present)
        const batchYieldByProduct = new Map<string, { qty: number; unit: string }>();
        for (const r of recipes || []) {
          const tbq = Number(r.total_batch_quantity) || 0;
          if (tbq <= 0) continue;
          const b = toBaseUnit(tbq, r.batch_unit || "kg");
          if (b.unit !== "kg" && b.unit !== "L") continue;
          if (!batchYieldByProduct.has(r.product_id)) {
            batchYieldByProduct.set(r.product_id, { qty: b.quantity, unit: b.unit });
          }
        }

        // Dedupe snapshots: latest per product
        const latestByProduct = new Map<string, any>();
        const snapshotsByProduct = new Map<string, any[]>();
        (snapshots || []).forEach((s: any) => {
          if (!latestByProduct.has(s.product_id)) {
            latestByProduct.set(s.product_id, s);
          }
          const list = snapshotsByProduct.get(s.product_id) || [];
          list.push(s);
          snapshotsByProduct.set(s.product_id, list);
        });

        // Build margin changes
        const marginChanges: MarginChange[] = Array.from(latestByProduct.values())
          .map((s: any) => {
            const variant = variantByProduct.get(s.product_id);
            let perBaseUnit: string | null = null;
            let packSizeInBase: number | null = null;
            let oldCostPerBase: number | null = null;
            let newCostPerBase: number | null = null;
            let sellingPricePerBase: number | null = null;
            let recommendedPricePerBase: number | null = null;

            const recipeAgg = recipeBaseQtyByProduct.get(s.product_id);
            const batchYield = batchYieldByProduct.get(s.product_id);
            const yieldInfo = batchYield ?? recipeAgg;

            const currentSellingPrice = sellingPriceByProduct.get(s.product_id) ?? Number(s.selling_price);

            // Recommended rate is based on live selling price: preserve the
            // current ₹ profit by adding the cost movement to Selling/kg.
            const newCostNum = Number(s.new_total_cost) || 0;
            const oldCostNum = Number(s.old_total_cost) || 0;
            let recommendedPrice = Math.round((currentSellingPrice + (newCostNum - oldCostNum)) * 100) / 100;

            if (yieldInfo && yieldInfo.qty > 0) {
              perBaseUnit = yieldInfo.unit;
              packSizeInBase = yieldInfo.qty;
              // Cost/Unit = product ingredient total cost / total batch output
              const totalIngredientCost = ingredientTotalCostByProduct.get(s.product_id) || 0;
              const currentCostPerKg = yieldInfo.qty > 0 ? totalIngredientCost / yieldInfo.qty : 0;
              const oldCostPerKg = currentCostPerKg;

              oldCostPerBase = Math.round(oldCostPerKg * 100) / 100;
              newCostPerBase = Math.round(currentCostPerKg * 100) / 100;
              sellingPricePerBase = Math.round(currentSellingPrice * 100) / 100;
              const snapshotCostChange = (newCostNum - oldCostNum) / yieldInfo.qty;
              recommendedPricePerBase = Math.round((sellingPricePerBase + snapshotCostChange) * 100) / 100;
              recommendedPrice = Math.round(recommendedPricePerBase * yieldInfo.qty * 100) / 100;
            } else if (variant && Number(variant.pack_size) > 0) {
              const base = toBaseUnit(Number(variant.pack_size), variant.unit || "kg");
              if (base.unit === "kg" || base.unit === "L") {
                perBaseUnit = base.unit;
                packSizeInBase = base.quantity;
                // Cost/Unit = product ingredient total cost / batch output (pack size)
                const totalIngredientCost = ingredientTotalCostByProduct.get(s.product_id) || 0;
                const currentCostPerKg = base.quantity > 0 ? totalIngredientCost / base.quantity : 0;
                const oldCostPerKg = currentCostPerKg;

                if (packSizeInBase > 0) {
                  oldCostPerBase = Math.round(oldCostPerKg * 100) / 100;
                  newCostPerBase = Math.round(currentCostPerKg * 100) / 100;
                  sellingPricePerBase = Math.round((currentSellingPrice / packSizeInBase) * 100) / 100;
                  const snapshotCostChange = (newCostNum - oldCostNum) / packSizeInBase;
                  recommendedPricePerBase = Math.round((sellingPricePerBase + snapshotCostChange) * 100) / 100;
                  recommendedPrice = Math.round(recommendedPricePerBase * packSizeInBase * 100) / 100;
                }
              }
            }

            // Determine a meaningful baseline: the most recent snapshot whose
            // cost differs from the current computed cost and has a sane margin.
            const candidates = snapshotsByProduct.get(s.product_id) || [];
            const currentCostForCompare = newCostPerBase ?? newCostNum;
            let previousMargin = Number(s.old_margin) || 0;
            let hasBaseline = false;
            for (const snap of candidates) {
              const sp = Number(snap.selling_price) || 0;
              const nc = Number(snap.new_total_cost) || 0;
              const nm = Number(snap.new_margin);
              if (!(sp > 0 && nc > 0 && nm > -100 && nm <= 100)) continue;
              if (Math.abs(nc - currentCostForCompare) < 0.01) continue;
              previousMargin = nm;
              hasBaseline = true;
              break;
            }

            const currentMargin =
              sellingPricePerBase > 0 && newCostPerBase !== null
                ? Math.round(((sellingPricePerBase - newCostPerBase) / sellingPricePerBase) * 1000) / 10
                : currentSellingPrice > 0 && newCostNum > 0
                  ? Math.round(((currentSellingPrice - newCostNum) / currentSellingPrice) * 1000) / 10
                  : 0;

            const marginDelta = hasBaseline
              ? Math.round((currentMargin - previousMargin) * 10) / 10
              : 0;

            return {
              productName: s.products.name,
              productId: s.product_id,
              oldMargin: previousMargin,
              newMargin: currentMargin,
              marginDelta,
              oldCost: s.old_total_cost,
              newCost: newCostNum,
              sellingPrice: currentSellingPrice,
              oldProfit: s.old_profit,
              newProfit: s.new_profit,
              perBaseUnit,
              packSizeInBase,
              oldCostPerBase,
              newCostPerBase,
              sellingPricePerBase,
              recommendedPrice,
              recommendedPricePerBase,
              hasBaseline,
            };
          })
          .sort((a, b) => a.marginDelta - b.marginDelta);

        // Build ingredient impacts (aggregate by ingredient)
        const ingredientMap = new Map<string, { oldPrice: number; newPrice: number; products: Set<string> }>();
        (costHistory || []).forEach((h: any) => {
          const key = h.ingredient_name.toLowerCase();
          const existing = ingredientMap.get(key);
          if (!existing) {
            ingredientMap.set(key, {
              oldPrice: h.old_price,
              newPrice: h.new_price,
              products: new Set([h.products.name]),
            });
          } else {
            // Keep the most recent prices (already sorted desc)
            existing.products.add(h.products.name);
          }
        });

        const ingredientImpacts: IngredientImpact[] = Array.from(ingredientMap.entries())
          .map(([name, info]) => ({
            ingredientName: name.charAt(0).toUpperCase() + name.slice(1),
            oldPrice: info.oldPrice,
            newPrice: info.newPrice,
            pctIncrease: info.oldPrice > 0 ? ((info.newPrice - info.oldPrice) / info.oldPrice) * 100 : 0,
            impactedProducts: Array.from(info.products),
          }))
          .filter((i) => i.pctIncrease > 0)
          .sort((a, b) => b.pctIncrease - a.pctIncrease);

        // Generate actionable insights
        const insights: ProfitInsight[] = [];

        // Products with margin drops
        const droppedProducts = marginChanges.filter((m) => m.marginDelta < -5);
        droppedProducts.forEach((p) => {
          insights.push({
            type: "margin_drop",
            severity: p.marginDelta < -15 ? "critical" : "warning",
            message: `${p.productName} profit dropped by ${Math.abs(p.marginDelta).toFixed(1)}%`,
            detail: `Cost went from ₹${p.oldCost.toFixed(0)} → ₹${p.newCost.toFixed(0)} but selling price remains ₹${p.sellingPrice.toFixed(0)}`,
          });
        });

        // Ingredient cost spikes
        ingredientImpacts.slice(0, 5).forEach((ing) => {
          if (ing.pctIncrease > 10) {
            insights.push({
              type: "cost_spike",
              severity: ing.pctIncrease > 25 ? "critical" : "warning",
              message: `${ing.ingredientName} price increased by ${ing.pctIncrease.toFixed(0)}%`,
              detail: `Impacting ${ing.impactedProducts.length} dish${ing.impactedProducts.length > 1 ? "es" : ""}: ${ing.impactedProducts.join(", ")}`,
            });
          }
        });

        // Actionable suggestions
        if (droppedProducts.length > 0) {
          insights.push({
            type: "action",
            severity: "info",
            message: `Consider updating selling prices for ${droppedProducts.length} product${droppedProducts.length > 1 ? "s" : ""} to restore margins`,
          });
        }

        const avgDelta =
          marginChanges.length > 0
            ? marginChanges.reduce((sum, m) => sum + m.marginDelta, 0) / marginChanges.length
            : 0;

        setData({
          marginChanges,
          ingredientImpacts,
          insights,
          overallMarginTrend: avgDelta > 2 ? "up" : avgDelta < -2 ? "down" : "stable",
          totalProductsAtRisk: droppedProducts.length,
        });
      } catch (error) {
        console.error("Error fetching profit insights:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetch();

    // Real-time sync — refresh on any data change that can move margins
    // const channel = supabase
    //   .channel("profit-insights-sync")
    //   .on("postgres_changes", { event: "*", schema: "public", table: "product_cost_snapshots" }, () => !cancelled && fetch())
    //   .on("postgres_changes", { event: "*", schema: "public", table: "ingredient_cost_history" }, () => !cancelled && fetch())
    //   .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => !cancelled && fetch())
    //   .on("postgres_changes", { event: "*", schema: "public", table: "product_ingredients" }, () => !cancelled && fetch())
    //   .on("postgres_changes", { event: "*", schema: "public", table: "product_recipes" }, () => !cancelled && fetch())
    //   .subscribe();
    // Create unique channel names to avoid conflicts when multiple instances of this hook exist
    const profitChannelName = `profit-insights-sync-${user?.id || "anon"}-${Math.random().toString(36).substr(2, 9)}`;

    // Real-time sync — refresh on any data change that can move margins
    const channel = supabase
      .channel(profitChannelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_cost_snapshots" },
        () => !cancelled && fetch(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ingredient_cost_history" },
        () => !cancelled && fetch(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => !cancelled && fetch())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_ingredients" },
        () => !cancelled && fetch(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "product_recipes" }, () => !cancelled && fetch())
      .subscribe((status, err) => {
        if (err) {
          console.error("Realtime subscription error in useProfitInsights:", err);
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { data, isLoading };
}
