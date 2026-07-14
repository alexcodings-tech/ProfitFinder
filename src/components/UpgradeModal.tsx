import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: string;
  onUpgraded?: () => void;
}

export function UpgradeModal({ open, onOpenChange, reason, onUpgraded }: UpgradeModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [simulating, setSimulating] = useState(false);
  // TODO(razorpay): wire actual Razorpay checkout
  const isDev = import.meta.env.DEV;

  const simulate = async () => {
    if (!user) return;
    setSimulating(true);
    const { error } = await supabase
      .from("subscriptions")
      .update({
        plan: "pro",
        status: "active",
        started_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("user_id", user.id);
    setSimulating(false);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "🎉 Pro activated!", description: "You now have unlimited access." });
    onOpenChange(false);
    onUpgraded?.();
    setTimeout(() => window.location.reload(), 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Crown className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Upgrade to Pro</DialogTitle>
          <DialogDescription className="text-center">
            {reason || "Unlock unlimited products, full insights, and all Pro features."}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Pro subscription</span>
            <span className="tabular-nums">₹999.00</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>+ 18% GST</span>
            <span className="tabular-nums">₹179.82</span>
          </div>
          <div className="flex justify-between font-semibold pt-2 border-t border-border">
            <span>Total / month</span>
            <span className="tabular-nums">₹1,178.82</span>
          </div>
        </div>

        <div className="text-xs text-muted-foreground text-center">
          <Sparkles className="inline h-3 w-3 mr-1" />
          Razorpay checkout coming soon.
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Maybe later
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              navigate("/pricing");
            }}
            className="w-full sm:w-auto"
          >
            View Pricing
          </Button>
        </DialogFooter>

        {isDev && (
          <div className="pt-2 border-t border-dashed border-border">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Dev only</p>
            <Button variant="secondary" size="sm" onClick={simulate} disabled={simulating} className="w-full">
              {simulating ? "Activating..." : "Simulate Pro activation"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
