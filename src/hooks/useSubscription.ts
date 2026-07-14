import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Plan = "free" | "pro";

export function useSubscription() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<Plan>("free");
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) {
      setPlan("free");
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("subscriptions")
      .select("plan, expires_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const dbPlan = (data?.plan as Plan) ?? "free";
    const expiresAt = data?.expires_at;

    if (dbPlan === "pro" && expiresAt && new Date(expiresAt) < new Date()) {
      // Plan has expired! Downgrade the plan to free in database
      await supabase
        .from("subscriptions")
        .update({ plan: "free", status: "active" })
        .eq("user_id", user.id);

      setPlan("free");
    } else {
      setPlan(dbPlan);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    plan,
    isPro: plan === "pro",
    isFree: plan === "free",
    loading,
    refetch: fetch,
    FREE_PRODUCT_LIMIT: 3,
    FREE_VISIBLE_PRODUCTS: 2,
  };
}

