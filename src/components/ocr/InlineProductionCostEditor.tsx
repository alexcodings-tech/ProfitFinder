import { useEffect, useState } from "react";
import { Calculator, Loader2, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CostMode,
  DEFAULT_PRODUCTION_COST,
  ProductionCostTemplate,
  TaxMode,
  computeProductionCost,
} from "@/lib/productionCost";
import { useProductionCosts } from "@/hooks/useProductionCosts";

interface Props {
  productId: string;
}

/**
 * Compact inline production-cost editor shown under the Ingredient Cost Update
 * panel. Exposes all overhead fields with sensible defaults — Shipping is
 * intentionally excluded.
 */
export function InlineProductionCostEditor({ productId }: Props) {
  const { getForProduct, upsert, isLoading } = useProductionCosts();
  const [tpl, setTpl] = useState<ProductionCostTemplate>(DEFAULT_PRODUCTION_COST);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (productId) setTpl(getForProduct(productId));
  }, [productId, getForProduct]);

  const update = <K extends keyof ProductionCostTemplate>(
    k: K,
    v: ProductionCostTemplate[K]
  ) => setTpl((t) => ({ ...t, [k]: v }));

  const FIELDS: { label: string; valueKey: keyof ProductionCostTemplate; modeKey: keyof ProductionCostTemplate }[] = [
    { label: "Packing cover", valueKey: "packing_cover", modeKey: "packing_cover_mode" },
    { label: "Label", valueKey: "label_cost", modeKey: "label_cost_mode" },
    { label: "Labor", valueKey: "labor_cost", modeKey: "labor_cost_mode" },
    { label: "Machine", valueKey: "machine_cost", modeKey: "machine_cost_mode" },
    { label: "Electricity (EB)", valueKey: "eb_cost", modeKey: "eb_cost_mode" },
    { label: "Utilities (water, gas)", valueKey: "utilities_cost", modeKey: "utilities_cost_mode" },
  ];

  const handleSave = async () => {
    if (!productId) return;
    setSaving(true);
    // Always persist with shipping zeroed-out (field removed by request).
    const payload: ProductionCostTemplate = {
      ...tpl,
      shipping_cost: 0,
      shipping_cost_mode: "per_unit",
    };
    await upsert(productId, payload);
    setSaving(false);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-4 bg-background">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">
            Production Cost (overheads)
          </h4>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Batch size</Label>
            <Input
              type="number"
              min={1}
              className="w-20 h-7 text-sm"
              value={tpl.default_batch_size === 1 ? "" : tpl.default_batch_size}
              placeholder="1"
              onChange={(e) =>
                update("default_batch_size", Math.max(1, parseInt(e.target.value) || 1))
              }
            />
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving || isLoading}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Save Costs
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <div key={f.valueKey} className="grid grid-cols-5 gap-2 items-end">
            <div className="col-span-3 space-y-1">
              <Label className="text-xs">{f.label} (₹)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                className="h-8 text-sm"
                value={
                  (tpl[f.valueKey] as number) === 0
                    ? ""
                    : (tpl[f.valueKey] as number)
                }
                onChange={(e) =>
                  update(f.valueKey, parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Mode</Label>
              <Select
                value={tpl[f.modeKey] as CostMode}
                onValueChange={(v) => update(f.modeKey, v as CostMode)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="per_unit">Per unit</SelectItem>
                  <SelectItem value="per_batch">Per batch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}

        {/* Tax */}
        <div className="grid grid-cols-5 gap-2 items-end sm:col-span-2 border-t border-border pt-3">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Tax</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder={tpl.tax_mode === "percent" ? "5" : "0.00"}
              className="h-8 text-sm"
              value={tpl.tax_value === 0 ? "" : tpl.tax_value}
              onChange={(e) =>
                update("tax_value", parseFloat(e.target.value) || 0)
              }
            />
          </div>
          <div className="col-span-1 space-y-1">
            <Label className="text-xs">Mode</Label>
            <Select
              value={tpl.tax_mode}
              onValueChange={(v) => update("tax_mode", v as TaxMode)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="percent">%</SelectItem>
                <SelectItem value="flat">Flat</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Basis</Label>
            <Select
              value={tpl.tax_basis}
              onValueChange={(v) => update("tax_basis", v as any)}
              disabled={tpl.tax_mode === "flat"}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="mrp">% of MRP</SelectItem>
                <SelectItem value="cost">% of cost</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Total production cost (overheads + tax) per unit */}
      {(() => {
        const computed = computeProductionCost(0, { ...tpl, shipping_cost: 0 }, tpl.default_batch_size || 1);
        return (
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm font-semibold text-foreground">Total Production Cost (per unit)</span>
            <span className="text-base font-bold text-primary tabular-nums">
              ₹{computed.overheadCostPerUnit.toFixed(2)}
            </span>
          </div>
        );
      })()}
    </div>
  );
}
