import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Receipt } from "lucide-react";
import { ProductSelector } from "@/components/products/ProductSelector";
import { EditableItemsTable } from "@/components/ocr/EditableItemsTable";
import { ReceiptItem } from "@/lib/ocrParser";
import { useBillSave } from "@/hooks/useBillSave";
import { useAuth } from "@/hooks/useAuth";
import { cascadeRecalcForIngredients } from "@/lib/cascadeRecalc";

export function PurchaseForm() {
  const { user } = useAuth();
  const { saveBill, isSaving } = useBillSave();
  const [productId, setProductId] = useState<string | null>(null);
  const [supplier, setSupplier] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().split("T")[0]);
  const [items, setItems] = useState<ReceiptItem[]>([]);

  const computedTotal = useMemo(
    () => items.reduce((s, i) => s + i.amount, 0),
    [items]
  );

  const handleSave = async () => {
    if (!productId) return;
    const result = await saveBill({
      productId,
      supplierName: supplier.trim() || undefined,
      billDate,
      total: computedTotal,
      items,
    });
    if (result.success && user) {
      await cascadeRecalcForIngredients(
        user.id,
        items.map((i) => i.name),
        result.billId || null
      );
      setItems([]);
      setSupplier("");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5 text-primary" />
            Manual Supplier Bill
          </CardTitle>
          <CardDescription>
            Enter a supplier purchase manually. Inventory and product costs update automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1 md:col-span-1">
              <Label>Product</Label>
              <ProductSelector value={productId} onChange={(id) => setProductId(id)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="supplier">Supplier name</Label>
              <Input
                id="supplier"
                placeholder="Supplier"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bill-date">Bill date</Label>
              <Input
                id="bill-date"
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Bill Items</CardTitle>
          <CardDescription>Add each ingredient with quantity, unit and price.</CardDescription>
        </CardHeader>
        <CardContent>
          <EditableItemsTable
            items={items}
            ocrTotal={null}
            computedTotal={computedTotal}
            hasTotalMismatch={false}
            totalDiscrepancy={0}
            onItemsChange={setItems}
            onSave={productId ? handleSave : undefined}
            isSaving={isSaving}
          />
          {!productId && items.length > 0 && (
            <p className="text-sm text-warning mt-3">Select a product to enable saving.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
