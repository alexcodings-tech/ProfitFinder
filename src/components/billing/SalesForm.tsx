import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ShoppingBag } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { useSales, SaleItemInput } from "@/hooks/useSales";
import { supabase } from "@/integrations/supabase/client";

interface DraftItem extends SaleItemInput {
  key: string;
}

export function SalesForm() {
  const { products, isLoading: productsLoading } = useProducts();
  const { createSale, isSaving, sales } = useSales();
  const [customer, setCustomer] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [productPrices, setProductPrices] = useState<Record<string, number>>({});

  // Load selling prices for products
  useEffect(() => {
    const load = async () => {
      if (products.length === 0) return;
      const { data } = await supabase
        .from("products")
        .select("id, selling_price")
        .in("id", products.map((p) => p.id));
      const map: Record<string, number> = {};
      (data || []).forEach((p: any) => (map[p.id] = Number(p.selling_price) || 0));
      setProductPrices(map);
    };
    load();
  }, [products]);

  const total = useMemo(
    () => items.reduce((s, i) => s + i.quantity * i.unit_price, 0),
    [items]
  );

  const addRow = () => {
    setItems((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        product_id: "",
        product_name: "",
        quantity: 1,
        unit_price: 0,
      },
    ]);
  };

  const updateRow = (key: string, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  };

  const handleProductChange = (key: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    updateRow(key, {
      product_id: productId,
      product_name: product?.name || "",
      unit_price: productPrices[productId] ?? 0,
    });
  };

  const removeRow = (key: string) =>
    setItems((prev) => prev.filter((i) => i.key !== key));

  const handleSubmit = async () => {
    const valid = items
      .filter((i) => i.product_id)
      .map<SaleItemInput>(({ key, ...rest }) => rest);
    const res = await createSale(valid, customer.trim() || null, saleDate, notes.trim() || null);
    if (res.success) {
      setItems([]);
      setCustomer("");
      setNotes("");
    }
  };

  const canSubmit = items.length > 0 && items.every((i) => i.product_id && i.quantity > 0);

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Create Sale
          </CardTitle>
          <CardDescription>Record a customer sale and track revenue.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="customer">Customer name</Label>
              <Input
                id="customer"
                placeholder="Walk-in customer"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sale-date">Sale date</Label>
              <Input
                id="sale-date"
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                placeholder="Optional"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Dish</TableHead>
                  <TableHead className="w-[100px]">Qty</TableHead>
                  <TableHead className="w-[120px]">Unit Price</TableHead>
                  <TableHead className="w-[120px] text-right">Amount</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      No items added yet
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell>
                        <Select
                          value={row.product_id}
                          onValueChange={(v) => handleProductChange(row.key, v)}
                          disabled={productsLoading}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select dish" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="1"
                          value={row.quantity || ""}
                          onChange={(e) =>
                            updateRow(row.key, { quantity: Number(e.target.value) || 0 })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="0.00"
                          value={row.unit_price || ""}
                          onChange={(e) =>
                            updateRow(row.key, { unit_price: Number(e.target.value) || 0 })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{(row.quantity * row.unit_price).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeRow(row.key)}
                          aria-label="Remove"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-4 w-4 mr-1" /> Add item
            </Button>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-2xl font-bold text-primary">₹{total.toFixed(2)}</div>
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isSaving}
            className="w-full sm:w-auto"
          >
            {isSaving ? "Saving..." : "Record Sale"}
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Recent Sales</CardTitle>
          <CardDescription>Last 50 transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <div className="text-center text-muted-foreground py-6">No sales yet</div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{new Date(s.sale_date).toLocaleDateString("en-IN")}</TableCell>
                      <TableCell>{s.customer_name || "—"}</TableCell>
                      <TableCell className="text-right">{s.item_count}</TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{s.total.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
