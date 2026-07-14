import { useState, useEffect, useMemo } from "react";
import { Package, Search, ChevronDown, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useProducts";
import { useToast } from "@/hooks/use-toast";
import { toBaseUnit } from "@/lib/unitConversion";

interface RawItem {
  product_name: string;
  ingredient_name: string;
  quantity: number;
  unit: string;
  price: number;
}

interface AggIngredient {
  name: string;
  totalKg: number;
  costPerKg: number;
  products: string[];
}

const Inventory = () => {
  const { user } = useAuth();
  const { products } = useProducts();
  const { toast } = useToast();
  const [items, setItems] = useState<RawItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(1);

  // Add ingredient dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addProductId, setAddProductId] = useState("");
  const [addName, setAddName] = useState("");
  const [addQty, setAddQty] = useState<number>(0);
  const [addUnit, setAddUnit] = useState("kg");
  const [addPrice, setAddPrice] = useState<number>(0);
  const [isAdding, setIsAdding] = useState(false);

  // Edit ingredient dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editOriginalName, setEditOriginalName] = useState("");
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState<number>(0);
  const [isEditing, setIsEditing] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    try {
      const [ingRes, invRes, settingsRes] = await Promise.all([
        supabase
          .from("product_ingredients")
          .select(`ingredient_name, quantity, unit, price, products!inner(name)`)
          .eq("user_id", user.id),
        supabase.from("inventory_ingredients").select("ingredient_name, quantity, unit, price").eq("user_id", user.id),
        supabase.from("user_settings").select("low_stock_threshold").eq("user_id", user.id).maybeSingle(),
      ]);
      if (ingRes.error) throw ingRes.error;
      if (invRes.error) throw invRes.error;
      const fromRecipes: RawItem[] = (ingRes.data || []).map((i: any) => ({
        product_name: i.products.name,
        ingredient_name: i.ingredient_name,
        quantity: Number(i.quantity) || 0,
        unit: i.unit || "kg",
        price: Number(i.price) || 0,
      }));
      const fromInventory: RawItem[] = (invRes.data || []).map((i: any) => ({
        product_name: "",
        ingredient_name: i.ingredient_name,
        quantity: Number(i.quantity) || 0,
        unit: i.unit || "kg",
        price: Number(i.price) || 0,
      }));
      setItems([...fromRecipes, ...fromInventory]);
      setLowStockThreshold(Number(settingsRes.data?.low_stock_threshold) || 1);
    } catch (e) {
      console.error("Error fetching inventory:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleAddIngredient = async () => {
    if (!user) return;
    if (!addName.trim()) {
      toast({
        title: "Invalid ingredient",
        description: "Name is required.",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    try {
      const { error } = await supabase.from("inventory_ingredients").upsert(
        [
          {
            user_id: user.id,
            ingredient_name: addName.trim(),
            quantity: addQty,
            unit: addUnit,
            price: addPrice,
          },
        ],
        { onConflict: "user_id,ingredient_name" },
      );
      if (error) throw error;
      toast({
        title: "Ingredient added",
        description: `${addName.trim()} added to inventory. Assign it to products via Manage Recipe.`,
      });
      setAddOpen(false);
      setAddName("");
      setAddQty(0);
      setAddUnit("kg");
      setAddPrice(0);
      await fetchData();
    } catch (e: any) {
      toast({ title: "Failed to add ingredient", description: e?.message || "Try again.", variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  const openEditDialog = (name: string, costPerKg: number) => {
    setEditOriginalName(name);
    setEditName(name);
    setEditPrice(costPerKg);
    setEditOpen(true);
  };

  const handleEditIngredient = async () => {
    if (!user) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setIsEditing(true);
    try {
      // Update product_ingredients rows matching the original name
      const r1 = await supabase
        .from("product_ingredients")
        .update({ ingredient_name: trimmed, price: editPrice, unit_price: editPrice })
        .eq("user_id", user.id)
        .eq("ingredient_name", editOriginalName);
      if (r1.error) throw r1.error;

      // Update inventory_ingredients matching the original name
      const r2 = await supabase
        .from("inventory_ingredients")
        .update({ ingredient_name: trimmed, price: editPrice })
        .eq("user_id", user.id)
        .eq("ingredient_name", editOriginalName);
      if (r2.error) throw r2.error;

      // Recompute total_cost in product_ingredients (price * quantity)
      const { data: pis } = await supabase
        .from("product_ingredients")
        .select("id, quantity")
        .eq("user_id", user.id)
        .eq("ingredient_name", trimmed);
      if (pis) {
        await Promise.all(
          pis.map((p: any) =>
            supabase
              .from("product_ingredients")
              .update({ total_cost: Math.round((Number(p.quantity) || 0) * editPrice * 100) / 100 })
              .eq("id", p.id)
          )
        );
      }

      toast({ title: "Ingredient updated" });
      setEditOpen(false);
      await fetchData();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Failed to update ingredient", variant: "destructive" });
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteIngredient = async (name: string) => {
    if (!user) return;
    if (!confirm(`Delete "${name}" from all products and inventory? This cannot be undone.`)) return;
    setDeletingName(name);
    try {
      const [r1, r2] = await Promise.all([
        supabase.from("product_ingredients").delete().eq("user_id", user.id).eq("ingredient_name", name),
        supabase.from("inventory_ingredients").delete().eq("user_id", user.id).eq("ingredient_name", name),
      ]);
      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;
      toast({ title: "Ingredient deleted" });
      await fetchData();
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to delete ingredient", variant: "destructive" });
    } finally {
      setDeletingName(null);
    }
  };

  // Aggregate by ingredient name: sum kg across products + weighted-avg cost/kg
  const aggregated: AggIngredient[] = useMemo(() => {
    const map = new Map<
      string,
      { name: string; totalKg: number; totalSpend: number; lastPrice: number; products: Set<string> }
    >();
    for (const it of items) {
      const key = it.ingredient_name.trim().toLowerCase();
      if (!key) continue;
      const base = toBaseUnit(it.quantity, it.unit);
      const qtyKg = base.unit === "kg" ? base.quantity : it.quantity;
      const entry = map.get(key) || {
        name: it.ingredient_name,
        totalKg: 0,
        totalSpend: 0,
        lastPrice: 0,
        products: new Set<string>(),
      };
      entry.totalKg += qtyKg;
      entry.totalSpend += qtyKg * it.price;
      if (it.price > 0) entry.lastPrice = it.price;
      if (it.product_name) entry.products.add(it.product_name);
      map.set(key, entry);
    }
    return Array.from(map.values())
      .map((e) => ({
        name: e.name,
        totalKg: Math.round(e.totalKg * 1000) / 1000,
        costPerKg:
          e.totalKg > 0
            ? Math.round((e.totalSpend / e.totalKg) * 100) / 100
            : Math.round(e.lastPrice * 100) / 100,
        products: Array.from(e.products).sort(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const getStatus = (totalKg: number) => {
    if (totalKg <= 0)
      return {
        label: "Out of stock",
        className: "bg-destructive/10 text-destructive border-transparent hover:bg-destructive/20",
      };
    if (totalKg <= lowStockThreshold)
      return { label: "Low stock", className: "bg-warning/10 text-warning border-transparent hover:bg-warning/20" };
    return { label: "In stock", className: "bg-success/10 text-success border-transparent hover:bg-success/20" };
  };

  const filtered = aggregated.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
          <p className="text-muted-foreground">Shared ingredient stock across all products</p>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Ingredients
                </CardTitle>
                <CardDescription>{filtered.length} ingredient(s) — pooled across all products</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search ingredients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" onClick={() => setAddOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Ingredient
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading inventory...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-lg bg-muted/30">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? "No ingredients match your search" : "No ingredients yet."}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden [&>div]:overflow-x-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-table-header hover:bg-table-header">
                      <TableHead className="font-semibold">Ingredient</TableHead>
                      <TableHead className="font-semibold text-right">Cost / Unit</TableHead>
                      {/* <TableHead className="font-semibold">Status</TableHead> */}
                      <TableHead className="font-semibold">Products</TableHead>
                      <TableHead className="font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => {
                      const status = getStatus(row.totalKg);
                      return (
                        <TableRow key={row.name}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{row.name}</span>
                              {/* <span className="text-xs text-muted-foreground font-mono">{row.totalKg} kg available</span> */}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">₹{row.costPerKg.toFixed(2)}</TableCell>
                          {/* <TableCell>
                            <Badge variant="outline" className={status.className}>
                              {status.label}
                            </Badge>
                          </TableCell> */}
                          <TableCell>
                            {row.products.length === 0 ? (
                              <span className="text-xs text-muted-foreground italic">Unassigned</span>
                            ) : row.products.length === 1 ? (
                              <Badge variant="outline" className="font-normal">
                                {row.products[0]}
                              </Badge>
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-7 gap-1">
                                    {row.products.length} products
                                    <ChevronDown className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="bg-popover">
                                  <DropdownMenuLabel className="text-xs">Used in</DropdownMenuLabel>
                                  {row.products.map((p) => (
                                    <DropdownMenuItem key={p} className="text-sm">
                                      {p}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openEditDialog(row.name, row.costPerKg);
                                }}
                                title="Edit ingredient"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                disabled={deletingName === row.name}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDeleteIngredient(row.name);
                                }}
                                title="Delete ingredient"
                              >
                                {deletingName === row.name ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Ingredient Dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="bg-popover">
            <DialogHeader>
              <DialogTitle>Add New Ingredient</DialogTitle>
              <DialogDescription>Add an ingredient to your inventory.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="inv-name">Ingredient Name</Label>
                <Input
                  id="inv-name"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Sugar"
                />
              </div>
              {/* <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="inv-qty">Quantity</Label>
                  <Input
                    id="inv-qty"
                    type="number"
                    min={0}
                    step={0.01}
                    value={addQty || ""}
                    onChange={(e) => setAddQty(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-unit">Unit</Label>
                  <Select value={addUnit} onValueChange={setAddUnit}>
                    <SelectTrigger id="inv-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="L">L</SelectItem>
                      <SelectItem value="ml">ml</SelectItem>
                      <SelectItem value="pcs">pcs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div> */}
              <div className="space-y-2">
                {/* <Label htmlFor="inv-price">Price / {addUnit}</Label> */}
                <Label htmlFor="inv-price">Price / Unit</Label>
                <Input
                  id="inv-price"
                  type="number"
                  min={0}
                  step={0.01}
                  value={addPrice || ""}
                  onChange={(e) => setAddPrice(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 45.50"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)} disabled={isAdding}>
                Cancel
              </Button>
              <Button
                onClick={handleAddIngredient}
                disabled={isAdding || !addName.trim()}
              >

                {isAdding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Add Ingredient
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Ingredient Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="bg-popover">
            <DialogHeader>
              <DialogTitle>Edit Ingredient</DialogTitle>
              <DialogDescription>
                Rename or change the cost. Changes apply across all products using "{editOriginalName}".
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Ingredient Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-price">Cost / Unit (₹)</Label>
                <Input
                  id="edit-price"
                  type="number"
                  min={0}
                  step={0.01}
                  value={editPrice || ""}
                  onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={isEditing}>
                Cancel
              </Button>
              <Button onClick={handleEditIngredient} disabled={isEditing || !editName.trim()}>
                {isEditing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Inventory;
