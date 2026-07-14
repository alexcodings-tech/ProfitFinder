import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Factory, Loader2, Package } from "lucide-react";
import { useBusinessIntelligence } from "@/hooks/useBusinessIntelligence";

export function ProducibleBatches() {
  const { data, isLoading } = useBusinessIntelligence();

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
    return null;
  }

  const totalUnits = data.products.reduce(
    (sum, p) => sum + (Number.isFinite(p.maxProducibleUnits) ? p.maxProducibleUnits : 0),
    0
  );

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Factory className="h-4 w-4 text-primary" />
          Production Capacity
          <span className="ml-auto text-sm font-semibold text-primary tabular-nums">
            {totalUnits.toLocaleString()} productions total
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.products.map((p) => {
            const units = Number.isFinite(p.maxProducibleUnits) ? p.maxProducibleUnits : 0;
            return (
              <div
                key={p.productId}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{p.productName}</p>
                  <p className="text-lg font-bold text-foreground tabular-nums">
                    {units} <span className="text-xs font-normal text-muted-foreground">{units === 1 ? "production" : "productions"}</span>
                  </p>
                  {p.bottleneckIngredient && units === 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Blocked by: {p.bottleneckIngredient}
                    </p>
                  )}
                  {p.bottleneckIngredient && units > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Limited by {p.bottleneckIngredient}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
