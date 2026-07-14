import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Save, ChefHat, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePackagingVariants } from "@/hooks/usePackagingVariants";
import { toBaseUnit } from "@/lib/unitConversion";

interface Product {
  id: string;
  name: string;
}

interface RecipeItem {
  id?: string;
  ingredient_name: string;
  quantity_required: number;
  unit: string;
  planned_quantity?: number | null;
  planned_unit?: string | null;
}

interface RecipeManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  initialProductId?: string;
}

const GENERIC = "__generic__";

export function RecipeManager({ open, onOpenChange, products, initialProductId }: RecipeManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { getForProduct: getVariantsForProduct } = usePackagingVariants();
  const recipeListRef = useRef<HTMLDivElement>(null);

  const [selectedProductId, setSelectedProductId] = useState<string>(initialProductId || "");
  const [selectedVariantId, setSelectedVariantId] = useState<string>(GENERIC);
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [batchQty, setBatchQty] = useState<string>("1");
  const [batchUnit, setBatchUnit] = useState<string>("kg");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newIngredient, setNewIngredient] = useState({ name: "", quantity: "", unit: "kg" });
  const [existingIngredients, setExistingIngredients] = useState<string[]>([]);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const productVariants = selectedProductId ? getVariantsForProduct(selectedProductId) : [];

  // Sync incoming initialProductId when dialog opens / prop changes
  useEffect(() => {
    if (open && initialProductId) setSelectedProductId(initialProductId);
  }, [open, initialProductId]);

  useEffect(() => {
    setSelectedVariantId(GENERIC);
  }, [selectedProductId]);

  useEffect(() => {
    if (selectedProductId && open) {
      fetchRecipes();
    } else {
      setRecipes([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId, selectedVariantId, open]);

  useEffect(() => {
    if (open && user) {
      fetchExistingIngredients();
    }
  }, [open, user]);

  // Realtime: re-fetch recipes when changes happen for the current product/variant scope
  useEffect(() => {
    if (!open || !user || !selectedProductId) return;
    const channel = supabase
      .channel(`recipe-sync-${selectedProductId}-${selectedVariantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_recipes", filter: `product_id=eq.${selectedProductId}` },
        () => {
          if (!isSaving) fetchRecipes();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user, selectedProductId, selectedVariantId, isSaving]);

  const fetchExistingIngredients = async () => {
    if (!user) return;
    try {
      // Get unique ingredient names from product_ingredients, inventory_ingredients, and bill_items
      const [ingredientsRes, inventoryRes, billItemsRes] = await Promise.all([
        supabase
          .from("product_ingredients")
          .select("ingredient_name")
          .eq("user_id", user.id),
        supabase
          .from("inventory_ingredients")
          .select("ingredient_name")
          .eq("user_id", user.id),
        supabase
          .from("bill_items")
          .select("item_name, bill_id")
      ]);

      const names = new Set<string>();
      ingredientsRes.data?.forEach(i => names.add(i.ingredient_name));
      inventoryRes.data?.forEach(i => names.add(i.ingredient_name));
      billItemsRes.data?.forEach(i => names.add(i.item_name));
      setExistingIngredients(Array.from(names).sort());
    } catch (error) {
      console.error("Error fetching existing ingredients:", error);
    }
  };

  const fetchRecipes = async () => {
    if (!user || !selectedProductId) return;

    setIsLoading(true);
    try {
      let query = (supabase as any)
        .from("product_recipes")
        .select("id, ingredient_name, quantity_required, unit, variant_id, total_batch_quantity, batch_unit, planned_quantity, planned_unit")
        .eq("product_id", selectedProductId)
        .eq("user_id", user.id)
        .order("ingredient_name");

      if (selectedVariantId === GENERIC) {
        query = query.is("variant_id", null);
      } else {
        query = query.eq("variant_id", selectedVariantId);
      }

      const { data, error } = await query;
      if (error) throw error;

      let loaded = data || [];

      // If a specific variant is selected and no variant-specific recipe
      // exists yet, pre-populate from the generic recipe so users only have
      // to update the quantities that differ for this pack size.
      if (selectedVariantId !== GENERIC && loaded.length === 0) {
        const { data: generic, error: genErr } = await (supabase as any)
          .from("product_recipes")
          .select("ingredient_name, quantity_required, unit, planned_quantity, planned_unit")
          .eq("product_id", selectedProductId)
          .eq("user_id", user.id)
          .is("variant_id", null)
          .order("ingredient_name");
        if (genErr) throw genErr;
        // Strip ids — these are unsaved drafts cloned from generic
        loaded = (generic || []).map((g: any) => ({
          ingredient_name: g.ingredient_name,
          quantity_required: g.quantity_required,
          unit: g.unit,
          planned_quantity: g.planned_quantity,
          planned_unit: g.planned_unit,
        }));
        if (loaded.length > 0) {
          toast({
            title: "Loaded generic recipe",
            description: "Edit quantities for this pack size, then Save.",
          });
        }
      }

      setRecipes(loaded);
      const first = (loaded as any[])[0];
      if (first && first.total_batch_quantity != null) {
        setBatchQty(String(first.total_batch_quantity));
        setBatchUnit(first.batch_unit || "kg");
      } else {
        setBatchQty("1");
        setBatchUnit("kg");
      }
    } catch (error) {
      console.error("Error fetching recipes:", error);
      toast({
        title: "Error",
        description: "Failed to load recipe",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddIngredient = () => {
    if (!newIngredient.name.trim() || !newIngredient.quantity) {
      toast({
        title: "Validation Error",
        description: "Please enter ingredient name and quantity",
        variant: "destructive",
      });
      return;
    }

    const exists = recipes.some(
      r => r.ingredient_name.toLowerCase() === newIngredient.name.toLowerCase()
    );

    if (exists) {
      toast({
        title: "Duplicate Ingredient",
        description: "This ingredient is already in the recipe",
        variant: "destructive",
      });
      return;
    }

    setRecipes(prev => [
      ...prev,
      {
        ingredient_name: newIngredient.name.trim(),
        quantity_required: parseFloat(newIngredient.quantity),
        unit: newIngredient.unit
      }
    ]);

    setNewIngredient({ name: "", quantity: "", unit: "kg" });
    setShowSuggestions(false);

    // Auto-scroll to bottom after adding
    setTimeout(() => {
      recipeListRef.current?.scrollTo({
        top: recipeListRef.current.scrollHeight,
        behavior: "smooth"
      });
    }, 100);

    toast({
      title: "Ingredient Added",
      description: `${newIngredient.name.trim()} added to recipe. Don't forget to save!`,
    });
  };

  const handleRemoveIngredient = (index: number) => {
    setRecipes(recipes.filter((_, i) => i !== index));
  };

  const handleSelectExistingIngredient = (name: string) => {
    setNewIngredient(prev => ({ ...prev, name }));
    setShowSuggestions(false);
  };

  const handleSaveRecipe = async () => {
    if (!user || !selectedProductId) return;

    setIsSaving(true);
    try {
      // Delete only this scope (generic OR a specific variant), so other
      // variants' recipes are preserved.
      let del = (supabase as any)
        .from("product_recipes")
        .delete()
        .eq("product_id", selectedProductId)
        .eq("user_id", user.id);
      if (selectedVariantId === GENERIC) del = del.is("variant_id", null);
      else del = del.eq("variant_id", selectedVariantId);

      const { error: deleteError } = await del;
      if (deleteError) throw deleteError;

      if (recipes.length > 0) {
        const tbq = parseFloat(batchQty) || 1;
        const { error: insertError } = await (supabase as any)
          .from("product_recipes")
          .insert(
            recipes.map(r => ({
              product_id: selectedProductId,
              variant_id: selectedVariantId === GENERIC ? null : selectedVariantId,
              ingredient_name: r.ingredient_name,
              quantity_required: r.quantity_required,
              unit: r.unit,
              total_batch_quantity: tbq,
              batch_unit: batchUnit || "kg",
              planned_quantity:
                r.planned_quantity != null && !Number.isNaN(Number(r.planned_quantity))
                  ? Number(r.planned_quantity)
                  : null,
              planned_unit: r.planned_unit || r.unit,
              user_id: user.id,
            }))
          );

        if (insertError) throw insertError;
      }

      // Promote any "unassigned" inventory ingredients to this product so
      // they show up under product_ingredients (and out of the unassigned pool).
      if (recipes.length > 0) {
        const recipeNames = recipes.map(r => r.ingredient_name.trim());
        const { data: invRows } = await supabase
          .from("inventory_ingredients")
          .select("ingredient_name, quantity, unit, price")
          .eq("user_id", user.id)
          .in("ingredient_name", recipeNames);

        if (invRows && invRows.length > 0) {
          const rows = invRows.map((inv: any) => {
            const qty = Number(inv.quantity) || 0;
            const price = Number(inv.price) || 0;
            return {
              user_id: user.id,
              product_id: selectedProductId,
              ingredient_name: inv.ingredient_name,
              quantity: qty,
              unit: inv.unit || "kg",
              price: price,
              unit_price: price,
              total_cost: Math.round(qty * price * 100) / 100,
              total_purchased: qty,
            };
          });
          await (supabase as any)
            .from("product_ingredients")
            .upsert(rows, { onConflict: "product_id,ingredient_name" });

          await supabase
            .from("inventory_ingredients")
            .delete()
            .eq("user_id", user.id)
            .in("ingredient_name", invRows.map((r: any) => r.ingredient_name));
        }

        // Ensure every recipe ingredient is present in product_ingredients for
        // this product (so it appears in Inventory & Ingredient Cost Update).
        // Brand-new ingredients get inserted; we try to inherit any existing
        // price from another product that uses the same ingredient.
        const { data: existingPi } = await supabase
          .from("product_ingredients")
          .select("ingredient_name")
          .eq("user_id", user.id)
          .eq("product_id", selectedProductId);
        const existingSet = new Set(
          (existingPi || []).map((r: any) => r.ingredient_name)
        );

        const missingNames = recipes
          .map(r => r.ingredient_name.trim())
          .filter(n => !existingSet.has(n));

        const priceByName = new Map<string, number>();
        if (missingNames.length > 0) {
          const { data: priorRows } = await supabase
            .from("product_ingredients")
            .select("ingredient_name, price")
            .eq("user_id", user.id)
            .in("ingredient_name", missingNames);
          (priorRows || []).forEach((r: any) => {
            if (!priceByName.has(r.ingredient_name)) {
              priceByName.set(r.ingredient_name, Number(r.price) || 0);
            }
          });
        }

        // Fetch current prices for ALL recipe ingredients so we can sync
        // quantity + unit from the recipe into product_ingredients while
        // preserving each ingredient's existing price.
        const allNames = recipes.map(r => r.ingredient_name.trim());
        const { data: currentPi } = await supabase
          .from("product_ingredients")
          .select("ingredient_name, price")
          .eq("user_id", user.id)
          .eq("product_id", selectedProductId)
          .in("ingredient_name", allNames);
        const currentPriceByName = new Map<string, number>();
        (currentPi || []).forEach((r: any) => {
          currentPriceByName.set(r.ingredient_name, Number(r.price) || 0);
        });

        const toUpsert = recipes.map(r => {
          const name = r.ingredient_name.trim();
          const qty = Number(r.quantity_required) || 0;
          const unit = r.unit || "kg";
          const price =
            currentPriceByName.get(name) ?? priceByName.get(name) ?? 0;
          return {
            user_id: user.id,
            product_id: selectedProductId,
            ingredient_name: name,
            quantity: qty,
            unit,
            price,
            unit_price: price,
            total_cost: Math.round(qty * price * 100) / 100,
            total_purchased: qty,
          };
        });

        if (toUpsert.length > 0) {
          await (supabase as any)
            .from("product_ingredients")
            .upsert(toUpsert, { onConflict: "product_id,ingredient_name" });
        }
      }

      toast({
        title: "Recipe Saved",
        description:
          selectedVariantId === GENERIC
            ? "Generic recipe saved."
            : "Variant-specific recipe saved.",
      });
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      console.error("Error saving recipe:", error);
      toast({
        title: "Error",
        description: "Failed to save recipe",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Live total batch quantity computed from ingredient rows, normalized to a single base unit.
  const computedBatch = (() => {
    if (recipes.length === 0) return null;
    const totals = new Map<string, number>();
    for (const r of recipes) {
      const b = toBaseUnit(Number(r.quantity_required) || 0, r.unit || "kg");
      totals.set(b.unit, (totals.get(b.unit) || 0) + b.quantity);
    }
    // Pick the dominant base unit (largest total)
    let bestUnit = "kg";
    let bestQty = 0;
    for (const [u, q] of totals) {
      if (q > bestQty) { bestQty = q; bestUnit = u; }
    }
    return { qty: Math.round(bestQty * 1000) / 1000, unit: bestUnit };
  })();

  // Auto-sync batch qty to the computed total whenever recipes change,
  // unless the user already typed a custom value that differs significantly.
  // Initialize batch qty from computed total only when user hasn't entered one.
  useEffect(() => {
    if (!computedBatch) return;
    const current = parseFloat(batchQty) || 0;
    if (current === 0) {
      setBatchQty(String(computedBatch.qty));
      setBatchUnit(computedBatch.unit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes.length]);

  const filteredSuggestions = existingIngredients.filter(name => {
    const matchesSearch = name.toLowerCase().includes(newIngredient.name.toLowerCase());
    const notAlreadyInRecipe = !recipes.some(
      r => r.ingredient_name.toLowerCase() === name.toLowerCase()
    );
    return matchesSearch && notAlreadyInRecipe;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col bg-popover">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            Recipe Manager
          </DialogTitle>
          <DialogDescription>
            Define ingredient requirements per unit of product
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6" ref={recipeListRef}>
          {/* Product Selection */}
          <div className="space-y-2">
            <Label>Select Product</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a product to edit recipe" />
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

          {/* Pack Size (Variant) section hidden per request
          {selectedProductId && (
            <div className="space-y-2">
              <Label>Pack Size (Variant)</Label>
              <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a pack size" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value={GENERIC}>Generic (all sizes)</SelectItem>
                  {productVariants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.size_label} ({v.pack_size}{v.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {productVariants.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  💡 Add packaging variants (1kg, 500g, etc.) from the Packaging button
                  to define different ingredient quantities per pack size.
                </p>
              )}
            </div>
          )}
          */}

          {selectedProductId && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <Label>Total Batch Output</Label>
              <p className="text-xs text-muted-foreground">
                How much finished product does this recipe yield in total? Used to compute cost per kg / L.
              </p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="e.g. 80"
                  value={batchQty}
                  onChange={(e) => setBatchQty(e.target.value)}
                  className="flex-1"
                />
                <Select value={batchUnit} onValueChange={setBatchUnit}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="g">g</SelectItem>
                    <SelectItem value="L">L</SelectItem>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="pcs">pcs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {selectedProductId && (
            <>
              {/* Add Ingredient Form */}
              <div className="space-y-2">
                <Label>Add Ingredient</Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search or type ingredient name"
                        value={newIngredient.name}
                        onChange={(e) => {
                          setNewIngredient({ ...newIngredient, name: e.target.value });
                          setShowSuggestions(e.target.value.length > 0);
                        }}
                        onFocus={() => {
                          if (newIngredient.name.length > 0 || existingIngredients.length > 0) {
                            setShowSuggestions(true);
                          }
                        }}
                        onBlur={() => {
                          // Delay to allow click on suggestion
                          setTimeout(() => setShowSuggestions(false), 200);
                        }}
                        className="pl-9"
                      />
                    </div>
                    {showSuggestions && filteredSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-auto">
                        {filteredSuggestions.map(name => (
                          <button
                            key={name}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectExistingIngredient(name);
                            }}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Input
                    type="number"
                    placeholder="Qty"
                    value={newIngredient.quantity}
                    onChange={(e) => setNewIngredient({ ...newIngredient, quantity: e.target.value })}
                    className="w-24"
                    min="0"
                    step="0.01"
                  />
                  <Select
                    value={newIngredient.unit}
                    onValueChange={(value) => setNewIngredient({ ...newIngredient, unit: value })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="L">L</SelectItem>
                      <SelectItem value="ml">ml</SelectItem>
                      <SelectItem value="pcs">pcs</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddIngredient} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {existingIngredients.length > 0 && !newIngredient.name && (
                  <p className="text-xs text-muted-foreground">
                    💡 Start typing to see suggestions from your existing inventory
                  </p>
                )}
              </div>

              {/* Recipe Table */}
              <div className="space-y-2">
                <Label>Recipe for {selectedProduct?.name} ({recipes.length} ingredients)</Label>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : recipes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                    No ingredients added yet. Add ingredients above.
                  </div>
                ) : (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead>Ingredient</TableHead>
                          <TableHead className="text-right">Quantity per Unit</TableHead>
                          <TableHead className="w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recipes.map((recipe, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{recipe.ingredient_name}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.001"
                                  value={recipe.quantity_required}
                                  onChange={(e) => {
                                    const v = parseFloat(e.target.value);
                                    setRecipes((prev) =>
                                      prev.map((r, i) =>
                                        i === index
                                          ? { ...r, quantity_required: isNaN(v) ? 0 : v }
                                          : r
                                      )
                                    );
                                  }}
                                  className="w-24 text-right font-mono"
                                />
                                <Select
                                  value={recipe.unit}
                                  onValueChange={(value) =>
                                    setRecipes((prev) =>
                                      prev.map((r, i) =>
                                        i === index ? { ...r, unit: value } : r
                                      )
                                    )
                                  }
                                >
                                  <SelectTrigger className="w-20">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-popover border-border">
                                    <SelectItem value="kg">kg</SelectItem>
                                    <SelectItem value="g">g</SelectItem>
                                    <SelectItem value="L">L</SelectItem>
                                    <SelectItem value="ml">ml</SelectItem>
                                    <SelectItem value="pcs">pcs</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveIngredient(index)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Production Plan — how much of each ingredient the user actually plans to use */}
              {false && recipes.length > 0 && (
                <div className="space-y-2">
                  <Label>Production Plan ({recipes.length} ingredients)</Label>
                  <p className="text-xs text-muted-foreground">
                    Enter the quantity of each ingredient you're planning to use for this production run.
                    Producible quantity is calculated from these values against the recipe per-unit amounts.
                  </p>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead>Ingredient</TableHead>
                          <TableHead className="text-right">Recipe / unit</TableHead>
                          <TableHead className="text-right">Planned Quantity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recipes.map((recipe, index) => (
                          <TableRow key={`plan-${index}`}>
                            <TableCell className="font-medium">{recipe.ingredient_name}</TableCell>
                            <TableCell className="text-right text-muted-foreground tabular-nums">
                              {recipe.quantity_required} {recipe.unit}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.001"
                                  placeholder="0"
                                  value={recipe.planned_quantity ?? ""}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const v = raw === "" ? null : parseFloat(raw);
                                    setRecipes((prev) =>
                                      prev.map((r, i) =>
                                        i === index
                                          ? {
                                              ...r,
                                              planned_quantity:
                                                v === null || isNaN(v) ? null : v,
                                              planned_unit: r.planned_unit || r.unit,
                                            }
                                          : r
                                      )
                                    );
                                  }}
                                  className="w-24 text-right font-mono"
                                />
                                <Select
                                  value={recipe.planned_unit || recipe.unit}
                                  onValueChange={(value) =>
                                    setRecipes((prev) =>
                                      prev.map((r, i) =>
                                        i === index ? { ...r, planned_unit: value } : r
                                      )
                                    )
                                  }
                                >
                                  <SelectTrigger className="w-20">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-popover border-border">
                                    <SelectItem value="kg">kg</SelectItem>
                                    <SelectItem value="g">g</SelectItem>
                                    <SelectItem value="L">L</SelectItem>
                                    <SelectItem value="ml">ml</SelectItem>
                                    <SelectItem value="pcs">pcs</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Save Button + Live total */}
        {selectedProductId && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
            {computedBatch ? (
              <div className="text-sm">
                <span className="text-muted-foreground">Total Batch Quantity:</span>{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {computedBatch.qty} {computedBatch.unit}
                </span>
                <span className="text-xs text-muted-foreground ml-2">(auto-calculated from ingredients)</span>
              </div>
            ) : <span />}
            <Button onClick={handleSaveRecipe} disabled={isSaving} className="gap-2">
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save Recipe"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
