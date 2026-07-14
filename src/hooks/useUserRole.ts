import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [prevUserId, setPrevUserId] = useState<string | null>(null);

  // If user ID changed (meaning login/logout/session load), reset loading and admin flags synchronously
  const currentUserId = user?.id || null;
  if (currentUserId !== prevUserId) {
    setPrevUserId(currentUserId);
    setLoading(true);
    setIsAdmin(false);
  }

  useEffect(() => {
    if (authLoading) return;

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
  }, [user, authLoading]);

  return { isAdmin, loading: loading || authLoading };
}

