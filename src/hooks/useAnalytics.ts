import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface InventoryAnalytics {
  totalValue: number;
  lowStockCount: number;
  totalIngredients: number;
}

export interface PurchaseAnalytics {
  totalSpend: number;
  billCount: number;
  spendByProduct: { name: string; total: number }[];
  spendByDate: { date: string; total: number }[];
}

export interface ProductionAnalytics {
  totalBatches: number;
  totalUnitsProduced: number;
  productionByProduct: { name: string; units: number; batches: number }[];
}

export function useAnalytics(dateRange?: { start: Date; end: Date }) {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InventoryAnalytics>({
    totalValue: 0,
    lowStockCount: 0,
    totalIngredients: 0,
  });
  const [purchases, setPurchases] = useState<PurchaseAnalytics>({
    totalSpend: 0,
    billCount: 0,
    spendByProduct: [],
    spendByDate: [],
  });
  const [production, setProduction] = useState<ProductionAnalytics>({
    totalBatches: 0,
    totalUnitsProduced: 0,
    productionByProduct: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchInventoryAnalytics(),
          fetchPurchaseAnalytics(),
          fetchProductionAnalytics(),
        ]);
      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchInventoryAnalytics = async () => {
      const { data: ingredients, error } = await supabase
        .from("product_ingredients")
        .select("quantity, total_cost, min_stock_threshold")
        .eq("user_id", user.id);

      if (error) throw error;

      const totalValue = (ingredients || []).reduce((sum, i) => sum + (i.total_cost || 0), 0);
      const lowStockCount = (ingredients || []).filter(
        (i) => i.quantity < i.min_stock_threshold
      ).length;

      setInventory({
        totalValue,
        lowStockCount,
        totalIngredients: ingredients?.length || 0,
      });
    };

    const fetchPurchaseAnalytics = async () => {
      // Get bills with product info
      const { data: bills, error: billsError } = await supabase
        .from("bills")
        .select(`
          id,
          total,
          bill_date,
          created_at,
          products(name)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (billsError) throw billsError;

      const totalSpend = (bills || []).reduce((sum, b) => sum + (b.total || 0), 0);
      
      // Group by product
      const productMap = new Map<string, number>();
      (bills || []).forEach((bill: any) => {
        const productName = bill.products?.name || "Unassigned";
        productMap.set(productName, (productMap.get(productName) || 0) + (bill.total || 0));
      });
      
      const spendByProduct = Array.from(productMap.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total);

      // Group by date
      const dateMap = new Map<string, number>();
      (bills || []).forEach((bill) => {
        const date = bill.bill_date || bill.created_at?.split("T")[0] || "Unknown";
        dateMap.set(date, (dateMap.get(date) || 0) + (bill.total || 0));
      });
      
      const spendByDate = Array.from(dateMap.entries())
        .map(([date, total]) => ({ date, total }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30); // Last 30 days

      setPurchases({
        totalSpend,
        billCount: bills?.length || 0,
        spendByProduct,
        spendByDate,
      });
    };

    const fetchProductionAnalytics = async () => {
      const { data: batches, error } = await supabase
        .from("batches")
        .select(`
          id,
          quantity_produced,
          products!inner(name)
        `)
        .eq("user_id", user.id);

      if (error) throw error;

      const totalUnitsProduced = (batches || []).reduce(
        (sum, b) => sum + (b.quantity_produced || 0),
        0
      );

      // Group by product
      const productMap = new Map<string, { units: number; batches: number }>();
      (batches || []).forEach((batch: any) => {
        const productName = batch.products.name;
        const existing = productMap.get(productName) || { units: 0, batches: 0 };
        productMap.set(productName, {
          units: existing.units + (batch.quantity_produced || 0),
          batches: existing.batches + 1,
        });
      });

      const productionByProduct = Array.from(productMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.units - a.units);

      setProduction({
        totalBatches: batches?.length || 0,
        totalUnitsProduced,
        productionByProduct,
      });
    };

    fetchAnalytics();
  }, [user, dateRange?.start, dateRange?.end]);

  return { inventory, purchases, production, isLoading };
}
