import { useState, useEffect } from "react";
import { History, Package } from "lucide-react";
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
import { format } from "date-fns";

interface BatchRecord {
  id: string;
  product_name: string;
  quantity_produced: number;
  status: string;
  created_at: string;
  ingredient_cost_per_unit: number;
  overhead_cost_per_unit: number;
  total_cost_per_unit: number;
  total_batch_cost: number;
}

interface BatchHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BatchHistory({ open, onOpenChange }: BatchHistoryProps) {
  const { user } = useAuth();
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBatches = async () => {
      if (!user || !open) return;

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("batches")
          .select(`
            id,
            quantity_produced,
            status,
            created_at,
            ingredient_cost_per_unit,
            overhead_cost_per_unit,
            total_cost_per_unit,
            total_batch_cost,
            products!inner(name)
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;

        const records: BatchRecord[] = (data || []).map((batch: any) => ({
          id: batch.id,
          product_name: batch.products.name,
          quantity_produced: batch.quantity_produced,
          status: batch.status,
          created_at: batch.created_at,
          ingredient_cost_per_unit: Number(batch.ingredient_cost_per_unit) || 0,
          overhead_cost_per_unit: Number(batch.overhead_cost_per_unit) || 0,
          total_cost_per_unit: Number(batch.total_cost_per_unit) || 0,
          total_batch_cost: Number(batch.total_batch_cost) || 0,
        }));

        setBatches(records);
      } catch (error) {
        console.error("Error fetching batch history:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBatches();
  }, [user, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col bg-popover">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Production History
          </DialogTitle>
          <DialogDescription>
            Recent production batches with true cost breakdown
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading...
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-lg bg-muted/30">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No production batches yet
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold">Product</TableHead>
                    <TableHead className="font-semibold text-right">Qty</TableHead>
                    <TableHead className="font-semibold text-right">Ingred / unit</TableHead>
                    <TableHead className="font-semibold text-right">Overhead / unit</TableHead>
                    <TableHead className="font-semibold text-right">True / unit</TableHead>
                    <TableHead className="font-semibold text-right">Batch total</TableHead>
                    <TableHead className="font-semibold text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">{batch.product_name}</TableCell>
                      <TableCell className="text-right font-mono">
                        {batch.quantity_produced}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        ₹{batch.ingredient_cost_per_unit.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        ₹{batch.overhead_cost_per_unit.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        ₹{batch.total_cost_per_unit.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ₹{batch.total_batch_cost.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs">
                        {format(new Date(batch.created_at), "MMM d, HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
