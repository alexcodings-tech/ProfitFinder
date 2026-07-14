import { useEffect, useState } from "react";
import { Package, Plus, Trash2, Star } from "lucide-react";
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
import { usePackagingVariants, PackagingVariantInput } from "@/hooks/usePackagingVariants";
import { Product } from "@/hooks/useProducts";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  initialProductId?: string;
}

const UNIT_OPTIONS = ["g", "kg", "ml", "L", "pcs"];

const blankInput = (productId: string): PackagingVariantInput => ({
  product_id: productId,
  size_label: "",
  pack_size: 0,
  unit: "g",
  cover_cost: 0,
  selling_price: 0,
  is_default: false,
});

export function PackagingVariantsManager({
  open,
  onOpenChange,
  products,
  initialProductId,
}: Props) {
  const { getForProduct, create, update, remove } = usePackagingVariants();
  const [productId, setProductId] = useState(initialProductId || "");
  const [draft, setDraft] = useState<PackagingVariantInput>(blankInput(""));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && initialProductId) setProductId(initialProductId);
  }, [open, initialProductId]);

  useEffect(() => {
    setDraft(blankInput(productId));
  }, [productId]);

  const variants = productId ? getForProduct(productId) : [];

  const handleAdd = async () => {
    if (!productId || !draft.size_label || draft.pack_size <= 0) return;
    setSaving(true);
    const ok = await create({ ...draft, product_id: productId });
    setSaving(false);
    if (ok) setDraft(blankInput(productId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-popover">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Packaging Variants
          </DialogTitle>
          <DialogDescription>
            Define different pack sizes (e.g. 1kg, 500g, 250g) — each with its own
            cover cost and selling price for accurate per-SKU profit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          {productId && (
            <>
              {variants.length > 0 && (
                <Card>
                  <CardContent className="pt-4 space-y-2">
                    {variants.map((v) => (
                      <div
                        key={v.id}
                        className="flex flex-wrap items-center gap-2 p-2 rounded-md border border-border"
                      >
                        <div className="flex-1 min-w-[120px]">
                          <div className="font-medium flex items-center gap-2">
                            {v.size_label}
                            {v.is_default && (
                              <Badge variant="outline" className="gap-1">
                                <Star className="h-3 w-3" /> Default
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {v.pack_size} {v.unit}
                          </div>
                        </div>
                        <div className="text-sm">
                          Cover ₹{Number(v.cover_cost).toFixed(2)}
                        </div>
                        <div className="text-sm">
                          MRP ₹{Number(v.selling_price).toFixed(2)}
                        </div>
                        {!v.is_default && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => update(v.id, { is_default: true })}
                          >
                            Make default
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => remove(v.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="text-sm font-semibold">Add packaging variant</div>
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-12 md:col-span-3">
                      <Label className="text-xs">Label</Label>
                      <Input
                        placeholder="e.g. 1kg pack"
                        value={draft.size_label}
                        onChange={(e) =>
                          setDraft({ ...draft, size_label: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <Label className="text-xs">Pack size</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0"
                        value={draft.pack_size === 0 ? "" : draft.pack_size}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            pack_size: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <Label className="text-xs">Unit</Label>
                      <Select
                        value={draft.unit}
                        onValueChange={(v) => setDraft({ ...draft, unit: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover">
                          {UNIT_OPTIONS.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <Label className="text-xs">Cover ₹</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        value={draft.cover_cost === 0 ? "" : draft.cover_cost}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            cover_cost: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="col-span-6 md:col-span-3">
                      <Label className="text-xs">Selling price ₹ (MRP)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        value={draft.selling_price === 0 ? "" : draft.selling_price}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            selling_price: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.is_default}
                        onChange={(e) =>
                          setDraft({ ...draft, is_default: e.target.checked })
                        }
                      />
                      Set as default variant
                    </label>
                    <Button onClick={handleAdd} disabled={saving} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add variant
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
