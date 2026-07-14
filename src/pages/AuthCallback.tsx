import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  useEffect(() => {
    // Supabase JS auto-handles the hash / code. Just wait for session.
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) navigate("/", { replace: true });
      else navigate("/auth", { replace: true });
    };
    const t = setTimeout(check, 400);
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate("/", { replace: true });
    });
    return () => {
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
