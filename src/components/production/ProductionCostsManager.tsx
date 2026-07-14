import { useCallback, useEffect, useMemo, useState } from "react";
import { Calculator, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CostMode,
  DEFAULT_PRODUCTION_COST,
  ProductionCostTemplate,
  TaxMode,
  computeProductionCost,
} from "@/lib/productionCost";
import { Product } from "@/hooks/useProducts";

export interface ProductionCostRow extends ProductionCostTemplate {
  id: string;
  product_id: string;
}

export function useProductionCosts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<ProductionCostRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setRows([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { data, error } = await (supabase as any)
      .from("product_production_costs")
      .select("*")
      .eq("user_id", user.id);
    if (error) {
      console.error("fetch production costs", error);
    } else {
      setRows((data as any) || []);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
    if (!user) return;
    const channel = supabase
      .channel("production-costs-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_production_costs" },
        () => fetchAll()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchAll]);

  const getForProduct = useCallback(
    (productId: string): ProductionCostTemplate => {
      const row = rows.find((r) => r.product_id === productId);
      return row || DEFAULT_PRODUCTION_COST;
    },
    [rows]
  );

  const upsert = async (
    productId: string,
    template: ProductionCostTemplate
  ): Promise<boolean> => {
    if (!user) return false;
    const existing = rows.find((r) => r.product_id === productId);
    const payload = {
      user_id: user.id,
      product_id: productId,
      ...template,
    };
    let error;
    if (existing) {
      ({ error } = await (supabase as any)
        .from("product_production_costs")
        .update(payload)
        .eq("id", existing.id));
    } else {
      ({ error } = await (supabase as any)
        .from("product_production_costs")
        .insert(payload));
    }
    if (error) {
      console.error("Production costs save error:", error);
      toast({
        title: "Save failed",
        description: "Could not save production costs. Please try again.",
        variant: "destructive",
      });
      return false;
    }

    toast({ title: "Production costs saved" });
    await fetchAll();
    return true;
  };

  return { rows, isLoading, getForProduct, upsert, refetch: fetchAll };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  initialProductId?: string;
  /** If provided, show what the resulting per-unit total would be */
  ingredientCostPerUnit?: number;
}

const MODE_OPTIONS: { value: CostMode; label: string }[] = [
  { value: "per_unit", label: "Per unit" },
  { value: "per_batch", label: "Per batch" },
];

type ComponentValueKey =
  | "packing_cover"
  | "label_cost"
  | "labor_cost"
  | "machine_cost"
  | "eb_cost"
  | "utilities_cost"
  | "shipping_cost";

type ComponentModeKey =
  | "packing_cover_mode"
  | "label_cost_mode"
  | "labor_cost_mode"
  | "machine_cost_mode"
  | "eb_cost_mode"
  | "utilities_cost_mode"
  | "shipping_cost_mode";

interface ComponentRowProps {
  label: string;
  valueKey: ComponentValueKey;
  modeKey: ComponentModeKey;
  tpl: ProductionCostTemplate;
  onValueChange: (key: ComponentValueKey, value: number) => void;
  onModeChange: (key: ComponentModeKey, value: CostMode) => void;
}

