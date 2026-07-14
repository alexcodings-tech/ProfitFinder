import { useState, useEffect } from "react";
import { AlertTriangle, Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface LowStockItem {
  id: string;
  product_name: string;
  ingredient_name: string;
  quantity: number;
  unit: string;
  min_stock_threshold: number;
}

interface LowStockDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LowStockDetails({ open, onOpenChange }: LowStockDetailsProps) {
  const { user } = useAuth();
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLowStockItems = async () => {
      if (!user || !open) return;

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("product_ingredients")
          .select(`
            id,
            ingredient_name,
            quantity,
            unit,
            min_stock_threshold,
            total_purchased,
            products!inner(name)
          `)
          .eq("user_id", user.id)
          .order("quantity", { ascending: true });

        if (error) throw error;

        const items: LowStockItem[] = (data || [])
          .filter((item: any) => {
            const totalPurchased = Number(item.total_purchased) || 0;
            const currentQty = Number(item.quantity);
            if (totalPurchased > 0) {
              return currentQty < totalPurchased * 0.35;
            }
            return currentQty < item.min_stock_threshold;
          })
          .map((item: any) => ({
            id: item.id,
            product_name: item.products.name,
            ingredient_name: item.ingredient_name,
            quantity: item.quantity,
            unit: item.unit,
            min_stock_threshold: Number(item.total_purchased) > 0
              ? Math.round(Number(item.total_purchased) * 0.35 * 100) / 100
              : item.min_stock_threshold,
          }));

        setLowStockItems(items);
      } catch (error) {
        console.error("Error fetching low stock items:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLowStockItems();
  }, [user, open]);

  const getStatus = (quantity: number, threshold: number) => {
    const ratio = quantity / threshold;
    if (ratio === 0) return { label: "Out of Stock", variant: "destructive" as const };
    if (ratio < 0.5) return { label: "Critical", variant: "destructive" as const };
    return { label: "Low", variant: "secondary" as const };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col bg-popover">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Low Stock Ingredients
          </DialogTitle>
          <DialogDescription>
            Ingredients below their minimum stock threshold
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading...
            </div>
          ) : lowStockItems.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-lg bg-muted/30">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                All ingredients are sufficiently stocked!
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold">Product</TableHead>
                    <TableHead className="font-semibold">Ingredient</TableHead>
                    <TableHead className="font-semibold text-right">Current Stock</TableHead>
                    <TableHead className="font-semibold text-right">Min Required</TableHead>
                    <TableHead className="font-semibold text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockItems.map((item) => {
                    const status = getStatus(item.quantity, item.min_stock_threshold);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell>{item.ingredient_name}</TableCell>
                        <TableCell className="text-right font-mono">
                          {item.quantity.toFixed(2)} {item.unit}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.min_stock_threshold.toFixed(2)} {item.unit}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={status.variant}>
                            {status.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
