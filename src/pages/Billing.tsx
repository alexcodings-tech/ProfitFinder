import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingBag, Receipt, Wallet } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { SalesForm } from "@/components/billing/SalesForm";
import { PurchaseForm } from "@/components/billing/PurchaseForm";

const Billing = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <Card className="shadow-card">
          <CardContent className="py-16 text-center">
            <Wallet className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sign in Required</h3>
            <p className="text-muted-foreground">Please sign in to use the billing system.</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Billing</h1>
          <p className="text-muted-foreground">
            Record customer sales and supplier purchases. Costs cascade automatically.
          </p>
        </div>

        <Tabs defaultValue="sales" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-grid">
            <TabsTrigger value="sales" className="gap-2">
              <ShoppingBag className="h-4 w-4" />
              <span>Sales</span>
            </TabsTrigger>
            <TabsTrigger value="purchases" className="gap-2">
              <Receipt className="h-4 w-4" />
              <span>Purchases</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sales">
            <SalesForm />
          </TabsContent>
          <TabsContent value="purchases">
            <PurchaseForm />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Billing;
