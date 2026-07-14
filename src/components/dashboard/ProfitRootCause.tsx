import { useProfitInsights, ProfitInsight } from "@/hooks/useProfitInsights";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Flame,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Loader2,
  ShieldAlert,
} from "lucide-react";

export function ProfitRootCause() {
  const { data, isLoading } = useProfitInsights();

  if (isLoading) {
    return (
      <Card className="shadow-soft">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const hasData =
    data.insights.length > 0 ||
    data.marginChanges.length > 0 ||
    data.ingredientImpacts.length > 0;

  return (
    <div className="space-y-4">
      {/* Summary Banner */}
      <Card
        className={
          data.overallMarginTrend === "down"
            ? "border-destructive/30 bg-destructive/5"
            : data.overallMarginTrend === "up"
            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
            : "border-border"
        }
      >
        <CardContent className="p-4 flex items-center gap-3">
          {data.overallMarginTrend === "down" ? (
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <TrendingDown className="h-5 w-5 text-destructive" />
            </div>
          ) : data.overallMarginTrend === "up" ? (
            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Minus className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">
              {data.overallMarginTrend === "down"
                ? `⚠️ ${data.totalProductsAtRisk} product${data.totalProductsAtRisk !== 1 ? "s" : ""} with declining profits`
                : data.overallMarginTrend === "up"
                ? "✅ Margins are improving across your products"
                : "Your margins are stable — no major changes detected"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.overallMarginTrend === "down"
                ? "Ingredient cost increases are eating into your profits. Review pricing below."
                : data.overallMarginTrend === "up"
                ? "Great work! Your cost management is paying off."
                : "Keep monitoring as ingredient prices can change anytime."}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Actionable Insights */}
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Profit Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.insights.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No profit alerts yet. Insights will appear when ingredient costs change.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {data.insights.map((insight, i) => (
                  <InsightCard key={i} insight={insight} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Cost Increases */}
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500" />
              Top Cost Increases
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.ingredientImpacts.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No price increases recorded yet.
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold text-xs">Ingredient</TableHead>
                      <TableHead className="font-semibold text-xs text-right">% Increase</TableHead>
                      <TableHead className="font-semibold text-xs text-right">Old → New</TableHead>
                      <TableHead className="font-semibold text-xs text-center">Dishes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.ingredientImpacts.slice(0, 8).map((ing) => (
                      <TableRow key={ing.ingredientName}>
                        <TableCell className="font-medium text-sm py-2">
                          {ing.ingredientName}
                        </TableCell>
                        <TableCell className="text-right py-2">
                          <Badge
                            variant="outline"
                            className={
                              ing.pctIncrease > 25
                                ? "text-destructive border-destructive/30 bg-destructive/10"
                                : "text-amber-600 border-amber-300 bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:bg-amber-950/30"
                            }
                          >
                            +{ing.pctIncrease.toFixed(0)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground font-mono py-2">
                          ₹{ing.oldPrice.toFixed(0)} → ₹{ing.newPrice.toFixed(0)}
                        </TableCell>
                        <TableCell className="text-center py-2">
                          <span className="text-xs text-muted-foreground">
                            {ing.impactedProducts.length}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Product Margin Changes */}
      {data.marginChanges.length > 0 && (
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-primary" />
              Product Margin Changes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-xs">Product</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Cost / Unit</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Selling / Unit</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Margin Change</TableHead>
                    <TableHead className="font-semibold text-xs text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.marginChanges.map((m) => {
                    const unit = m.perBaseUnit || "unit";
                    const newDisp = m.newCostPerBase ?? m.newCost;
                    const sellDisp = m.sellingPricePerBase ?? m.sellingPrice;
                    return (
                    <TableRow key={m.productId}>
                      <TableCell className="font-medium text-sm py-2">{m.productName}</TableCell>
                      <TableCell className="text-right font-mono text-xs py-2">₹{newDisp.toFixed(2)}<span className="text-muted-foreground">/{unit}</span></TableCell>
                      <TableCell className="text-right font-mono text-xs py-2">₹{sellDisp.toFixed(2)}<span className="text-muted-foreground">/{unit}</span></TableCell>
                      <TableCell className="text-right py-2">
                        {m.hasBaseline ? (
                          <span
                            className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                              m.marginDelta < 0 ? "text-destructive" : m.marginDelta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                            }`}
                          >
                            {m.marginDelta < 0 ? (
                              <ArrowDownRight className="h-3 w-3" />
                            ) : m.marginDelta > 0 ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : null}
                            {m.marginDelta > 0 ? "+" : ""}
                            {m.marginDelta.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center py-2">
                        <Badge
                          variant="outline"
                          className={
                            m.newMargin < 10
                              ? "text-destructive border-destructive/30 bg-destructive/10"
                              : m.newMargin < 25
                              ? "text-amber-600 border-amber-300 bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:bg-amber-950/30"
                              : "text-emerald-600 border-emerald-300 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:bg-emerald-950/30"
                          }
                        >
                          {m.newMargin < 10 ? "Critical" : m.newMargin < 25 ? "Low" : "Healthy"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InsightCard({ insight }: { insight: ProfitInsight }) {
  const icon =
    insight.type === "margin_drop" ? (
      <TrendingDown className="h-4 w-4" />
    ) : insight.type === "cost_spike" ? (
      <AlertTriangle className="h-4 w-4" />
    ) : (
      <Lightbulb className="h-4 w-4" />
    );

  const colors =
    insight.severity === "critical"
      ? "border-destructive/20 bg-destructive/5 text-destructive"
      : insight.severity === "warning"
      ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
      : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400";

  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-lg border ${colors}`}>
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{insight.message}</p>
        {insight.detail && (
          <p className="text-xs opacity-80 mt-0.5">{insight.detail}</p>
        )}
      </div>
    </div>
  );
}
