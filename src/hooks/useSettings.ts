import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface UserSettings {
  id: string;
  user_id: string;
  currency: string;
  low_stock_threshold: number;
  notifications_enabled: boolean;
  default_product_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SettingsFormData {
  currency: string;
  low_stock_threshold: number;
  notifications_enabled: boolean;
  default_product_id: string | null;
}

export function useSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: settings,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["user-settings", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      // If no settings exist, create default settings
      if (!data) {
        const { data: newSettings, error: insertError } = await supabase
          .from("user_settings")
          .insert({
            user_id: user.id,
            currency: "INR",
            low_stock_threshold: 1,
            notifications_enabled: true,
            default_product_id: null,
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        return newSettings as UserSettings;
      }

      return data as UserSettings;
    },
    enabled: !!user?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async (formData: SettingsFormData) => {
      if (!user?.id || !settings?.id) {
        throw new Error("User not authenticated or settings not loaded");
      }

      const { data, error } = await supabase
        .from("user_settings")
        .update({
          currency: formData.currency,
          low_stock_threshold: formData.low_stock_threshold,
          notifications_enabled: formData.notifications_enabled,
          default_product_id: formData.default_product_id,
        })
        .eq("id", settings.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data as UserSettings;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["user-settings", user?.id], data);
      toast({
        title: "Settings saved",
        description: "Your preferences have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    settings,
    isLoading,
    error,
    refetch,
    updateSettings: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
