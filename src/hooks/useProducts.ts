import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface Product {
  id: string;
  name: string;
  description: string | null;
  selling_price: number;
  created_at: string;
}

export function useProducts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    if (!user) {
      setProducts([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;
      setProducts((data as any) || []);
    } catch (error: any) {
      console.error("Error fetching products:", error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const createProduct = async (
    name: string,
    sellingPrice: number,
    description?: string
  ): Promise<Product | null> => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to create products",
        variant: "destructive",
      });
      return null;
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      toast({
        title: "Invalid Name",
        description: "Product name must be at least 2 characters",
        variant: "destructive",
      });
      return null;
    }

    if (!sellingPrice || sellingPrice <= 0) {
      toast({
        title: "Selling Price Required",
        description: "Set a selling price so we can compute margins.",
        variant: "destructive",
      });
      return null;
    }

    try {
      const { data, error } = await supabase
        .from("products")
        .insert({
          user_id: user.id,
          name: trimmedName,
          selling_price: sellingPrice,
          description: description?.trim() || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Duplicate Product",
            description: `A product named "${trimmedName}" already exists`,
            variant: "destructive",
          });
        } else if (error.message?.includes("FREE_PLAN_LIMIT")) {
          toast({
            title: "Free plan limit reached",
            description: "Upgrade to Pro to create more than 3 products.",
            variant: "destructive",
          });
          return { limitReached: true } as any;
        } else {
          throw error;
        }
        return null;
      }

      toast({
        title: "Product Created",
        description: `"${trimmedName}" added at ₹${sellingPrice}`,
      });

      await fetchProducts();
      return data as any;
    } catch (error: any) {
      console.error("Error creating product:", error);
      toast({
        title: "Error",
        description: "Failed to create product",
        variant: "destructive",
      });
      return null;
    }
  };

  return { products, isLoading, createProduct, refetch: fetchProducts };
}
