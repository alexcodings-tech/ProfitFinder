import { useState } from "react";
import { Receipt, Package, TrendingUp, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { LowStockDetails } from "@/components/dashboard/LowStockDetails";

export function StatsCards() {
  const { billsScanned, totalIngredients, totalSpend, lowStockCount, isLoading } = useDashboardStats();
  const [showLowStockDetails, setShowLowStockDetails] = useState(false);

  const stats = [
    {
      label: "Bills Scanned",
      value: isLoading ? "..." : billsScanned.toString(),
      subtext: "Total bills",
      icon: Receipt,
      color: "text-primary",
      bgColor: "bg-primary/10",
      clickable: false,
    },
    {
      label: "Ingredients",
      value: isLoading ? "..." : totalIngredients.toString(),
      subtext: "In inventory",
      icon: Package,
      color: "text-accent",
      bgColor: "bg-accent/10",
      clickable: false,
    },
    {
      label: "Total Spend",
      value: isLoading ? "..." : `₹${totalSpend.toLocaleString()}`,
      subtext: "All time",
      icon: TrendingUp,
      color: "text-success",
      bgColor: "bg-success/10",
      clickable: false,
    },
    {
      label: "Low Stock",
      value: isLoading ? "..." : lowStockCount.toString(),
      subtext: "Click to view details",
      icon: AlertTriangle,
      color: lowStockCount > 0 ? "text-destructive" : "text-warning",
      bgColor: lowStockCount > 0 ? "bg-destructive/10" : "bg-warning/10",
      clickable: true,
      onClick: () => setShowLowStockDetails(true),
    },
  ];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card 
            key={stat.label} 
            className={cn(
              "shadow-soft hover:shadow-card transition-shadow",
              stat.clickable && "cursor-pointer hover:ring-2 hover:ring-primary/20"
            )}
            onClick={stat.onClick}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">
                    {isLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : (
                      stat.value
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.subtext}</p>
                </div>
                <div className={cn("p-2 rounded-lg", stat.bgColor)}>
                  <stat.icon className={cn("h-5 w-5", stat.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <LowStockDetails 
        open={showLowStockDetails} 
        onOpenChange={setShowLowStockDetails} 
      />
    </>
  );
}
