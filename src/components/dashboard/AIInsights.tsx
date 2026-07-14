import { useMemo, useState } from "react";
import { useBusinessIntelligence } from "@/hooks/useBusinessIntelligence";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeModal } from "@/components/UpgradeModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Brain, Loader2, Sparkles, ArrowUpDown, ArrowUp, ArrowDown, TrendingDown, Search, Filter, Lock, Crown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type SortKey = "highest_rate" | "price" | "profit_margin" | "alphabetical";
type TierFilter = "all" | "healthy" | "mid" | "low";

export function AIInsights() {
  const { data, isLoading } = useBusinessIntelligence();
  const { isFree, FREE_VISIBLE_PRODUCTS } = useSubscription();
  const [sortKey, setSortKey] = useState<SortKey>("highest_rate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Compute profit % per product from manufacturing cost + selling price
  const enriched = useMemo(() => {
    return data.products.map((p) => {
      const manuf = p.manufacturingCost > 0 ? p.manufacturingCost : p.currentCost;
      const diff = p.sellingPrice - manuf;
      const profitPct =
        p.sellingPrice > 0 && manuf > 0 ? (diff / p.sellingPrice) * 100 : 0;
      const hasData = p.sellingPrice > 0 && manuf > 0;
      return { ...p, manuf, profitPct, hasData };
    });
  }, [data.products]);

  const sorted = useMemo(() => {
    const arr = [...enriched];
    switch (sortKey) {
      case "price":
        arr.sort((a, b) => a.sellingPrice - b.sellingPrice);
        break;
      case "profit_margin":
        arr.sort((a, b) => a.profitPct - b.profitPct);
        break;
      case "alphabetical":
        arr.sort((a, b) => a.productName.localeCompare(b.productName));
        break;
      case "highest_rate":
      default:
        arr.sort((a, b) => a.manuf - b.manuf);
        break;
    }
    if (sortDir === "desc") arr.reverse();
    return arr;
  }, [enriched, sortKey, sortDir]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    // Exclude loss products from the list; loss surfaced only in the top card.
    let arr = sorted.filter((p) => !(p.hasData && p.profitPct < 0));
    if (tierFilter !== "all") {
      arr = arr.filter((p) => {
        if (!p.hasData) return false;
        if (tierFilter === "healthy") return p.profitPct >= 45;
        if (tierFilter === "mid") return p.profitPct >= 25 && p.profitPct < 45;
        return p.profitPct < 25; // low
      });
    }
    if (q) arr = arr.filter((p) => p.productName.toLowerCase().includes(q));
    return arr;
  }, [sorted, searchQuery, tierFilter]);

  // Recompute "at loss" using manufacturing cost
  const productsAtLoss = enriched.filter((p) => p.hasData && p.profitPct < 0);

  // Worst-loss product insight
  const worstLossProduct = useMemo(() => {
    if (productsAtLoss.length === 0) return null;
    return productsAtLoss.reduce((worst, p) =>
      p.profitPct < worst.profitPct ? p : worst
    );
  }, [productsAtLoss]);

  if (isLoading) {
    return (
      <Card className="shadow-soft">
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (data.products.length === 0) {
    return (
      <Card className="shadow-soft border-dashed">
        <CardContent className="text-center py-8 text-sm text-muted-foreground">
          <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Add products with recipes & selling prices to unlock AI insights.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">


      {worstLossProduct && (
        <Card className="border-destructive/30 bg-gradient-to-r from-destructive/10 to-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
              <TrendingDown className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                Product Selling Below Cost
              </p>
              <p className="text-sm sm:text-base font-bold text-foreground truncate">
                {worstLossProduct.productName}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Selling at ₹{worstLossProduct.sellingPrice.toFixed(2)} while manufacturing cost is
                ₹{worstLossProduct.manuf.toFixed(2)}. Each unit loses{" "}
                <span className="font-semibold text-destructive">
                  ₹{(worstLossProduct.manuf - worstLossProduct.sellingPrice).toFixed(2)}
                </span>{" "}
                ({worstLossProduct.profitPct.toFixed(1)}% margin). Raise the selling price or lower
                production costs to fix this.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              Product Profitability
            </CardTitle>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search product..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs w-full sm:w-[180px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as TierFilter)}>
                  <SelectTrigger className="h-8 w-full sm:w-[150px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">All profits</SelectItem>
                    <SelectItem value="healthy">Healthy (&ge;45%)</SelectItem>
                    <SelectItem value="mid">Mid (25–45%)</SelectItem>
                    <SelectItem value="low">Low (&lt;25%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                  <SelectTrigger className="h-8 w-full sm:w-[180px] text-xs">
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="highest_rate">Manufacturing cost</SelectItem>
                    <SelectItem value="price">Selling price</SelectItem>
                    <SelectItem value="profit_margin">Profit margin</SelectItem>
                    <SelectItem value="alphabetical">Alphabetical</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                  title={sortDir === "asc" ? "Ascending — click for descending" : "Descending — click for ascending"}
                >
                  {sortDir === "asc" ? (
                    <ArrowUp className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDown className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 max-h-[720px] overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">
              No products match your search.
            </p>
          )}
          {filtered.map((p, idx) => {
            const locked = isFree && idx >= FREE_VISIBLE_PRODUCTS;
            const status = !p.hasData
              ? { label: "No data", cls: "text-muted-foreground border-border bg-muted/40" }
              : p.profitPct >= 45
              ? {
                  label: "Healthy",
                  cls:
                    "text-emerald-600 border-emerald-300 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:bg-emerald-950/30",
                }
              : p.profitPct >= 25
              ? {
                  label: "Mid",
                  cls:
                    "text-amber-600 border-amber-300 bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:bg-amber-950/30",
                }
              : {
                  label: "Low",
                  cls: "text-destructive border-destructive/40 bg-destructive/10",
                };

            const isProfit = p.profitPct >= 0;

            return (
              <div key={p.productId} className="relative">
                <div
                  className={cn(
                    "rounded-lg border border-border p-3 bg-card space-y-2",
                    locked && "blur-sm pointer-events-none select-none"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-foreground">{p.productName}</p>
                    <Badge variant="outline" className={status.cls}>
                      {status.label}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center px-2 py-1.5 rounded-md border border-border bg-muted/40 min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold truncate">
                        Selling Price
                      </p>
                      <p className="text-xs sm:text-sm font-semibold tabular-nums text-foreground">
                        ₹{p.sellingPrice.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-center px-2 py-1.5 rounded-md border border-primary/20 bg-primary/10 min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-primary font-semibold truncate">
                        Mfg Cost
                      </p>
                      <p className="text-xs sm:text-sm font-semibold tabular-nums text-foreground">
                        ₹{p.manuf.toFixed(2)}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "text-center px-2 py-1.5 rounded-md border min-w-0",
                        !p.hasData
                          ? "border-border bg-muted/40"
                          : isProfit
                          ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                          : "bg-destructive/10 border-destructive/20"
                      )}
                    >
                      <p className={cn("text-[10px] uppercase tracking-wide font-semibold truncate", !p.hasData ? "text-muted-foreground" : isProfit ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
                        Profit %
                      </p>
                      <p className={cn("text-xs sm:text-sm font-semibold tabular-nums", !p.hasData ? "text-muted-foreground" : isProfit ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
                        {p.hasData ? `${p.profitPct.toFixed(1)}%` : "—"}
                      </p>
                    </div>
                  </div>
                </div>
                {locked && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Button size="sm" onClick={() => setUpgradeOpen(true)} className="gap-2 shadow-lg">
                      <Lock className="h-3 w-3" /> Upgrade to view
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          {isFree && filtered.length > FREE_VISIBLE_PRODUCTS && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <p className="text-xs sm:text-sm flex items-center gap-2">
                <Crown className="h-4 w-4 text-primary shrink-0" />
                {filtered.length - FREE_VISIBLE_PRODUCTS} more products locked on Free plan.
              </p>
              <Button size="sm" onClick={() => setUpgradeOpen(true)} className="w-full sm:w-auto">Upgrade to Pro</Button>
            </div>
          )}
        </CardContent>
      </Card>
      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} reason="Unlock full Product Profitability insights." />
    </div>
  );
}
