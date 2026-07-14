import { useState, useEffect, useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, DollarSign } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";

interface CostRevisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  onConfirm: (ingredients: RecipeIngredient[], sellingPrice: number) => void;
  onSkip: () => void;
}

export function CostRevisionDialog({
  open,
  onOpenChange,
  productId,
  productName,
  onConfirm,
  onSkip,
}: CostRevisionDialogProps) {
  const { fetchRecipeWithPrices, calculateRevision, fetchSellingPrice, isLoading } =
    useCostRevision();
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (open && productId && !loaded) {
      (async () => {
        const [recipe, sp] = await Promise.all([
          fetchRecipeWithPrices(productId),
          fetchSellingPrice(productId),
        ]);
        if (recipe) setIngredients(recipe);
        setSellingPrice(sp);
        setLoaded(true);
      })();
    }
    if (!open) setLoaded(false);
  }, [open, productId]);

  const updatePrice = (index: number, newPrice: number) => {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, new_price: newPrice } : ing))
    );
  };

  const revision = useMemo(
    () => calculateRevision(ingredients, sellingPrice),
    [ingredients, sellingPrice]
  );

  const allPricesFilled = ingredients.every((i) => i.new_price > 0);
  const hasChanges = ingredients.some((i) => i.old_price !== i.new_price);

  if (isLoading || !loaded) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <div className="py-12 text-center text-muted-foreground">
            Loading recipe ingredients...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (ingredients.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>No Recipe Found</DialogTitle>
            <DialogDescription>
              {productName} has no recipe defined. Cost revision is skipped.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={onSkip}>Continue Saving</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Cost Revision — {productName}
          </DialogTitle>
          <DialogDescription>
            Update ingredient prices to reflect latest purchase costs
          </DialogDescription>
        </DialogHeader>

        {/* Selling Price */}
        <div className="space-y-2">
          <Label>Selling Price (per unit)</Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={sellingPrice || ""}
            onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
            placeholder="Enter selling price"
            className="w-48"
          />
        </div>

        {/* Ingredient Price Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold">Ingredient</TableHead>
                <TableHead className="font-semibold text-right">Qty/Unit</TableHead>
                <TableHead className="font-semibold text-right">Old Price</TableHead>
                <TableHead className="font-semibold text-right">New Price</TableHead>
                <TableHead className="font-semibold text-right">Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingredients.map((ing, idx) => {
                const diff = ing.new_price - ing.old_price;
                const diffPct =
                  ing.old_price > 0
                    ? ((diff / ing.old_price) * 100).toFixed(1)
                    : ing.new_price > 0
                    ? "NEW"
                    : "0";

                return (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{ing.ingredient_name}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {ing.quantity_required} {ing.unit}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ₹{ing.old_price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={ing.new_price || ""}
                        onChange={(e) =>
                          updatePrice(idx, parseFloat(e.target.value) || 0)
                        }
                        className="w-24 text-right ml-auto"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {diff !== 0 ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-mono",
                            diff > 0
                              ? "text-destructive border-destructive/30"
                              : "text-success border-success/30"
                          )}
                        >
                          {diff > 0 ? (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          ) : (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          )}
                          {diff > 0 ? "+" : ""}
                          {diffPct}%
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-mono text-muted-foreground">
                          <Minus className="h-3 w-3 mr-1" />
                          0%
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>


        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onSkip}>
            Skip & Save
          </Button>
          <Button
            onClick={() => onConfirm(ingredients, sellingPrice)}
            disabled={!allPricesFilled}
          >
            Confirm & Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
