import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface SaleItemInput {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface SaleRecord {
  id: string;
  customer_name: string | null;
  total: number;
  sale_date: string;
  notes: string | null;
  created_at: string;
  item_count: number;
}

export function useSales() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSales = useCallback(async () => {
    if (!user) {
      setSales([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("sales")
        .select("id, customer_name, total, sale_date, notes, created_at, sale_items(id)")
        .eq("user_id", user.id)
        .order("sale_date", { ascending: false })
        .limit(50);

      if (error) throw error;
      setSales(
        (data || []).map((s: any) => ({
          id: s.id,
          customer_name: s.customer_name,
          total: Number(s.total),
          sale_date: s.sale_date,
          notes: s.notes,
          created_at: s.created_at,
          item_count: (s.sale_items || []).length,
        }))
      );
    } catch (err) {
      console.error("fetchSales error", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const createSale = async (
    items: SaleItemInput[],
    customerName: string | null,
    saleDate: string,
    notes: string | null
  ): Promise<{ success: boolean; saleId?: string; error?: string }> => {
    if (!user) {
      toast({ title: "Sign in required", variant: "destructive" });
      return { success: false, error: "Not authenticated" };
    }
    if (items.length === 0) {
      toast({ title: "Add at least one item", variant: "destructive" });
      return { success: false, error: "No items" };
    }
    for (const it of items) {
      if (!it.product_id || it.quantity <= 0 || it.unit_price < 0) {
        toast({ title: "Invalid item", description: it.product_name, variant: "destructive" });
        return { success: false, error: "Invalid item" };
      }
    }
    setIsSaving(true);
    try {
      const total =
        Math.round(items.reduce((s, i) => s + i.quantity * i.unit_price, 0) * 100) / 100;

      const { data: sale, error: saleErr } = await supabase
        .from("sales")
        .insert({
          user_id: user.id,
          customer_name: customerName || null,
          sale_date: saleDate,
          notes: notes || null,
          total,
        })
        .select("id")
        .single();

      if (saleErr) throw saleErr;

      const rows = items.map((i) => ({
        sale_id: sale.id,
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        amount: Math.round(i.quantity * i.unit_price * 100) / 100,
      }));
      const { error: itemsErr } = await supabase.from("sale_items").insert(rows);
      if (itemsErr) {
        await supabase.from("sales").delete().eq("id", sale.id);
        throw itemsErr;
      }

      toast({ title: "Sale recorded", description: `Total ₹${total.toFixed(2)}` });
      await fetchSales();
      return { success: true, saleId: sale.id };
    } catch (err: any) {
      console.error("createSale error", err);
      toast({ title: "Failed to save sale", description: "Please try again.", variant: "destructive" });
      return { success: false, error: "Failed to save sale" };

    } finally {
      setIsSaving(false);
    }
  };

  return { sales, isLoading, isSaving, createSale, refetch: fetchSales };
}
