import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useUserRole() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    // Client-side fallback for admin privileges
    if (user.email && (user.email.toLowerCase() === "admin12@gmail.com" || user.email.toLowerCase() === "info@zhar.in")) {
      setIsAdmin(true);
      setLoading(false);
      return;
    }

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setIsAdmin(!!data?.some((r: any) => r.role === "admin"));
        setLoading(false);
      });
  }, [user]);

  return { isAdmin, loading };
}

