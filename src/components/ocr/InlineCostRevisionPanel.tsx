import { useState, useEffect, useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, DollarSign, AlertTriangle, Loader2, Save, Trash2, Check, Pencil } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { RecipeIngredient, useCostRevision } from "@/hooks/useCostRevision";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { toBaseUnit } from "@/lib/unitConversion";
import { InlineProductionCostEditor } from "@/components/ocr/InlineProductionCostEditor";
import { useBusinessIntelligence } from "@/hooks/useBusinessIntelligence";
import { IndianRupee } from "lucide-react";

interface InlineCostRevisionPanelProps {
  productId: string;
  productName: string;
  onIngredientsChange: (ingredients: RecipeIngredient[], sellingPrice: number, allFilled: boolean) => void;
  onEditRecipe?: () => void;
}

export function InlineCostRevisionPanel({
  productId,
  productName,
  onIngredientsChange,
  onEditRecipe,
}: InlineCostRevisionPanelProps) {
  const { fetchRecipeWithPrices, calculateRevision, fetchSellingPrice, saveRevision, isLoading } =
    useCostRevision();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [originalIngredients, setOriginalIngredients] = useState<RecipeIngredient[]>([]);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);
  const [noRecipe, setNoRecipe] = useState(false);
  const [isSavingIngredients, setIsSavingIngredients] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState<number>(0);
  const [newUnit, setNewUnit] = useState<string>("kg");
  const [newPrice, setNewPrice] = useState<number>(0);
  const [isAdding, setIsAdding] = useState(false);
  const [batchTotal, setBatchTotal] = useState<{ qty: number; unit: string } | null>(null);
  const { data: biData } = useBusinessIntelligence();
  const productInsight = useMemo(
    () => biData.products.find((p) => p.productId === productId) || null,
    [biData, productId]
  );

  const handleAddIngredient = async () => {
    if (!user) return;
    if (!newName.trim() || newQty <= 0 || newPrice <= 0) {
      toast({
        title: "Invalid ingredient",
        description: "Name, quantity, and price are required.",
        variant: "destructive",
      });
      return;
    }
    setIsAdding(true);
    try {
      const totalCost = Math.round(newQty * newPrice * 100) / 100;
      const { error } = await supabase.from("product_ingredients").insert({
        user_id: user.id,
        product_id: productId,
        ingredient_name: newName.trim(),
        quantity: newQty,
        unit: newUnit,
        price: newPrice,
        unit_price: newPrice,
        total_cost: totalCost,
        total_purchased: newQty,
      });
      if (error) throw error;
      toast({
        title: "Ingredient added",
        description: `${newName.trim()} added to inventory.`,
      });
      setShowAddForm(false);
      setNewName("");
      setNewQty(0);
      setNewUnit("kg");
      setNewPrice(0);
      setTimeout(() => window.location.reload(), 500);
    } catch (e: any) {
      toast({
        title: "Failed to add ingredient",
        description: e?.message || "Try again.",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  useEffect(() => {
    if (authLoading || !user) return;

    let cancelled = false;
    setLoaded(false);
    setNoRecipe(false);
    setValidationErrors({});

    (async () => {
      const [recipe, sp, batchRes] = await Promise.all([
        fetchRecipeWithPrices(productId),
        fetchSellingPrice(productId),
        (supabase as any)
          .from("product_recipes")
          .select("total_batch_quantity, batch_unit")
          .eq("product_id", productId)
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const br = batchRes?.data;
      if (br && Number(br.total_batch_quantity) > 0) {
        setBatchTotal({ qty: Number(br.total_batch_quantity), unit: br.batch_unit || "kg" });
      } else {
        setBatchTotal(null);
      }
      if (!recipe || recipe.length === 0) {
        setNoRecipe(true);
        setIngredients([]);
        setOriginalIngredients([]);
        setLoaded(true);
        onIngredientsChange([], sp, true);
        return;
      }
      setIngredients(recipe);
      setOriginalIngredients(recipe.map(i => ({ ...i })));
      setSellingPrice(sp);
      setLoaded(true);
      const allFilled = recipe.every((i) => i.new_price > 0);
      onIngredientsChange(recipe, sp, allFilled);
    })();

    return () => { cancelled = true; };
  }, [productId, user, authLoading]);

  const hasChanges = useMemo(() => {
    return ingredients.some((ing, idx) => ing.new_price !== originalIngredients[idx]?.new_price);
  }, [ingredients, originalIngredients]);

  const updatePrice = (index: number, rawValue: number) => {
    const newPrice = Math.max(0, rawValue);
    const updated = ingredients.map((ing, i) =>
      i === index ? { ...ing, new_price: newPrice } : ing
    );
    setIngredients(updated);

    // Clear validation error for this row
    setValidationErrors(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });

    const allFilled = updated.every((i) => i.new_price > 0);
    onIngredientsChange(updated, sellingPrice, allFilled);
  };

  const updateField = (index: number, field: "ingredient_name" | "quantity_required" | "unit", value: string | number) => {
    const updated = ingredients.map((ing, i) =>
      i === index ? { ...ing, [field]: value } : ing
    );
    setIngredients(updated);
  };

  const isRowDirty = (idx: number) => {
    const o = originalIngredients[idx];
    const c = ingredients[idx];
    if (!o || !c) return false;
    return (
      o.ingredient_name !== c.ingredient_name ||
      Number(o.quantity_required) !== Number(c.quantity_required) ||
      o.unit !== c.unit ||
      Number(o.new_price) !== Number(c.new_price)
    );
  };

  const handleSaveRow = async (idx: number) => {
    if (!user) return;
    const ing = ingredients[idx];
    const orig = originalIngredients[idx];
    if (!ing || !orig) return;
    if (!ing.ingredient_name.trim() || ing.quantity_required <= 0 || ing.new_price <= 0) {
      toast({ title: "Invalid row", description: "Name, quantity and price are required.", variant: "destructive" });
      return;
    }
    try {
      const totalCost = Math.round(ing.quantity_required * ing.new_price * 100) / 100;
      const { error } = await supabase
        .from("product_ingredients")
        .update({
          ingredient_name: ing.ingredient_name.trim(),
          quantity: ing.quantity_required,
          unit: ing.unit,
          price: ing.new_price,
          unit_price: ing.new_price,
          total_cost: totalCost,
        })
        .eq("product_id", productId)
        .eq("ingredient_name", orig.ingredient_name)
        .eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "Ingredient updated" });
      setTimeout(() => window.location.reload(), 400);
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to update ingredient", variant: "destructive" });
    }
  };

  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const handleDeleteRow = async (idx: number) => {
    if (!user) return;
    const orig = originalIngredients[idx];
    if (!orig) return;
    try {
      const [ingRes, recRes] = await Promise.all([
        supabase
          .from("product_ingredients")
          .delete()
          .eq("product_id", productId)
          .eq("ingredient_name", orig.ingredient_name)
          .eq("user_id", user.id),
        supabase
          .from("product_recipes")
          .delete()
          .eq("product_id", productId)
          .eq("ingredient_name", orig.ingredient_name)
          .eq("user_id", user.id),
      ]);
      if (ingRes.error) throw ingRes.error;
      if (recRes.error) throw recRes.error;
      toast({ title: "Ingredient deleted", description: "Removed from inventory and recipe." });
      setTimeout(() => window.location.reload(), 300);
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to delete ingredient", variant: "destructive" });
    }
  };

  const handleDeleteAll = async () => {
    if (!user) return;
    setIsDeletingAll(true);
    try {
      const [ingRes, recRes] = await Promise.all([
        supabase
          .from("product_ingredients")
          .delete()
          .eq("product_id", productId)
          .eq("user_id", user.id),
        supabase
          .from("product_recipes")
          .delete()
          .eq("product_id", productId)
          .eq("user_id", user.id),
      ]);
      if (ingRes.error) throw ingRes.error;
      if (recRes.error) throw recRes.error;
      const prodRes = await supabase
        .from("products")
        .delete()
        .eq("id", productId)
        .eq("user_id", user.id);
      if (prodRes.error) throw prodRes.error;
      toast({ title: "Product deleted", description: `"${productName}" and its ingredients were removed.` });
      setDeleteAllOpen(false);
      if (typeof window !== "undefined") sessionStorage.removeItem("setup_product_id");
      setTimeout(() => window.location.reload(), 400);
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to delete product", variant: "destructive" });
    } finally {
      setIsDeletingAll(false);
    }
  };

  const [isSavingSP, setIsSavingSP] = useState(false);
  const [spDirty, setSpDirty] = useState(false);

  const handleSellingPriceChange = (sp: number) => {
    setSellingPrice(sp);
    setSpDirty(true);
    const allFilled = ingredients.every((i) => i.new_price > 0);
    onIngredientsChange(ingredients, sp, allFilled);
  };

  const handleSaveSellingPrice = async () => {
    if (!user) return;
    if (sellingPrice <= 0) {
      toast({ title: "Invalid selling price", description: "Must be greater than 0", variant: "destructive" });
      return;
    }
    setIsSavingSP(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({ selling_price: sellingPrice })
        .eq("id", productId)
        .eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "Selling price saved" });
      setSpDirty(false);
    } catch (e: any) {
      toast({ title: "Failed to save selling price", description: e?.message, variant: "destructive" });
    } finally {
      setIsSavingSP(false);
    }
  };

  const handleSaveIngredients = async () => {
    // Validate all rows
    const errors: Record<number, string> = {};
    ingredients.forEach((ing, idx) => {
      if (ing.new_price <= 0) {
        errors[idx] = "Price per KG must be greater than 0";
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast({
        title: "Validation Error",
        description: "Please fix invalid ingredient prices before saving.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingIngredients(true);
    try {
      const revision = calculateRevision(ingredients, sellingPrice);
      // We pass null bill_id since this is a manual save, not tied to a bill
      const success = await saveRevision(productId, null, ingredients, revision);

      if (success) {
        toast({
          title: "Ingredients updated successfully",
          description: `${ingredients.length} ingredient(s) saved.`,
        });
        // Update originals to reflect saved state
        setOriginalIngredients(ingredients.map(i => ({ ...i })));
        // Per PRD: refresh page after save
        setTimeout(() => window.location.reload(), 500);
      } else {
        toast({
          title: "Failed to save ingredients. Try again.",
          variant: "destructive",
        });
      }

    } catch {
      toast({
        title: "Failed to save ingredients. Try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingIngredients(false);
    }
  };

  const revision = useMemo(
    () => calculateRevision(ingredients, sellingPrice),
    [ingredients, sellingPrice]
  );

  // Sum of all ingredient quantities, normalized to a single base unit (kg / L / pcs)
  const totalQty = useMemo(() => {
    const totals = new Map<string, number>();
    for (const i of ingredients) {
      const b = toBaseUnit(Number(i.quantity_required) || 0, i.unit || "kg");
      totals.set(b.unit, (totals.get(b.unit) || 0) + b.quantity);
    }
    let bestUnit = "kg";
    let bestQty = 0;
    for (const [u, q] of totals) {
      if (q > bestQty) { bestQty = q; bestUnit = u; }
    }
    return { qty: Math.round(bestQty * 1000) / 1000, unit: bestUnit };
  }, [ingredients]);

  if (isLoading || !loaded) {
    return (
      <div className="py-6 text-center text-muted-foreground flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading recipe ingredients...
      </div>
    );
  }

  if (noRecipe) {
    return (
      <div className="space-y-4">
        <Alert className="border-warning bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-sm">
            No recipe found for <strong>{productName}</strong>. Use Edit to configure a recipe, or Delete to remove this product.
          </AlertDescription>
        </Alert>
        <div className="rounded-lg border border-border p-4 bg-muted/30">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">Ingredient Cost Update</h4>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {onEditRecipe && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  onClick={() => onEditRecipe()}
                  title="Edit in Recipe Manager"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs text-destructive border-destructive/40 hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteAllOpen(true)}
                title="Delete this product"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </div>
        </div>
        <AlertDialog open={deleteAllOpen} onOpenChange={(o) => !o && !isDeletingAll && setDeleteAllOpen(false)}>
          <AlertDialogContent className="bg-popover">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this product?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{productName}</strong>? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingAll}>No</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleDeleteAll(); }}
                disabled={isDeletingAll}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeletingAll ? "Deleting..." : "Yes"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-border p-4 bg-muted/30">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Ingredient Cost Update</h4>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(() => {
            const show = batchTotal && batchTotal.qty > 0
              ? batchTotal
              : (ingredients.length > 0 && totalQty.qty > 0 ? { qty: totalQty.qty, unit: "Unit" } : null);
            if (!show) return null;
            return (
              <span className="text-xs font-medium px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/20">
                Total: {show.qty} Unit
              </span>
            );
          })()}
          {onEditRecipe && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              onClick={() => onEditRecipe()}
              title="Edit in Recipe Manager"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
          {ingredients.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs text-destructive border-destructive/40 hover:text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteAllOpen(true)}
              title="Delete all ingredients"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          )}
        </div>

      </div>

      {showAddForm && (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 p-3 rounded-md border border-border bg-background">
          <div className="sm:col-span-2 space-y-1">
            <Label className="text-xs">Ingredient name</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Sugar"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Quantity</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={newQty || ""}
              onChange={(e) => setNewQty(parseFloat(e.target.value) || 0)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Unit</Label>
            <Select value={newUnit} onValueChange={setNewUnit}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="kg">kg</SelectItem>
                <SelectItem value="g">g</SelectItem>
                <SelectItem value="L">L</SelectItem>
                <SelectItem value="ml">ml</SelectItem>
                <SelectItem value="pcs">pcs</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Price / {newUnit}</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                step={0.01}
                value={newPrice || ""}
                onChange={(e) => setNewPrice(parseFloat(e.target.value) || 0)}
                className="h-8 text-sm"
              />
              <Button
                size="sm"
                onClick={handleAddIngredient}
                disabled={isAdding}
              >
                {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Selling Price + Product Summary */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Selling Price (per unit)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step={0.01}
                value={sellingPrice || ""}
                onChange={(e) => handleSellingPriceChange(parseFloat(e.target.value) || 0)}
                placeholder="Enter selling price"
                className="w-40 sm:w-48 h-8 text-sm"
              />
              <Button
                size="sm"
                onClick={handleSaveSellingPrice}
                disabled={isSavingSP || !spDirty}
                className="h-8"
              >
                {isSavingSP ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1" />Save</>}
              </Button>
            </div>
          </div>

          <div className="flex-1 min-w-[280px]">
            <div className="rounded-lg border border-border bg-background p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[140px]">
                  {(() => {
                    const batchQty = batchTotal?.qty && batchTotal.qty > 0 ? batchTotal.qty : 1;
                    const costPerUnit = revision.new_total_cost / batchQty;
                    return (
                      <>
                        <h4 className="text-sm font-semibold text-foreground">{productName}</h4>
                        <p className="text-xs text-muted-foreground">
                          Cost ₹{costPerUnit.toFixed(2)}/Unit · Sell ₹{sellingPrice.toFixed(2)}/Unit
                        </p>
                      </>
                    );
                  })()}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Old Cost / New Cost cards commented out per request */}
                  {/* <div className="text-center px-3 py-1.5 rounded-md bg-muted">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Old Cost</p>
                    <p className="text-sm font-semibold tabular-nums">₹{revision.old_total_cost.toFixed(2)}</p>
                  </div>
                  <div className="text-center px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20">
                    <p className="text-[10px] text-primary uppercase tracking-wide">New Cost</p>
                    <p className="text-sm font-semibold tabular-nums text-primary">₹{revision.new_total_cost.toFixed(2)}</p>
                  </div> */}
                  {/* Cost card — formula: New Cost / Total batch output */}
                  {(() => {
                    const batchQty = batchTotal?.qty && batchTotal.qty > 0 ? batchTotal.qty : 1;
                    const costPerUnit = revision.new_total_cost / batchQty;
                    return (
                      <div className="text-center px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20">
                        <p className="text-[10px] text-primary uppercase tracking-wide">Cost / Unit</p>
                        <p className="text-sm font-semibold tabular-nums text-primary">₹{costPerUnit.toFixed(2)}</p>
                      </div>
                    );
                  })()}
                  {/* Profit / Loss % card — based on cost per unit vs selling price */}
                  {(() => {
                    const batchQty = batchTotal?.qty && batchTotal.qty > 0 ? batchTotal.qty : 1;
                    const costPerUnit = revision.new_total_cost / batchQty;
                    if (sellingPrice <= 0 || costPerUnit <= 0) return null;
                    const diff = sellingPrice - costPerUnit;
                    const pct = (diff / sellingPrice) * 100;
                    const isProfit = diff >= 0;
                    return (
                      <div className={cn(
                        "text-center px-3 py-1.5 rounded-md text-xs border",
                        isProfit ? "bg-success/10 border-success/20" : "bg-destructive/10 border-destructive/20"
                      )}>
                        <p className={cn("text-[10px] uppercase tracking-wide", isProfit ? "text-success" : "text-destructive")}>
                          {isProfit ? "Profit" : "Loss"} %
                        </p>
                        <p className={cn("text-sm font-semibold tabular-nums", isProfit ? "text-success" : "text-destructive")}>
                          {Math.abs(pct).toFixed(1)}%
                        </p>
                      </div>
                    );
                  })()}
                  {/* Can Produce card commented out per request */}
                  {/* {productInsight && (
                    <div className="text-center px-3 py-1.5 rounded-md bg-amber-50 border border-amber-200 text-xs">
                      <p className="text-[10px] uppercase tracking-wide text-amber-700">Can Produce</p>
                      <p className="text-sm font-semibold tabular-nums">{productInsight.maxProducibleUnits} units</p>
                    </div>
                  )} */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ingredient Price Table: Ingredient | Cost/Unit | Quantity | Cost/Quantity | Action */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="text-xs font-semibold">Ingredient</TableHead>
              <TableHead className="text-xs font-semibold text-right">Cost/Unit</TableHead>
              <TableHead className="text-xs font-semibold text-right">Quantity</TableHead>
              <TableHead className="text-xs font-semibold text-right">Cost/Quantity</TableHead>
              <TableHead className="text-xs font-semibold text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ingredients.map((ing, idx) => {
              const costPerQty = (Number(ing.old_price) || 0) * (Number(ing.quantity_required) || 0);
              return (
                <TableRow key={idx}>
                  <TableCell className="text-sm font-medium">{ing.ingredient_name}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">
                    ₹{Number(ing.old_price).toFixed(2)}/{ing.unit}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">
                    {Number(ing.quantity_required).toFixed(2)} {ing.unit}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-foreground">
                    ₹{costPerQty.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteRow(idx)}
                        title="Delete ingredient"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Inline production cost editor — commented out per request */}
      {/* <InlineProductionCostEditor productId={productId} /> */}


      {/* Summary Cards */}
      {/* <div className="grid grid-cols-2 gap-2">
        <Card>
          <CardContent className="p-3 space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Product Cost</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-muted-foreground line-through">
                ₹{revision.old_total_cost.toFixed(2)}
              </span>
              <span className="text-base font-bold">
                ₹{revision.new_total_cost.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Profit</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-muted-foreground line-through">
                ₹{revision.old_profit.toFixed(2)}
              </span>
              <span
                className={cn(
                  "text-base font-bold",
                  revision.new_profit >= 0 ? "text-success" : "text-destructive"
                )}
              >
                ₹{revision.new_profit.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Old Margin</p>
            <span className="text-base font-bold">{revision.old_margin.toFixed(1)}%</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">New Margin</p>
            <span
              className={cn(
                "text-base font-bold",
                revision.new_margin >= revision.old_margin
                  ? "text-success"
                  : "text-destructive"
              )}
            >
              {revision.new_margin.toFixed(1)}%
            </span>
          </CardContent>
        </Card>
      </div> */}

      <AlertDialog open={deleteAllOpen} onOpenChange={(o) => !o && !isDeletingAll && setDeleteAllOpen(false)}>
        <AlertDialogContent className="bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{productName}</strong> along with all its ingredients and recipe? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAll}>No</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteAll(); }}
              disabled={isDeletingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingAll ? "Deleting..." : "Yes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
