import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { AIInsights } from "@/components/dashboard/AIInsights";
import { useBusinessIntelligence } from "@/hooks/useBusinessIntelligence";
import { useProducts } from "@/hooks/useProducts";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";

const Index = () => {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && isAdmin && !roleLoading) {
      navigate("/admin", { replace: true });
    }
  }, [user, isAdmin, roleLoading, navigate]);

  const { totalIngredients, isLoading: statsLoading } = useDashboardStats();
  const { products, isLoading: productsLoading } = useProducts();
  const { data: bi, isLoading: biLoading } = useBusinessIntelligence();

  const isLoading = statsLoading || productsLoading || biLoading;

  const avgProfitMargin = useMemo(() => {
    const valid = bi.products.filter((p) => {
      const manuf = p.manufacturingCost > 0 ? p.manufacturingCost : p.currentCost;
      return p.sellingPrice > 0 && manuf > 0;
    });
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, p) => {
      const manuf = p.manufacturingCost > 0 ? p.manufacturingCost : p.currentCost;
      const pct = ((p.sellingPrice - manuf) / p.sellingPrice) * 100;
      return acc + pct;
    }, 0);
    return sum / valid.length;
  }, [bi.products]);

  const greeting = user?.email?.split("@")[0] || "User";

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {user ? `Hello, ${greeting}!` : "Welcome to Profit Finder"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {user
              ? "Track your profits and understand why your margins change."
              : "Sign in to access your personalized profit dashboard."}
          </p>
        </div>

        {/* Top Stat Cards: Products / Ingredients / Avg Profit Margin */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                Products
              </p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                {!user ? "—" : isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : products.length}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                Ingredients
              </p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                {!user ? "—" : isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : totalIngredients}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Avg Profit Margin
              </p>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
                {!user ? "—" : isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  `${avgProfitMargin.toFixed(1)}%`
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Guest CTA — visible only when not signed in */}
        {!user && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-primary/10 to-transparent shadow-md">
            <CardContent className="p-6 text-center space-y-3">
              <div className="text-3xl">🚀</div>
              <h2 className="text-lg font-bold text-foreground">Start Tracking Your Profits</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Sign in to create products, track ingredient costs, and unlock AI-powered profit insights tailored to your business.
              </p>
              <a
                href="/auth"
                className="inline-block mt-2 px-6 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm shadow hover:opacity-90 transition-all"
              >
                Sign In / Create Account
              </a>
            </CardContent>
          </Card>
        )}

        {/* AI-Powered Insights — only for signed-in users */}
        {user && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">🧠 AI Insights</h2>
            <AIInsights />
          </section>
        )}
      </div>
    </AppLayout>
  );
};

export default Index;
