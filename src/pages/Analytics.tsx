import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Package, ShoppingCart, Factory, TrendingUp, TrendingDown, AlertTriangle, DollarSign } from "lucide-react";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useCostingAnalytics } from "@/hooks/useCostingAnalytics";
import { useProfitInsights } from "@/hooks/useProfitInsights";
import { useAuth } from "@/hooks/useAuth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "#8884d8", "#82ca9d", "#ffc658"];

const Analytics = () => {
  const { isAuthenticated } = useAuth();
  const { inventory, purchases, production, isLoading } = useAnalytics();
  const { costingData, isLoading: costingLoading } = useCostingAnalytics();
  const { data: profitInsights } = useProfitInsights();

  if (!isAuthenticated) {
      return (
        <AppLayout>
          <Card className="shadow-card">
            <CardContent className="py-16 text-center">
              <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Sign in Required</h3>
              <p className="text-muted-foreground">
                Please sign in to view your analytics
              </p>
            </CardContent>
          </Card>
        </AppLayout>
      );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground">
            View spending trends, inventory insights, and production metrics
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading analytics...
          </div>
        ) : (
          <Tabs defaultValue="inventory" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
              <TabsTrigger value="inventory" className="gap-2">
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Inventory</span>
              </TabsTrigger>
              <TabsTrigger value="purchases" className="gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span className="hidden sm:inline">Purchases</span>
              </TabsTrigger>
              <TabsTrigger value="production" className="gap-2">
                <Factory className="h-4 w-4" />
                <span className="hidden sm:inline">Production</span>
              </TabsTrigger>
              <TabsTrigger value="costing" className="gap-2">
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">Costing</span>
              </TabsTrigger>
            </TabsList>

            {/* Inventory Analytics */}
            <TabsContent value="inventory" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="shadow-card">
                  <CardHeader className="pb-2">
                    <CardDescription>Total Inventory Value</CardDescription>
                    <CardTitle className="text-2xl font-bold text-primary">
                      ₹{inventory.totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Package className="h-4 w-4" />
                      {inventory.totalIngredients} ingredients in stock
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-card">
                  <CardHeader className="pb-2">
                    <CardDescription>Low Stock Items</CardDescription>
                    <CardTitle className={`text-2xl font-bold ${inventory.lowStockCount > 0 ? "text-warning" : "text-success"}`}>
                      {inventory.lowStockCount}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <AlertTriangle className="h-4 w-4" />
                      {inventory.lowStockCount > 0 ? "Need attention" : "All stocked"}
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-card">
                  <CardHeader className="pb-2">
                    <CardDescription>Stock Health</CardDescription>
                    <CardTitle className="text-2xl font-bold text-success">
                      {inventory.totalIngredients > 0 
                        ? Math.round(((inventory.totalIngredients - inventory.lowStockCount) / inventory.totalIngredients) * 100)
                        : 100}%
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      Ingredients above threshold
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Purchase Analytics */}
            <TabsContent value="purchases" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="shadow-card">
                  <CardHeader className="pb-2">
                    <CardDescription>Total Spend</CardDescription>
                    <CardTitle className="text-2xl font-bold text-primary">
                      ₹{purchases.totalSpend.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <ShoppingCart className="h-4 w-4" />
                      {purchases.billCount} bills processed
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-card">
                  <CardHeader className="pb-2">
                    <CardDescription>Average Bill Value</CardDescription>
                    <CardTitle className="text-2xl font-bold">
                      ₹{purchases.billCount > 0 
                        ? (purchases.totalSpend / purchases.billCount).toLocaleString("en-IN", { minimumFractionDigits: 2 })
                        : "0.00"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      Per transaction
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Spend by Product</CardTitle>
                    <CardDescription>Purchase distribution across products</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {purchases.spendByProduct.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No purchase data available
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={purchases.spendByProduct}
                            dataKey="total"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          >
                            {purchases.spendByProduct.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number) => `₹${value.toLocaleString("en-IN")}`}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Spend Over Time</CardTitle>
                    <CardDescription>Daily purchase trends</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {purchases.spendByDate.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No purchase data available
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={purchases.spendByDate}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis 
                            dataKey="date" 
                            className="text-xs"
                            tickFormatter={(value) => new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                          />
                          <YAxis 
                            className="text-xs"
                            tickFormatter={(value) => `₹${value}`}
                          />
                          <Tooltip 
                            formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Spend"]}
                            labelFormatter={(label) => new Date(label).toLocaleDateString("en-IN")}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="total" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2}
                            dot={{ fill: "hsl(var(--primary))" }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Production Analytics */}
            <TabsContent value="production" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="shadow-card">
                  <CardHeader className="pb-2">
                    <CardDescription>Total Batches</CardDescription>
                    <CardTitle className="text-2xl font-bold text-primary">
                      {production.totalBatches}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Factory className="h-4 w-4" />
                      Production runs completed
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-card">
                  <CardHeader className="pb-2">
                    <CardDescription>Total Units Produced</CardDescription>
                    <CardTitle className="text-2xl font-bold">
                      {production.totalUnitsProduced}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      Across all products
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="text-lg">Production by Product</CardTitle>
                  <CardDescription>Units manufactured per product</CardDescription>
                </CardHeader>
                <CardContent>
                  {production.productionByProduct.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No production data available. Create batches to see analytics.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={production.productionByProduct}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip />
                        <Bar dataKey="units" fill="hsl(var(--primary))" name="Units Produced" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="batches" fill="hsl(var(--secondary))" name="Batches" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Costing Analytics - NEW */}
            <TabsContent value="costing" className="space-y-6">
              {costingLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                  Loading costing data...
                </div>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card className="shadow-card">
                      <CardHeader className="pb-2">
                        <CardDescription>Latest Avg Margin</CardDescription>
                        <CardTitle className={`text-2xl font-bold ${costingData.latestAvgMargin >= 0 ? "text-success" : "text-destructive"}`}>
                          {costingData.latestAvgMargin.toFixed(1)}%
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          {costingData.latestAvgMargin >= 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          Across all products
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-card">
                      <CardHeader className="pb-2">
                        <CardDescription>Cost Revisions</CardDescription>
                        <CardTitle className="text-2xl font-bold text-primary">
                          {costingData.totalRevisions}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <DollarSign className="h-4 w-4" />
                          Price updates recorded
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-card">
                      <CardHeader className="pb-2">
                        <CardDescription>Ingredients with Increases</CardDescription>
                        <CardTitle className="text-2xl font-bold text-destructive">
                          {profitInsights.ingredientImpacts.length}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <TrendingUp className="h-4 w-4" />
                          Tracked across recent revisions
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Multi-ingredient cost increase table */}
                  <Card className="shadow-card">
                    <CardHeader>
                      <CardTitle className="text-lg">Cost Increase Breakdown</CardTitle>
                      <CardDescription>
                        All ingredients with rising prices, sorted by impact
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {profitInsights.ingredientImpacts.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No ingredient cost increases recorded yet
                        </div>
                      ) : (
                        <>
                          {(() => {
                            const top3 = profitInsights.ingredientImpacts.slice(0, 3);
                            const totalPct = profitInsights.ingredientImpacts.reduce(
                              (s, i) => s + i.pctIncrease,
                              0
                            );
                            const top3Pct = top3.reduce((s, i) => s + i.pctIncrease, 0);
                            const share = totalPct > 0 ? (top3Pct / totalPct) * 100 : 0;
                            if (top3.length < 2) return null;
                            return (
                              <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                                <strong>Insight:</strong> These top {top3.length} ingredients (
                                {top3.map((t) => t.ingredientName).join(", ")}) are causing{" "}
                                <strong>{share.toFixed(0)}%</strong> of the total cost increase.
                              </div>
                            );
                          })()}
                          <div className="rounded-md border overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Ingredient</TableHead>
                                  <TableHead className="text-right">% Increase</TableHead>
                                  <TableHead className="text-right">Old Price</TableHead>
                                  <TableHead className="text-right">New Price</TableHead>
                                  <TableHead className="text-right">Impacted Dishes</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {profitInsights.ingredientImpacts.map((ing) => (
                                  <TableRow key={ing.ingredientName}>
                                    <TableCell className="font-medium">
                                      {ing.ingredientName}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Badge
                                        variant={
                                          ing.pctIncrease > 25
                                            ? "destructive"
                                            : ing.pctIncrease > 10
                                            ? "secondary"
                                            : "outline"
                                        }
                                      >
                                        +{ing.pctIncrease.toFixed(1)}%
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                      ₹{ing.oldPrice.toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      ₹{ing.newPrice.toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <span className="font-medium">
                                        {ing.impactedProducts.length}
                                      </span>
                                      <span className="text-xs text-muted-foreground ml-1">
                                        dish{ing.impactedProducts.length === 1 ? "" : "es"}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Profit by Product */}
                  <Card className="shadow-card">
                    <CardHeader>
                      <CardTitle className="text-lg">Profit by Product (Latest)</CardTitle>
                      <CardDescription>Current profit based on latest cost snapshots</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {costingData.profitByProduct.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No costing data yet. Save a bill with cost revision to see analytics.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={costingData.profitByProduct}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="name" className="text-xs" />
                            <YAxis className="text-xs" tickFormatter={(v) => `₹${v}`} />
                            <Tooltip formatter={(value: number) => `₹${value.toFixed(2)}`} />
                            <Bar dataKey="cost" fill="hsl(var(--destructive))" name="Cost" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="profit" fill="hsl(var(--success))" name="Profit" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>

                  {/* Margin Trend */}
                  <Card className="shadow-card">
                    <CardHeader>
                      <CardTitle className="text-lg">Margin Trend Over Time</CardTitle>
                      <CardDescription>Product margin changes across cost revisions</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {costingData.marginTrend.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No margin history available
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height={250}>
                          <LineChart data={costingData.marginTrend}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis
                              dataKey="date"
                              className="text-xs"
                              tickFormatter={(v) => new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                            />
                            <YAxis className="text-xs" tickFormatter={(v) => `${v}%`} />
                            <Tooltip
                              formatter={(value: number) => `${value.toFixed(1)}%`}
                              labelFormatter={(label) => new Date(label).toLocaleDateString("en-IN")}
                            />
                            <Line
                              type="monotone"
                              dataKey="margin"
                              stroke="hsl(var(--primary))"
                              strokeWidth={2}
                              dot={{ fill: "hsl(var(--primary))" }}
                              name="Margin %"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
};

export default Analytics;
