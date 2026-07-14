import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_PRODUCTION_COST, ProductionCostTemplate } from "@/lib/productionCost";

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
    const { data, error } = await (supabase as any).from("product_production_costs").select("*").eq("user_id", user.id);
    if (error) {
      console.error("fetch production costs", error);
    } else {
      setRows((data as any) || []);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
    // if (!user) return;
    // const channel = supabase
    //   .channel("production-costs-sync")
    if (!user) return;
    const channelName = `production-costs-sync-${Math.random().toString(36).substr(2, 9)}`;
    const channel = supabase
      .channel(channelName)

      .on("postgres_changes", { event: "*", schema: "public", table: "product_production_costs" }, () => fetchAll())
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
    [rows],
  );

  const upsert = async (productId: string, template: ProductionCostTemplate): Promise<boolean> => {
    if (!user) return false;
    const existing = rows.find((r) => r.product_id === productId);
    const payload = {
      user_id: user.id,
      product_id: productId,
      ...template,
    };
    let error;
    if (existing) {
      ({ error } = await (supabase as any).from("product_production_costs").update(payload).eq("id", existing.id));
    } else {
      ({ error } = await (supabase as any).from("product_production_costs").insert(payload));
    }
    if (error) {
      toast({
        title: "Save failed",
        description: error.message,
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