function ComponentRow({
  label,
  valueKey,
  modeKey,
  tpl,
  onValueChange,
  onModeChange,
}: ComponentRowProps) {
  const value = tpl[valueKey] as number;
  return (
    <div className="grid grid-cols-12 gap-2 items-end">
      <div className="col-span-5">
        <Label className="text-xs">{label}</Label>
        <Input
          type="number"
          min={0}
          step="0.01"
          placeholder="0.00"
          value={value === 0 ? "" : value}
          onChange={(e) => onValueChange(valueKey, parseFloat(e.target.value) || 0)}
        />
      </div>
      <div className="col-span-4">
        <Label className="text-xs">Mode</Label>
        <Select
          value={tpl[modeKey] as CostMode}
          onValueChange={(v) => onModeChange(modeKey, v as CostMode)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            {MODE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-3 text-right">
        <Label className="text-xs text-muted-foreground">Per unit</Label>
        <div className="font-mono text-sm h-10 flex items-center justify-end">
          ₹
          {(tpl[modeKey] === "per_unit"
            ? Number(value)
            : Number(value) / Math.max(tpl.default_batch_size, 1)
          ).toFixed(2)}
        </div>
      </div>
    </div>
  );
}

export function ProductionCostsManager({
  open,
  onOpenChange,
  products,
  initialProductId,
  ingredientCostPerUnit = 0,
}: Props) {
  const { getForProduct, upsert } = useProductionCosts();
  const [productId, setProductId] = useState<string>(initialProductId || "");
  const [tpl, setTpl] = useState<ProductionCostTemplate>(DEFAULT_PRODUCTION_COST);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && initialProductId) setProductId(initialProductId);
  }, [open, initialProductId]);

  useEffect(() => {
    if (productId) setTpl(getForProduct(productId));
  }, [productId, getForProduct, open]);

  const computed = useMemo(
    () => computeProductionCost(ingredientCostPerUnit, tpl, tpl.default_batch_size),
    [tpl, ingredientCostPerUnit]
  );

  const handleSave = async () => {
    if (!productId) return;
    setSaving(true);
    const ok = await upsert(productId, tpl);
    setSaving(false);
    if (ok) {
      onOpenChange(false);
      setTimeout(() => window.location.reload(), 500);
    }
  };

  const update = <K extends keyof ProductionCostTemplate>(
    k: K,
    v: ProductionCostTemplate[K]
  ) => setTpl((t) => ({ ...t, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-popover">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Production Costs
          </DialogTitle>
          <DialogDescription>
            Define overhead components for true per-unit cost. Per-batch costs
            are auto-divided by the typical batch size.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Default batch size (units)</Label>
              <Input
                type="number"
                min={1}
                placeholder="1"
                value={tpl.default_batch_size === 1 ? "" : tpl.default_batch_size}
                onChange={(e) =>
                  update(
                    "default_batch_size",
                    Math.max(1, parseInt(e.target.value) || 1)
                  )
                }
              />
            </div>
          </div>

          {productId && (
            <>
              <Card>
                <CardContent className="pt-6 space-y-4">
                  {([
                    ["Packing cover (₹)", "packing_cover", "packing_cover_mode"],
                    ["Label (₹)", "label_cost", "label_cost_mode"],
                    ["Labor (₹)", "labor_cost", "labor_cost_mode"],
                    ["Machine usage (₹)", "machine_cost", "machine_cost_mode"],
                    ["Electricity / EB (₹)", "eb_cost", "eb_cost_mode"],
                    ["Utilities — water, gas etc. (₹)", "utilities_cost", "utilities_cost_mode"],
                  ] as const).map(([label, vk, mk]) => (
                    <ComponentRow
                      key={vk}
                      label={label}
                      valueKey={vk}
                      modeKey={mk}
                      tpl={tpl}
                      onValueChange={update}
                      onModeChange={update}
                    />
                  ))}

                  <div className="grid grid-cols-12 gap-2 items-end pt-2 border-t border-border">
                    <div className="col-span-4">
                      <Label className="text-xs">Tax</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder={tpl.tax_mode === "percent" ? "5" : "0.00"}
                        value={tpl.tax_value === 0 ? "" : tpl.tax_value}
                        onChange={(e) =>
                          update("tax_value", parseFloat(e.target.value) || 0)
                        }
                      />
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">Mode</Label>
                      <Select
                        value={tpl.tax_mode}
                        onValueChange={(v) => update("tax_mode", v as TaxMode)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover">
                          <SelectItem value="percent">% </SelectItem>
                          <SelectItem value="flat">Flat ₹/unit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">Basis</Label>
                      <Select
                        value={tpl.tax_basis}
                        onValueChange={(v) => update("tax_basis", v as any)}
                        disabled={tpl.tax_mode === "flat"}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover">
                          <SelectItem value="mrp">% of MRP</SelectItem>
                          <SelectItem value="cost">% of cost</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 text-right">
                      <Label className="text-xs text-muted-foreground">
                        Per unit
                      </Label>
                      <div className="font-mono text-sm h-10 flex items-center justify-end">
                        ₹{computed.taxPerUnit.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Live total preview */}
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Ingredient cost / unit
                    </span>
                    <span className="font-mono">
                      ₹{computed.ingredientCostPerUnit.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Overhead (incl. tax) / unit
                    </span>
                    <span className="font-mono">
                      ₹{computed.overheadCostPerUnit.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="font-semibold">True cost / unit</span>
                    <Badge className="font-mono text-base px-3 py-1">
                      ₹{computed.totalCostPerUnit.toFixed(2)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span>
                      Batch of {tpl.default_batch_size} → total ₹
                      {computed.totalBatchCost.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save Production Costs"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
