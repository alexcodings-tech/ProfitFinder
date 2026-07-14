import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ProfitByProduct {
  name: string;
  cost: number;
  profit: number;
  margin: number;
}

interface MarginTrend {
  date: string;
  margin: number;
}

interface CostingData {
  latestAvgMargin: number;
  totalRevisions: number;
  topCostIncrease: string;
  profitByProduct: ProfitByProduct[];
  marginTrend: MarginTrend[];
}

export function useCostingAnalytics() {
  const { user } = useAuth();
  const [costingData, setCostingData] = useState<CostingData>({
    latestAvgMargin: 0,
    totalRevisions: 0,
    topCostIncrease: "",
    profitByProduct: [],
    marginTrend: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchCostingAnalytics = async () => {
      setIsLoading(true);
      try {
        // Fetch latest snapshots per product
        const { data: snapshots, error: snapError } = await supabase
          .from("product_cost_snapshots")
          .select("*, products!inner(name)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (snapError) throw snapError;

        // Fetch cost history for top increase
        const { data: costHistory, error: histError } = await supabase
          .from("ingredient_cost_history")
          .select("ingredient_name, old_price, new_price")
          .eq("user_id", user.id);

        if (histError) throw histError;

        // Latest snapshot per product (deduplicated)
        const latestByProduct = new Map<string, any>();
        (snapshots || []).forEach((s: any) => {
          const name = s.products.name;
          if (!latestByProduct.has(name)) {
            latestByProduct.set(name, s);
          }
        });

        const profitByProduct: ProfitByProduct[] = Array.from(latestByProduct.entries()).map(
          ([name, s]) => ({
            name,
            cost: s.new_total_cost,
            profit: s.new_profit,
            margin: s.new_margin,
          })
        );

        // Average margin
        const margins = profitByProduct.map((p) => p.margin);
        const latestAvgMargin =
          margins.length > 0
            ? margins.reduce((a, b) => a + b, 0) / margins.length
            : 0;

        // Top cost increase ingredient
        let topIncrease = "";
        let maxDiff = 0;
        (costHistory || []).forEach((h) => {
          const diff = h.new_price - h.old_price;
          if (diff > maxDiff) {
            maxDiff = diff;
            topIncrease = h.ingredient_name;
          }
        });

        // Margin trend (all snapshots over time)
        const marginTrend: MarginTrend[] = (snapshots || [])
          .map((s: any) => ({
            date: s.created_at.split("T")[0],
            margin: s.new_margin,
          }))
          .reverse();

        setCostingData({
          latestAvgMargin,
          totalRevisions: costHistory?.length || 0,
          topCostIncrease: topIncrease,
          profitByProduct,
          marginTrend,
        });
      } catch (error) {
        console.error("Error fetching costing analytics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCostingAnalytics();
  }, [user]);

  return { costingData, isLoading };
}
