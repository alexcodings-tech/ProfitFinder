import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { AIInsights } from "@/components/dashboard/AIInsights";
import { useBusinessIntelligence } from "@/hooks/useBusinessIntelligence";
import { useProducts } from "@/hooks/useProducts";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";

const Index = () => {
  const { user } = useAuth();
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
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Hello, {greeting}!</h1>
          <p className="text-sm text-muted-foreground">
            Track your profits and understand why your margins change.
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
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : products.length}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                Ingredients
              </p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : totalIngredients}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Avg Profit Margin
              </p>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  `${avgProfitMargin.toFixed(1)}%`
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* AI-Powered Insights */}
        {user && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">🧠 AI Insights</h2>
            <AIInsights />
          </section>
        )}

        {/* Profit Intelligence — commented out per request */}
        {/* {user && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">📊 Profit Intelligence</h2>
            <ProfitRootCause />
          </section>
        )} */}

        {/* Product Margin Changes — commented out per request */}

        {/* Receipt Scanner — commented out per request */}
        {/* <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Receipt Scanner</h2>
          <ReceiptScanner />
        </section> */}

        {/* Detected Items — commented out per request (part of Receipt Scanner) */}
      </div>
    </AppLayout>
  );
};

export default Index;
