import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProducts } from "@/hooks/useProducts";
import { useSubscription } from "@/hooks/useSubscription";
import { InlineCostRevisionPanel } from "@/components/ocr/InlineCostRevisionPanel";
import { RecipeManager } from "@/components/production/RecipeManager";
import { ProductionCostsManager } from "@/components/production/ProductionCostsManager";
import { UpgradeModal } from "@/components/UpgradeModal";
import { DollarSign, Wrench, Package, Plus, Lock, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

const Setup = () => {
  const { products, isLoading, createProduct } = useProducts();
  const { isPro, isFree, FREE_PRODUCT_LIMIT, FREE_VISIBLE_PRODUCTS } = useSubscription();
  const [productId, setProductIdState] = useState<string>(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("setup_product_id") || "";
    return "";
  });
  const setProductId = (id: string) => {
    setProductIdState(id);
    if (typeof window !== "undefined") {
      if (id) sessionStorage.setItem("setup_product_id", id);
      else sessionStorage.removeItem("setup_product_id");
    }
  };
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [costsOpen, setCostsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [creating, setCreating] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Determine which products are locked (free plan: only first 2 visible)
  const isLocked = (index: number) => isFree && index >= FREE_VISIBLE_PRODUCTS;
  const product = products.find((p) => p.id === productId);
  const selectedIndex = products.findIndex((p) => p.id === productId);
  const isSelectedLocked = isLocked(selectedIndex);

  const handleAddClick = () => {
    if (isFree && products.length >= FREE_PRODUCT_LIMIT) {
      setUpgradeOpen(true);
      return;
    }
    setAddOpen(true);
  };

  const handleCreateProduct = async () => {
    const price = parseFloat(newPrice);
    if (!newName.trim() || !price || price <= 0) return;
    setCreating(true);
    const created: any = await createProduct(newName, price);
    setCreating(false);
    if (created?.limitReached) {
      setAddOpen(false);
      setUpgradeOpen(true);
      return;
    }
    if (created) {
      setProductId(created.id);
      setAddOpen(false);
      setNewName("");
      setNewPrice("");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Wrench className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Product Setup
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure ingredient costs, recipes, and production overheads.
          </p>
        </div>

        {isFree && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <Crown className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm">
                  <span className="font-semibold">Free plan:</span> {products.length}/{FREE_PRODUCT_LIMIT} products used.
                  {products.length > FREE_VISIBLE_PRODUCTS && " Some products are locked."}
                </p>
              </div>
              <Button size="sm" onClick={() => setUpgradeOpen(true)} className="w-full sm:w-auto">Upgrade to Pro</Button>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Select a Product
            </CardTitle>
            <CardDescription>Pick which product you'd like to set up.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select value={productId} onValueChange={setProductId} disabled={isLoading}>
                <SelectTrigger className="w-full sm:max-w-md">
                  <SelectValue placeholder="Choose a product" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {products.map((p, i) => (
                    <SelectItem key={p.id} value={p.id} disabled={isLocked(i)}>
                      <span className="flex items-center gap-2">
                        {isLocked(i) && <Lock className="h-3 w-3" />}
                        {p.name}
                        {isLocked(i) && <span className="text-xs text-muted-foreground">(Pro)</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleAddClick} className="gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Add New Product
              </Button>
            </div>
          </CardContent>
        </Card>

        {productId && product && (
          <div className="relative">
            <div className={cn(isSelectedLocked && "pointer-events-none blur-sm select-none")}>
              <Card className="shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    1. Ingredient Cost Update
                  </CardTitle>
                  <CardDescription>Enter the latest cost for each ingredient and save them to inventory.</CardDescription>
                </CardHeader>
                <CardContent>
                  <InlineCostRevisionPanel
                    productId={productId}
                    productName={product.name}
                    onIngredientsChange={() => {}}
                    onEditRecipe={() => setRecipeOpen(true)}
                  />
                </CardContent>
              </Card>
            </div>

            {isSelectedLocked && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Card className="shadow-lg max-w-sm mx-4">
                  <CardContent className="p-6 text-center space-y-3">
                    <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Lock className="h-6 w-6 text-primary" />
                    </div>
                    <p className="font-semibold">This product is locked</p>
                    <p className="text-xs text-muted-foreground">Upgrade to Pro to access all your products.</p>
                    <Button onClick={() => setUpgradeOpen(true)} className="w-full gradient-primary">Upgrade to Pro</Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="bg-popover">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
              <DialogDescription>
                Create a product, then add its ingredients below.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="new-product-name">Product Name</Label>
                <Input id="new-product-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Health Mix" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-product-price">Selling Price (₹)</Label>
                <Input id="new-product-price" type="number" min="0" step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="e.g. 500" />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)} disabled={creating} className="w-full sm:w-auto">Cancel</Button>
              <Button onClick={handleCreateProduct} disabled={creating || !newName.trim() || !newPrice} className="w-full sm:w-auto">
                {creating ? "Creating..." : "Create Product"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <UpgradeModal
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          reason={products.length >= FREE_PRODUCT_LIMIT ? "You've hit the free-plan limit of 3 products." : "Unlock access to all your products."}
        />

        <RecipeManager open={recipeOpen} onOpenChange={setRecipeOpen} products={products} initialProductId={productId} />
        <ProductionCostsManager open={costsOpen} onOpenChange={setCostsOpen} products={products} initialProductId={productId} ingredientCostPerUnit={0} />
      </div>
    </AppLayout>
  );
};

export default Setup;
