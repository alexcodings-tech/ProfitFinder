import { useState, useEffect } from "react";
import { Factory, Plus, AlertTriangle, CheckCircle, History } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useProducts";
import { useToast } from "@/hooks/use-toast";
import { RecipeManager } from "@/components/production/RecipeManager";
import { BatchHistory } from "@/components/production/BatchHistory";
import { ProductionCostsManager, useProductionCosts } from "@/components/production/ProductionCostsManager";
import { PackagingVariantsManager } from "@/components/production/PackagingVariantsManager";
import { usePackagingVariants } from "@/hooks/usePackagingVariants";
import { computeProductionCost } from "@/lib/productionCost";
import { Calculator, Package } from "lucide-react";
import { convertUnit, areUnitsCompatible, toBaseUnit } from "@/lib/unitConversion";
import { useProfitInsights } from "@/hooks/useProfitInsights";



interface IngredientRequirement {
  ingredient_name: string;
  quantity_required: number; // per unit, in recipe unit
  unit: string; // recipe unit (display)
  available_stock: number; // in stock unit
  available_stock_unit: string;
  needed: number; // total needed in stock unit
  sufficient: boolean;
  unit_mismatch?: boolean;
}

const Production = () => {
  const { user } = useAuth();
  const { products, isLoading: productsLoading } = useProducts();
  const { getForProduct } = useProductionCosts();
  const { getForProduct: getVariantsForProduct, getDefaultForProduct } = usePackagingVariants();
  const { data: profitInsightsData } = useProfitInsights();

  const { toast } = useToast();
  
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [batchSizeMode, setBatchSizeMode] = useState<"units" | "weight">("units");
  const [productionQuantity, setProductionQuantity] = useState<number>(1);
  const [batchWeight, setBatchWeight] = useState<number>(0);
  const [batchWeightUnit, setBatchWeightUnit] = useState<string>("kg");
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [requirements, setRequirements] = useState<IngredientRequirement[]>([]);
  const [ingredientPrices, setIngredientPrices] = useState<Record<string, number>>({});
  const [recipeBatch, setRecipeBatch] = useState<{ qty: number; unit: string } | null>(null);

  const [isCalculating, setIsCalculating] = useState(false);
  const [isProducing, setIsProducing] = useState(false);
  const [showRecipeManager, setShowRecipeManager] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCostsManager, setShowCostsManager] = useState(false);
  const [showVariantsManager, setShowVariantsManager] = useState(false);

  // User-defined batch size (kg/L per batch) — persisted in product_batch_sizes
  const [batchSizeInput, setBatchSizeInput] = useState<number>(0);
  const [batchSizeUnitInput, setBatchSizeUnitInput] = useState<string>("kg");
  const [isSavingBatchSize, setIsSavingBatchSize] = useState(false);


  const productVariants = selectedProductId ? getVariantsForProduct(selectedProductId) : [];
  const selectedVariant =
    productVariants.find((v) => v.id === selectedVariantId) ||
    (selectedProductId ? getDefaultForProduct(selectedProductId) : null);

  // When weight mode + variant selected, derive units = batchWeight / pack_size (with unit conversion)
  const derivedUnitsFromWeight = (() => {
    if (batchSizeMode !== "weight" || !selectedVariant || batchWeight <= 0) return 0;
    let weightInPackUnit = batchWeight;
    if (batchWeightUnit !== selectedVariant.unit) {
      if (!areUnitsCompatible(batchWeightUnit, selectedVariant.unit)) return 0;
      const conv = convertUnit(batchWeight, batchWeightUnit, selectedVariant.unit);
      if (conv === null) return 0;
      weightInPackUnit = conv;
    }
    return Math.floor(weightInPackUnit / Math.max(Number(selectedVariant.pack_size), 0.0001));
  })();

  const effectiveQuantity =
    batchSizeMode === "weight" ? derivedUnitsFromWeight : productionQuantity;

  const canProduce =
    requirements.length > 0 &&
    requirements.every((r) => r.sufficient && !r.unit_mismatch) &&
    effectiveQuantity > 0;
  const hasInsufficientStock = requirements.some(r => !r.sufficient || r.unit_mismatch);

  // Max producible units = min(floor(available / per-unit-need)) across all ingredients
  const maxProducible = (() => {
    if (requirements.length === 0) return 0;
    let min = Infinity;
    let bottleneck = "";
    const baseQty = Math.max(effectiveQuantity, 1);
    for (const r of requirements) {
      if (r.unit_mismatch) return 0;
      const perUnit = r.needed / baseQty;
      if (perUnit <= 0) continue;
      const possible = Math.floor(r.available_stock / perUnit);
      if (possible < min) {
        min = possible;
        bottleneck = r.ingredient_name;
      }
    }
    return { units: Number.isFinite(min) ? min : 0, bottleneck };
  })();

  useEffect(() => {
    if (selectedProductId && effectiveQuantity > 0) {
      calculateRequirements();
    } else {
      setRequirements([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId, effectiveQuantity, selectedVariant?.id]);

  // Load saved batch size for selected product
  useEffect(() => {
    if (!user || !selectedProductId) {
      setBatchSizeInput(0);
      setBatchSizeUnitInput("kg");
      return;
    }
    (async () => {
      const { data } = await (supabase as any)
        .from("product_batch_sizes")
        .select("batch_size, unit")
        .eq("user_id", user.id)
        .eq("product_id", selectedProductId)
        .maybeSingle();
      if (data) {
        setBatchSizeInput(Number(data.batch_size) || 0);
        setBatchSizeUnitInput(data.unit || "kg");
      } else {
        setBatchSizeInput(0);
        setBatchSizeUnitInput("kg");
      }
    })();
  }, [user, selectedProductId]);

  const handleSaveBatchSize = async () => {
    if (!user || !selectedProductId || batchSizeInput <= 0) {
      toast({
        title: "Enter a batch size",
        description: "Batch size must be greater than 0.",
        variant: "destructive",
      });
      return;
    }
    setIsSavingBatchSize(true);
    try {
      const { error } = await (supabase as any)
        .from("product_batch_sizes")
        .upsert(
          {
            user_id: user.id,
            product_id: selectedProductId,
            batch_size: batchSizeInput,
            unit: batchSizeUnitInput,
          },
          { onConflict: "user_id,product_id" }
        );
      if (error) throw error;
      toast({
        title: "Batch size saved",
        description: `${batchSizeInput} ${batchSizeUnitInput} per batch.`,
      });
      // Per PRD: refresh page after save
      setTimeout(() => window.location.reload(), 500);
    } catch (e: any) {
      toast({
        title: "Failed to save batch size",
        description: e?.message ?? "Try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingBatchSize(false);
    }
  };




  const calculateRequirements = async () => {
    if (!user || !selectedProductId) return;

    setIsCalculating(true);
    try {
      // Try variant-specific recipe first; fall back to generic (variant_id IS NULL)
      let recipes: any[] | null = null;
      if (selectedVariant?.id) {
        const { data, error } = await (supabase as any)
          .from("product_recipes")
          .select("ingredient_name, quantity_required, unit, total_batch_quantity, batch_unit")
          .eq("product_id", selectedProductId)
          .eq("user_id", user.id)
          .eq("variant_id", selectedVariant.id);
        if (error) throw error;
        if (data && data.length > 0) recipes = data;
      }
      if (!recipes) {
        const { data, error } = await (supabase as any)
          .from("product_recipes")
          .select("ingredient_name, quantity_required, unit, total_batch_quantity, batch_unit")
          .eq("product_id", selectedProductId)
          .eq("user_id", user.id)
          .is("variant_id", null);
        if (error) throw error;
        recipes = data || [];
      }

      if (!recipes || recipes.length === 0) {
        setRequirements([]);
        setRecipeBatch(null);
        return;
      }

      // Capture recipe-level batch yield (used for per-kg true cost)
      const first = recipes[0] as any;
      const tbq = Number(first?.total_batch_quantity) || 0;
      const tbu = first?.batch_unit || null;
      if (tbq > 0 && tbu) {
        const b = toBaseUnit(tbq, tbu);
        if (b.unit === "kg" || b.unit === "L") setRecipeBatch({ qty: b.quantity, unit: b.unit });
        else setRecipeBatch(null);
      } else {
        // Fall back to summing recipe quantities
        const totals = new Map<string, number>();
        for (const r of recipes) {
          const b = toBaseUnit(Number(r.quantity_required) || 0, r.unit || "kg");
          totals.set(b.unit, (totals.get(b.unit) || 0) + b.quantity);
        }
        let bestUnit = "kg"; let bestQty = 0;
        for (const [u, q] of totals) if (q > bestQty) { bestQty = q; bestUnit = u; }
        setRecipeBatch(bestQty > 0 && (bestUnit === "kg" || bestUnit === "L") ? { qty: bestQty, unit: bestUnit } : null);
      }

      // Get current inventory for the product (incl. price for cost calc)
      const { data: inventory, error: invError } = await supabase
        .from("product_ingredients")
        .select("ingredient_name, quantity, unit, price")
        .eq("product_id", selectedProductId)
        .eq("user_id", user.id);

      if (invError) throw invError;

      // ── Shared ingredient pool: fetch all user's ingredients across products
      // so an ingredient defined under another product can still be used here.
      const { data: allUserIngredients } = await supabase
        .from("product_ingredients")
        .select("ingredient_name, quantity, unit, price")
        .eq("user_id", user.id);

      const sharedByName = new Map<string, { quantity: number; unit: string; totalCost: number; totalQty: number }>();
      (allUserIngredients || []).forEach((i: any) => {
        const key = (i.ingredient_name || "").trim().toLowerCase();
        if (!key) return;
        const qty = Number(i.quantity) || 0;
        const price = Number(i.price) || 0;
        const unit = i.unit || "kg";
        const ex = sharedByName.get(key);
        if (!ex) {
          sharedByName.set(key, { quantity: qty, unit, totalCost: qty * price, totalQty: qty });
        } else if (ex.unit === unit) {
          ex.quantity += qty; ex.totalCost += qty * price; ex.totalQty += qty;
        } else if (areUnitsCompatible(ex.unit, unit)) {
          const conv = convertUnit(qty, unit, ex.unit) || 0;
          ex.quantity += conv; ex.totalCost += conv * price; ex.totalQty += conv;
        }
      });
      const lookupShared = (name: string) => {
        const key = (name || "").trim().toLowerCase();
        const inv = sharedByName.get(key);
        if (!inv) return null;
        return { quantity: inv.quantity, unit: inv.unit, price: inv.totalQty > 0 ? inv.totalCost / inv.totalQty : 0 };
      };

      const priceMap: Record<string, number> = {};
      (inventory || []).forEach((i: any) => {
        priceMap[i.ingredient_name.trim().toLowerCase()] = Number(i.price) || 0;
      });
      // Backfill missing prices from shared pool
      (recipes || []).forEach((r: any) => {
        const k = r.ingredient_name.trim().toLowerCase();
        if (!priceMap[k]) {
          const sh = lookupShared(r.ingredient_name);
          if (sh) priceMap[k] = sh.price;
        }
      });
      setIngredientPrices(priceMap);

      // Calculate requirements with unit normalization
      const reqs: IngredientRequirement[] = recipes.map(recipe => {
        const localStock = inventory?.find(i => i.ingredient_name === recipe.ingredient_name);
        // Fall back to shared pool when this product has no row for the ingredient
        const sharedStock = localStock ? null : lookupShared(recipe.ingredient_name);
        const stockUnit = (localStock?.unit) || (sharedStock?.unit) || recipe.unit || "kg";
        const recipeUnit = recipe.unit || "kg";
        const availableInStockUnit = Number(localStock?.quantity ?? sharedStock?.quantity ?? 0);

        // Convert recipe requirement to stock unit so we compare apples-to-apples
        let neededInStockUnit = Number(recipe.quantity_required) * effectiveQuantity;
        let unitMismatch = false;
        if ((localStock || sharedStock) && recipeUnit !== stockUnit) {
          if (!areUnitsCompatible(recipeUnit, stockUnit)) {
            unitMismatch = true;
          } else {
            const converted = convertUnit(neededInStockUnit, recipeUnit, stockUnit);
            if (converted !== null) neededInStockUnit = converted;
            else unitMismatch = true;
          }
        }

        return {
          ingredient_name: recipe.ingredient_name,
          quantity_required: recipe.quantity_required,
          unit: recipeUnit,
          available_stock: availableInStockUnit,
          available_stock_unit: stockUnit,
          needed: neededInStockUnit,
          sufficient: !unitMismatch && availableInStockUnit >= neededInStockUnit,
          unit_mismatch: unitMismatch,
        };
      });

      setRequirements(reqs);
    } catch (error) {
      console.error("Error calculating requirements:", error);
      toast({
        title: "Error",
        description: "Failed to calculate ingredient requirements",
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleProduce = async () => {
    if (!user || !selectedProductId || !canProduce) return;

    setIsProducing(true);
    try {
      // Use edge function for atomic batch production
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("No valid session");
      }

      const response = await supabase.functions.invoke("produce-batch", {
        body: {
          product_id: selectedProductId,
          quantity: effectiveQuantity,
          batch_size_mode: batchSizeMode,
          batch_weight: batchSizeMode === "weight" ? batchWeight : null,
          batch_weight_unit: batchSizeMode === "weight" ? batchWeightUnit : null,
          variant_id: selectedVariant?.id || null,
        }
      });

      if (response.error) {
        throw new Error(response.error.message || "Production failed");
      }

      const result = response.data;

      if (!result.success) {
        // Handle insufficient stock errors
        if (result.details && Array.isArray(result.details)) {
          toast({
            title: "Insufficient Stock",
            description: result.details.join("; "),
            variant: "destructive",
          });
        } else {
          throw new Error(result.error || "Production failed");
        }
        return;
      }

      // Snapshot the cost breakdown onto the batch (uses RLS UPDATE on own batch)
      if (result.batch_id) {
        await (supabase as any)
          .from("batches")
          .update({
            ingredient_cost_per_unit: computedCost.ingredientCostPerUnit,
            overhead_cost_per_unit: computedCost.overheadCostPerUnit,
            total_cost_per_unit: computedCost.totalCostPerUnit,
            total_batch_cost: computedCost.totalBatchCost,
            overhead_breakdown: computedCost.breakdown,
          })
          .eq("id", result.batch_id);
      }

      toast({
        title: "Production Complete",
        description: `Produced ${effectiveQuantity} unit(s) · True cost ₹${computedCost.totalCostPerUnit.toFixed(2)}/unit`,
      });

      // Reset form
      setProductionQuantity(1);
      setBatchWeight(0);
      setRequirements([]);
      setSelectedProductId("");
      setSelectedVariantId("");

      // Per PRD: refresh page after batch saved
      setTimeout(() => window.location.reload(), 600);

    } catch (error: any) {
      console.error("Error during production:", error);
      toast({
        title: "Production Failed",
        description: "An error occurred during production. No changes were made.",
        variant: "destructive",
      });

    } finally {
      setIsProducing(false);
    }
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Live per-batch cost preview (ingredients + production overheads)
  // recipeSpendPerBatch = sum across recipe of (qty_required * price), in stock units.
  // When recipeBatch (total_batch_quantity in kg/L) is known, derive a TRUE
  // per-kg ingredient cost, then scale up to per-pack via the variant pack size.
  // This avoids treating per-batch recipe rows as per-unit and inflating the cost.
  const recipeSpendPerBatch = (() => {
    if (requirements.length === 0) return 0;
    let cost = 0;
    for (const r of requirements) {
      if (r.unit_mismatch) return 0;
      const perBatchNeeded = r.needed / Math.max(effectiveQuantity, 1);
      const price = ingredientPrices[r.ingredient_name.trim().toLowerCase()] || 0;
      cost += perBatchNeeded * price;
    }
    return Math.round(cost * 100) / 100;
  })();

  // Pack size in base unit (kg/L) — also used for "Per kg" badge below
  const packBaseEarly = selectedVariant
    ? toBaseUnit(Number(selectedVariant.pack_size) || 0, selectedVariant.unit || "kg")
    : null;
  const packSizeInBaseEarly =
    packBaseEarly && (packBaseEarly.unit === "kg" || packBaseEarly.unit === "L")
      ? packBaseEarly.quantity
      : 0;

  const marginChangeForProduct = profitInsightsData?.marginChanges?.find(
    m => m.productId === selectedProductId
  );

  // Ingredient cost per base unit: recipe spend divided by finished batch kg/L.
  // Prefer dashboard "new cost / kg" or "new cost" if available
  const ingredientCostPerKg = (() => {
    if (marginChangeForProduct) {
      return marginChangeForProduct.newCostPerBase ?? marginChangeForProduct.newCost ?? 0;
    }
    return recipeBatch && recipeBatch.qty > 0
      ? recipeSpendPerBatch / recipeBatch.qty
      : 0;
  })();

  const ingredientCostPerUnit = (() => {
    if (ingredientCostPerKg > 0) {
      if (packSizeInBaseEarly > 0) {
        return Math.round(ingredientCostPerKg * packSizeInBaseEarly * 100) / 100;
      }
      return Math.round(ingredientCostPerKg * 100) / 100;
    }
    // Fallback: legacy per-unit assumption when no batch yield exists.
    return recipeSpendPerBatch;
  })();
  const tpl = selectedProductId ? getForProduct(selectedProductId) : null;
  // Variant-aware selling price (MRP) overrides product-level when present
  const sellingPrice =
    Number(selectedVariant?.selling_price) || Number(selectedProduct?.selling_price) || 0;
  const computedCost = computeProductionCost(
    ingredientCostPerUnit,
    tpl,
    Math.max(effectiveQuantity, 1),
    {
      variantCoverCost: selectedVariant ? Number(selectedVariant.cover_cost) : undefined,
      sellingPrice,
    }
  );
  const profitPerUnit = sellingPrice - computedCost.totalCostPerUnit;
  const marginPct =
    sellingPrice > 0 ? (profitPerUnit / sellingPrice) * 100 : 0;

  // ── Per-kg (or per-L) profit analysis ──
  // Selling price is entered as a per-kg/L rate. When the recipe batch yield
  // is known, computedCost is already for that base unit; don't divide it by
  // pack size again or profit becomes a false loss.
  const packBase = selectedVariant
    ? toBaseUnit(Number(selectedVariant.pack_size) || 0, selectedVariant.unit || "kg")
    : null;
  const packSizeInBase =
    packBase && (packBase.unit === "kg" || packBase.unit === "L") ? packBase.quantity : 0;
  const perBaseUnit = packBase && (packBase.unit === "kg" || packBase.unit === "L") ? packBase.unit : null;
  const costPerBase = perBaseUnit
    ? computedCost.totalCostPerUnit
    : packSizeInBase > 0
      ? computedCost.totalCostPerUnit / packSizeInBase
      : 0;
  const profitPerBase = perBaseUnit ? sellingPrice - costPerBase : 0;
  const marginPctPerBase =
    perBaseUnit && sellingPrice > 0 ? (profitPerBase / sellingPrice) * 100 : 0;


  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground">Production &amp; Costing</h1>
            <p className="text-muted-foreground">
              Manufacture products, manage recipes & overheads, and see true per-unit cost.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:flex lg:flex-nowrap lg:items-center">
            <Button variant="outline" size="sm" onClick={() => setShowHistory(true)} className="justify-center">
              <History className="h-4 w-4 mr-2" />
              History
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowRecipeManager(true)} className="justify-center">
              <Plus className="h-4 w-4 mr-2" />
              Recipes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVariantsManager(true)}
              disabled={!selectedProductId}
              className="justify-center"
            >
              <Package className="h-4 w-4 mr-2" />
              Packaging
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCostsManager(true)}
              disabled={!selectedProductId}
              className="justify-center"
            >
              <Calculator className="h-4 w-4 mr-2" />
              Production Costs
            </Button>
          </div>
        </div>

        {/* Production Form */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5 text-primary" />
              Create New Batch
            </CardTitle>
            <CardDescription>
              Select a product and quantity to manufacture
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product">Product to Manufacture</Label>
                <Select
                  value={selectedProductId}
                  onValueChange={(v) => {
                    setSelectedProductId(v);
                    setSelectedVariantId("");
                  }}
                  disabled={productsLoading}
                >
                  <SelectTrigger id="product">
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {products.map(product => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {productVariants.length > 0 && (
                <div className="space-y-2">
                  <Label>Packaging Variant (SKU)</Label>
                  <Select
                    value={selectedVariantId || selectedVariant?.id || ""}
                    onValueChange={setSelectedVariantId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select pack size" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {productVariants.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.size_label} ({v.pack_size}{v.unit}) — ₹{Number(v.selling_price).toFixed(0)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Batch Size (per-batch yield) — used by Dashboard Production Capacity */}
            <div className="space-y-2">
              <Label htmlFor="batch-size">Batch Size (per batch yield)</Label>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Input
                    id="batch-size"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="e.g. 10"
                    value={batchSizeInput === 0 ? "" : batchSizeInput}
                    onChange={(e) => setBatchSizeInput(parseFloat(e.target.value) || 0)}
                    disabled={!selectedProductId}
                    className="w-40"
                  />
                </div>
                <div className="space-y-1">
                  <Select
                    value={batchSizeUnitInput}
                    onValueChange={setBatchSizeUnitInput}
                    disabled={!selectedProductId}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {["g", "kg", "ml", "L"].map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  onClick={handleSaveBatchSize}
                  disabled={!selectedProductId || isSavingBatchSize || batchSizeInput <= 0}
                >
                  {isSavingBatchSize ? "Saving..." : "Save Batch"}
                </Button>
                {!selectedProductId && (
                  <span className="text-xs text-muted-foreground">
                    Select a product to enable.
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Used by Dashboard → Production Capacity to compute how many batches you can make from current stock.
              </p>
            </div>



            {/* Batch size mode */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Label>Batch size mode</Label>
                <div className="inline-flex rounded-md border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setBatchSizeMode("units")}
                    className={`px-3 py-1.5 text-sm ${batchSizeMode === "units" ? "bg-primary text-primary-foreground" : "bg-background"}`}
                  >
                    Units
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchSizeMode("weight")}
                    className={`px-3 py-1.5 text-sm ${batchSizeMode === "weight" ? "bg-primary text-primary-foreground" : "bg-background"}`}
                  >
                    Weight
                  </button>
                </div>
                {batchSizeMode === "weight" && !selectedVariant && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    Select a packaging variant to derive units from weight.
                  </span>
                )}
              </div>

              {batchSizeMode === "units" ? (
                <div className="space-y-2 max-w-xs">
                  <Label htmlFor="quantity">Production Quantity (units)</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min={1}
                    placeholder="1"
                    value={productionQuantity === 1 && !requirements.length ? "" : productionQuantity}
                    onChange={(e) => setProductionQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Batch weight</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="e.g. 10"
                      value={batchWeight === 0 ? "" : batchWeight}
                      onChange={(e) => setBatchWeight(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Select value={batchWeightUnit} onValueChange={setBatchWeightUnit}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {["g", "kg", "ml", "L"].map((u) => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Derived units</Label>
                    <div className="h-10 px-3 rounded-md border border-border bg-muted/30 flex items-center font-mono">
                      {derivedUnitsFromWeight} pack(s)
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Requirements Table */}
            {selectedProductId && (
              <div className="space-y-4">
                <h3 className="font-semibold">Ingredient Requirements</h3>
                
                {isCalculating ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Calculating requirements...
                  </div>
                ) : requirements.length === 0 ? (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>No Recipe Defined</AlertTitle>
                    <AlertDescription>
                      This product has no recipe. Please add ingredient requirements in the Recipe Manager.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    {/* AI feasibility insight */}
                    {typeof maxProducible === "object" && (
                      <Alert className={maxProducible.units >= productionQuantity ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30" : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"}>
                        <Factory className="h-4 w-4" />
                        <AlertTitle>
                          You can produce up to {maxProducible.units} unit{maxProducible.units !== 1 ? "s" : ""}
                        </AlertTitle>
                        <AlertDescription>
                          {maxProducible.bottleneck
                            ? `Limited by ${maxProducible.bottleneck} — restock to produce more.`
                            : "Sufficient stock for your target."}
                        </AlertDescription>
                      </Alert>
                    )}

                    {hasInsufficientStock && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Insufficient Stock</AlertTitle>
                        <AlertDescription>
                          Some ingredients don't have enough stock for {effectiveQuantity} unit(s).
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="rounded-lg border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="font-semibold">Ingredient</TableHead>
                            <TableHead className="font-semibold text-right">Per Unit</TableHead>
                            <TableHead className="font-semibold text-right">Needed</TableHead>
                            <TableHead className="font-semibold text-right">Available</TableHead>
                            <TableHead className="font-semibold text-center">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {requirements.map((req, idx) => (
                            <TableRow key={idx} className={!req.sufficient ? "bg-destructive/5" : ""}>
                              <TableCell className="font-medium">{req.ingredient_name}</TableCell>
                              <TableCell className="text-right font-mono">
                                {req.quantity_required} {req.unit}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {req.needed.toFixed(2)} {req.available_stock_unit}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {req.available_stock.toFixed(2)} {req.available_stock_unit}
                              </TableCell>
                              <TableCell className="text-center">
                                {req.unit_mismatch ? (
                                  <Badge variant="destructive">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Unit mismatch
                                  </Badge>
                                ) : req.sufficient ? (
                                  <Badge className="bg-success/10 text-success border-success/30">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    OK
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Insufficient
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* True Cost Preview */}
            {selectedProductId && requirements.length > 0 && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-primary" />
                    Total Product Cost (Ingredients + Production)
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCostsManager(true)}
                  >
                    Edit overheads
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Ingredients</p>
                    <p className="font-mono font-semibold">₹{computedCost.ingredientCostPerUnit.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Overheads + Tax</p>
                    <p className="font-mono font-semibold">₹{computedCost.overheadCostPerUnit.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">True cost / {perBaseUnit || "kg"}</p>
                    <p className="font-mono font-bold text-primary">₹{computedCost.totalCostPerUnit.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Batch total ({effectiveQuantity}u)</p>
                    <p className="font-mono font-semibold">₹{computedCost.totalBatchCost.toFixed(2)}</p>
                  </div>
                </div>
                {sellingPrice > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    {perBaseUnit && packSizeInBase > 0 && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-muted-foreground">
                          Per {perBaseUnit}: Sell ₹{sellingPrice.toFixed(2)}/{perBaseUnit} · Cost ₹{costPerBase.toFixed(2)}/{perBaseUnit} →
                        </span>
                        <Badge
                          className={
                            marginPctPerBase < 0
                              ? "bg-destructive/15 text-destructive border-destructive/30"
                              : marginPctPerBase < 15
                              ? "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400"
                              : "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400"
                          }
                        >
                          Profit ₹{profitPerBase.toFixed(2)}/{perBaseUnit} ({marginPctPerBase.toFixed(1)}%)
                        </Badge>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-muted-foreground">
                        Per pack: Sell ₹{(perBaseUnit ? sellingPrice * packSizeInBase : sellingPrice).toFixed(2)} →
                      </span>
                      <Badge
                        className={
                          (perBaseUnit ? marginPctPerBase : marginPct) < 0
                            ? "bg-destructive/15 text-destructive border-destructive/30"
                            : (perBaseUnit ? marginPctPerBase : marginPct) < 15
                            ? "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400"
                            : "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400"
                        }
                      >
                        Profit ₹{(perBaseUnit ? profitPerBase * packSizeInBase : profitPerUnit).toFixed(2)} ({(perBaseUnit ? marginPctPerBase : marginPct).toFixed(1)}%)
                      </Badge>
                      <span className="text-muted-foreground">
                        Breakdown — Pack ₹{computedCost.breakdown.packing} · Label ₹{computedCost.breakdown.label} · Labor ₹{computedCost.breakdown.labor} · Machine ₹{computedCost.breakdown.machine} · EB ₹{computedCost.breakdown.eb} · Utilities ₹{computedCost.breakdown.utilities} · Shipping ₹{computedCost.breakdown.shipping} · Tax ₹{computedCost.breakdown.tax}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Produce Button */}
            <div className="flex justify-end pt-4 border-t border-border">
              <Button
                size="lg"
                onClick={handleProduce}
                disabled={!canProduce || isProducing}
                className="gap-2"
              >
                <Factory className="h-4 w-4" />
                {isProducing ? "Processing..." : `Produce ${effectiveQuantity} Unit(s)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recipe Manager Modal */}
      <RecipeManager
        open={showRecipeManager}
        onOpenChange={setShowRecipeManager}
        products={products}
      />

      {/* Production Costs Manager */}
      <ProductionCostsManager
        open={showCostsManager}
        onOpenChange={setShowCostsManager}
        products={products}
        initialProductId={selectedProductId}
        ingredientCostPerUnit={ingredientCostPerUnit}
      />

      {/* Packaging Variants Manager */}
      <PackagingVariantsManager
        open={showVariantsManager}
        onOpenChange={setShowVariantsManager}
        products={products}
        initialProductId={selectedProductId}
      />

      {/* Batch History Modal */}
      <BatchHistory
        open={showHistory}
        onOpenChange={setShowHistory}
      />
    </AppLayout>
  );
};

export default Production;
