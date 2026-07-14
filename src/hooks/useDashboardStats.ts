import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface DashboardStats {
  billsScanned: number;
  totalIngredients: number;
  totalSpend: number;
  lowStockCount: number;
  isLoading: boolean;
}

const LOW_STOCK_THRESHOLD = 1; // 1 kg/unit default threshold

export function useDashboardStats(): DashboardStats {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    billsScanned: 0,
    totalIngredients: 0,
    totalSpend: 0,
    lowStockCount: 0,
    isLoading: true,
  });

  useEffect(() => {
    if (!user) {
      setStats({
        billsScanned: 0,
        totalIngredients: 0,
        totalSpend: 0,
        lowStockCount: 0,
        isLoading: false,
      });
      return;
    }

    const fetchStats = async () => {
      try {
        // Fetch bills count and total spend
        const { data: bills, error: billsError } = await supabase
          .from("bills")
          .select("id, total")
          .eq("user_id", user.id);

        if (billsError) throw billsError;

        const billsScanned = bills?.length || 0;
        const totalSpend = bills?.reduce((sum, bill) => sum + Number(bill.total), 0) || 0;

        // Fetch unique ingredients count
        const { data: ingredients, error: ingredientsError } = await supabase
          .from("product_ingredients")
          .select("id, quantity, min_stock_threshold, total_purchased")
          .eq("user_id", user.id);

        if (ingredientsError) throw ingredientsError;

        const totalIngredients = ingredients?.length || 0;
        const lowStockCount =
          ingredients?.filter((ing) => {
            const totalPurchased = Number(ing.total_purchased) || 0;
            const currentQty = Number(ing.quantity);
            // AI analyser: low stock if current quantity < 35% of total purchased
            if (totalPurchased > 0) {
              return currentQty < totalPurchased * 0.35;
            }
            // Fallback for ingredients without purchase history
            return currentQty < (Number(ing.min_stock_threshold) || LOW_STOCK_THRESHOLD);
          }).length || 0;

        setStats({
          billsScanned,
          totalIngredients,
          totalSpend,
          lowStockCount,
          isLoading: false,
        });
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        setStats((prev) => ({ ...prev, isLoading: false }));
      }
    };

    fetchStats();

    // Subscribe to real-time updates
    // const billsChannel = supabase
    //   .channel("bills-changes")
    //   .on(
    const billsChannelName = `bills-changes-${Math.random().toString(36).substr(2, 9)}`;
    const ingredientsChannelName = `ingredients-changes-${Math.random().toString(36).substr(2, 9)}`;

    // Subscribe to real-time updates
    const billsChannel = supabase
      .channel(billsChannelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "bills" }, () => fetchStats())
      .subscribe();

    // const ingredientsChannel = supabase
    //   .channel("ingredients-changes")
    const ingredientsChannel = supabase
      .channel(ingredientsChannelName)

      .on("postgres_changes", { event: "*", schema: "public", table: "product_ingredients" }, () => fetchStats())
      .subscribe();

    return () => {
      supabase.removeChannel(billsChannel);
      supabase.removeChannel(ingredientsChannel);
    };
  }, [user]);

  return stats;
}
