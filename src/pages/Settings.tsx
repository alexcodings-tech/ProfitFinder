import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, Bell, IndianRupee, Package, AlertTriangle, Loader2, Save } from "lucide-react";
import { useSettings, SettingsFormData } from "@/hooks/useSettings";
import { useProducts } from "@/hooks/useProducts";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ProfileCard } from "@/components/settings/ProfileCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CURRENCIES = [
  { value: "INR", label: "₹ Indian Rupee (INR)" },
  { value: "USD", label: "$ US Dollar (USD)" },
  { value: "EUR", label: "€ Euro (EUR)" },
  { value: "GBP", label: "£ British Pound (GBP)" },
];

const Settings = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { settings, isLoading, updateSettings, isUpdating } = useSettings();
  const { products, isLoading: productsLoading } = useProducts();

  const [formData, setFormData] = useState<SettingsFormData>({
    currency: "INR",
    low_stock_threshold: 1,
    notifications_enabled: true,
    default_product_id: null,
  });

  // Sync form data when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        currency: settings.currency,
        low_stock_threshold: settings.low_stock_threshold,
        notifications_enabled: settings.notifications_enabled,
        default_product_id: settings.default_product_id,
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings(formData);
  };

  const hasChanges = settings && (
    formData.currency !== settings.currency ||
    formData.low_stock_threshold !== settings.low_stock_threshold ||
    formData.notifications_enabled !== settings.notifications_enabled ||
    formData.default_product_id !== settings.default_product_id
  );

  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground">
              Configure your account and preferences
            </p>
          </div>
          <Card className="shadow-card">
            <CardContent className="py-16">
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Sign in required
                </h3>
                <p className="text-muted-foreground">
                  Please sign in to access your settings.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          {/* <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground">
              Configure your account and preferences
            </p>
          </div> */}
          <div />
          <Button

            onClick={handleSave}
            disabled={isUpdating || !hasChanges}
            className="gap-2"
          >
            {isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>

        {isLoading ? (
          <Card className="shadow-card">
            <CardContent className="py-16 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            <ProfileCard />
            {/* General Settings */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon className="h-5 w-5 text-primary" />
                  General Settings
                </CardTitle>
                <CardDescription>
                  Configure your general application preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Currency */}
                <div className="space-y-2">
                  <Label htmlFor="currency" className="flex items-center gap-2">
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                    Currency
                  </Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                  >
                    <SelectTrigger id="currency" className="w-full md:w-64">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((currency) => (
                        <SelectItem key={currency.value} value={currency.value}>
                          {currency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Currency used for displaying costs and prices
                  </p>
                </div>

                {/* Default Product */}
                <div className="space-y-2">
                  <Label htmlFor="default-product" className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    Default Product
                  </Label>
                  <Select
                    value={formData.default_product_id || "none"}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      default_product_id: value === "none" ? null : value
                    }))}
                  >
                    <SelectTrigger id="default-product" className="w-full md:w-64">
                      <SelectValue placeholder="Select default product" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No default product</SelectItem>
                      {products?.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Automatically selected when scanning bills
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Inventory Settings */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                  Inventory Alerts
                </CardTitle>
                <CardDescription>
                  Configure low stock warnings and thresholds
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Low Stock Threshold */}
                <div className="space-y-2">
                  <Label htmlFor="low-stock" className="flex items-center gap-2">
                    Low Stock Threshold
                  </Label>
                  <Input
                    id="low-stock"
                    type="number"
                    min={0}
                    step={0.1}
                    value={formData.low_stock_threshold}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      low_stock_threshold: parseFloat(e.target.value) || 0
                    }))}
                    className="w-full md:w-64"
                  />
                  <p className="text-sm text-muted-foreground">
                    Get warnings when ingredient stock falls below this value (in kg)
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Notification Settings */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  Notifications
                </CardTitle>
                <CardDescription>
                  Manage your notification preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notifications">Enable Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive alerts for low stock and production events
                    </p>
                  </div>
                  <Switch
                    id="notifications"
                    checked={formData.notifications_enabled}
                    onCheckedChange={(checked) => setFormData(prev => ({
                      ...prev,
                      notifications_enabled: checked
                    }))}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Settings;
