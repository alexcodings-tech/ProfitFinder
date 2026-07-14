import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface PackagingVariant {
  id: string;
  user_id: string;
  product_id: string;
  size_label: string;
  pack_size: number;
  unit: string;
  cover_cost: number;
  selling_price: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type PackagingVariantInput = Omit<PackagingVariant, "id" | "user_id" | "created_at" | "updated_at">;

export function usePackagingVariants() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [variants, setVariants] = useState<PackagingVariant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setVariants([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { data, error } = await (supabase as any)
      .from("product_packaging_variants")
      .select("*")
      .eq("user_id", user.id)
      .order("pack_size", { ascending: false });
    if (error) console.error("fetch variants", error);
    else setVariants((data as any) || []);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
    // if (!user) return;
    // const channel = supabase
    //   .channel("packaging-variants-sync")
    if (!user) return;
    const channelName = `packaging-variants-sync-${Math.random().toString(36).substr(2, 9)}`;
    const channel = supabase
      .channel(channelName)

      .on("postgres_changes", { event: "*", schema: "public", table: "product_packaging_variants" }, () => fetchAll())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchAll]);

  const getForProduct = useCallback(
    (productId: string) => variants.filter((v) => v.product_id === productId),
    [variants],
  );

  const getDefaultForProduct = useCallback(
    (productId: string) => {
      const list = variants.filter((v) => v.product_id === productId);
      return list.find((v) => v.is_default) || list[0] || null;
    },
    [variants],
  );

  const create = async (input: PackagingVariantInput) => {
    if (!user) return false;
    // If marking as default, clear others first
    if (input.is_default) {
      await (supabase as any)
        .from("product_packaging_variants")
        .update({ is_default: false })
        .eq("product_id", input.product_id)
        .eq("user_id", user.id);
    }
    const { error } = await (supabase as any).from("product_packaging_variants").insert({ ...input, user_id: user.id });
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Variant added" });
    await fetchAll();
    return true;
  };

  const update = async (id: string, patch: Partial<PackagingVariantInput>) => {
    if (!user) return false;
    if (patch.is_default) {
      const v = variants.find((x) => x.id === id);
      if (v) {
        await (supabase as any)
          .from("product_packaging_variants")
          .update({ is_default: false })
          .eq("product_id", v.product_id)
          .eq("user_id", user.id);
      }
    }
    const { error } = await (supabase as any).from("product_packaging_variants").update(patch).eq("id", id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return false;
    }
    await fetchAll();
    return true;
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("product_packaging_variants").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Variant removed" });
    await fetchAll();
    return true;
  };

  return { variants, isLoading, getForProduct, getDefaultForProduct, create, update, remove, refetch: fetchAll };
}
