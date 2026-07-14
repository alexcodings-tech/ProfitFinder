import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Crown, Sparkles, Loader2, ShieldCheck, Utensils, Box, ArrowLeft } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const freeFeatures = ["Up to 3 products", "Ingredient cost tracking", "Community support"];
const proFeatures = [
  "Unlimited products",
  "Full AI Profit Insights",
  "Advanced production costing",
  "Batch history & analytics",
  "Priority email + WhatsApp support",
  "Early access to new features",
];

export default function Pricing() {
  const { isPro, refetch } = useSubscription();
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const [upgrading, setUpgrading] = useState(false);
  const navigate = useNavigate();

  const handleUpgrade = async () => {
    if (!isAuthenticated) {
      navigate("/auth", { state: { from: "/pricing" } });
      return;
    }

    setUpgrading(true);
    try {
      // Calculate exactly 1 year from the upgraded time and date
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

      const { error } = await supabase
        .from("subscriptions")
        .update({
          plan: "pro",
          status: "active",
          started_at: new Date().toISOString(),
          expires_at: oneYearFromNow.toISOString(),
        })
        .eq("user_id", user?.id);

      if (error) throw error;

      toast({
        title: "🎉 Profit Finder Pro Activated!",
        description: `Pro plan activated successfully. Expires on ${oneYearFromNow.toLocaleDateString()} at ${oneYearFromNow.toLocaleTimeString()}.`,
      });

      await refetch();

      // Short delay for the database refresh to propagate before reloading the UI
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (e: any) {
      toast({
        title: "Upgrade failed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setUpgrading(false);
    }
  };

  // Inline SVG tech mesh pattern for premium design background
  const gridSvgBackground = `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M54 48c-2 0-3 1-4 2s-2 1-4 1-3-1-4-2-2-1-4-1-3 1-4 2-2 1-4 1-3-1-4-2-2-1-4-1-3 1-4 2-2 1-4 1-3-1-4-2v-4c2 0 3-1 4-2s2-1 4-1 3 1 4 2 2 1 4 1 3-1 4-2 2-1 4-1 3 1 4 2 2 1 4 1 3-1 4-2 2-1 4-1 3 1 4 2 2 1 4 1 3-1 4-2v-4c-2 0-3 1-4 2s-2 1-4 1-3-1-4-2-2-1-4-1-3 1-4 2-2 1-4 1-3-1-4-2-2-1-4-1-3 1-4 2-2 1-4 1-3-1-4-2v-4c2 0 3-1 4-2s2-1 4-1 3 1 4 2 2 1 4 1 3-1 4-2 2-1 4-1 3 1 4 2 2 1 4 1 3-1 4-2 2-1 4-1 3 1 4 2 2 1 4 1 3-1 4-2v-4c-2 0-3 1-4 2s-2 1-4 1-3-1-4-2-2-1-4-1-3 1-4 2-2 1-4 1-3-1-4-2-2-1-4-1-3 1-4 2-2 1-4 1-3-1-4-2v-4c2 0 3-1 4-2s2-1 4-1 3 1 4 2 2 1 4 1 3-1 4-2 2-1 4-1 3 1 4 2 2 1 4 1 3-1 4-2 2-1 4-1 3 1 4 2 2 1 4 1 3-1 4-2v-4c-2 0-3 1-4 2s-2 1-4 1-3-1-4-2-2-1-4-1-3 1-4 2-2 1-4 1-3-1-4-2-2-1-4-1-3 1-4 2-2 1-4 1-3-1-4-2v-4c2 0 3-1 4-2s2-1 4-1 3 1 4 2 2 1 4 1 3-1 4-2 2-1 4-1 3 1 4 2 2 1 4 1 3-1 4-2v-4c-2 0-3 1-4 2s-2 1-4 1-3-1-4-2-2-1-4-1-3 1-4 2-2 1-4 1-3-1-4-2-2-1-4-1-3 1-4 2-2 1-4 1-3-1-4-2z' fill='%236366f1' fill-opacity='0.02' fill-rule='evenodd'/%3E%3C/svg%3E")`;


  const content = (
    <div className="relative w-full h-[calc(100vh-5rem)] md:h-[calc(100vh-6rem)] flex flex-col justify-center py-2 px-4 overflow-hidden">
      {/* Background SVG Grid and Glow Effects */}
      <div className="absolute inset-0 -z-10 bg-background">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: `radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />
        {/* Waves SVG pattern layer */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: gridSvgBackground,
          }}
        />
        {/* Glowing meshes */}
        <div className="absolute top-1/4 left-1/4 -translate-y-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-primary/10 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 translate-y-1/2 translate-x-1/2 w-[350px] h-[350px] bg-emerald-500/5 rounded-full blur-[90px] pointer-events-none" />
      </div>

      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 z-20 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        Back
      </button>

      <div className="max-w-4xl w-full mx-auto space-y-3.5 md:space-y-5 relative z-10">
        <div className="text-center space-y-1 sm:space-y-1.5">
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
            Pricing
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
            Simple pricing for <span className="gradient-primary bg-clip-text text-transparent">Profit Finder</span>
          </h1>
          <p className="max-w-md mx-auto text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
            Get instant ingredient analysis and maximize your profit margins.
          </p>
        </div>

        {/* Pricing Cards - equal height and compact sizing */}
        <div className="grid gap-4 md:grid-cols-2 max-w-3xl mx-auto items-stretch">

          {/* Free Tier Card */}
          <Card className="flex flex-col h-full bg-card/90 backdrop-blur-sm shadow-md border border-border/85 rounded-2xl relative overflow-hidden transition-all duration-300 hover:shadow-lg">
            <CardHeader className="flex-none p-4 pb-1">
              <CardTitle className="flex items-center gap-1.5 text-base font-bold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" /> Free
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-0.5 text-[10px]">Perfect for getting started</CardDescription>
              <div className="pt-1.5">
                <span className="text-2xl font-extrabold text-foreground">₹0</span>
                <span className="text-muted-foreground text-[10px] font-medium">/forever</span>
              </div>
            </CardHeader>

            <CardContent className="flex-grow flex flex-col justify-between p-4 pt-2.5 space-y-3">
              <ul className="space-y-2 flex-grow">
                {freeFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[11px] text-foreground/80 font-medium">
                    <div className="mt-0.5 rounded-full bg-emerald-500/10 p-0.5">
                      <Check className="h-2.5 w-2.5 text-emerald-500" />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>

              {/* Button container aligned at the bottom */}
              <div className="pt-1.5 mt-auto">
                {!isPro ? (
                  <div
                    className="w-full text-center bg-emerald-500 text-white font-bold py-2 px-3 rounded-xl border border-emerald-600 shadow-md flex items-center justify-center gap-1 tracking-wide text-[11px]"
                  >
                    <Check className="h-3 w-3" /> You're on this plan
                  </div>
                ) : (
                  <Button variant="outline" className="w-full py-4.5 rounded-xl text-[11px] text-muted-foreground border-border/50" disabled>
                    Free Trial Ended
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pro Tier Card */}
          <Card className="flex flex-col h-full bg-card/95 backdrop-blur-sm shadow-xl border-2 border-primary relative overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-[0_8px_30px_rgba(var(--primary),0.1)]">
            <div className="absolute top-0 right-0 bg-primary text-white text-[8px] font-extrabold px-2.5 py-1 rounded-bl-xl tracking-wider uppercase shadow-sm">
              RECOMMENDED
            </div>

            <CardHeader className="flex-none p-4 pb-1">
              <CardTitle className="flex items-center gap-1.5 text-base font-bold text-foreground">
                <Crown className="h-4 w-4 text-amber-500" /> Pro
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-0.5 text-[10px]">Unlock raw profit automation</CardDescription>
              <div className="pt-1.5">
                <div className="flex items-baseline gap-0.5">
                  <span className="text-2xl font-extrabold text-foreground">₹999</span>
                  <span className="text-muted-foreground text-[10px] font-medium">/1 Year</span>
                </div>
                <p className="text-[9px] text-muted-foreground/80 mt-0.5 font-medium">
                  + 18% GST (₹179.82) · Total ₹1,178.82 billing
                </p>
              </div>
            </CardHeader>

            <CardContent className="flex-grow flex flex-col justify-between p-4 pt-2.5 space-y-3">
              <ul className="space-y-2 flex-grow">
                {proFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[11px] text-foreground/80 font-medium">
                    <div className="mt-0.5 rounded-full bg-primary/10 p-0.5">
                      <Check className="h-2.5 w-2.5 text-primary" />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>

              {/* Trust highlights added inside Pro checkout */}
              <div className="bg-muted/50 p-2 rounded-lg border border-border/30 flex items-center justify-between text-[9px] text-muted-foreground gap-2">
                <div className="flex items-center gap-1 font-semibold text-foreground/80">
                  <ShieldCheck className="h-3 w-3 text-emerald-500" /> 7-Day Money-Back Guarantee
                </div>
                <div className="text-foreground/75 font-medium border-l border-border/60 pl-2">
                  🔒 256-Bit SSL Secure
                </div>
              </div>

              {/* Button container aligned at the bottom */}
              <div className="pt-1 mt-auto">
                {isPro ? (
                  <div
                    className="w-full text-center bg-primary/10 text-primary border border-primary/20 font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1 text-[11px]"
                  >
                    <Crown className="h-3 w-3 text-amber-500 animate-bounce" /> Active Pro Member
                  </div>
                ) : (
                  <Button
                    className="w-full gradient-primary hover:opacity-95 text-white font-bold py-4.5 rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-1 text-[11px] tracking-wide transition-all"
                    onClick={handleUpgrade}
                    disabled={upgrading}
                  >
                    {upgrading ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin text-white" />
                        Activating...
                      </>
                    ) : (
                      <>
                        <Crown className="h-3 w-3 text-white" />
                        Upgrade to Pro
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* trust and worthiness footer */}
        <div className="max-w-xl mx-auto bg-card/60 backdrop-blur-sm border border-border/40 p-2 rounded-xl flex items-center justify-around gap-2 text-center text-xs flex-wrap md:flex-nowrap">
          <div className="flex items-center gap-1 text-foreground/70 font-semibold text-[10px]">
            <Utensils className="h-3 w-3 text-primary" /> Trusted by 500+ Businesses
          </div>
          <div className="hidden sm:block text-muted-foreground/30">|</div>
          <div className="flex items-center gap-1 text-foreground/70 font-semibold text-[10px]">
            <Box className="h-3 w-3 text-primary" /> GST Compliant Invoices
          </div>
          <div className="hidden sm:block text-muted-foreground/30">|</div>
          <div className="flex items-center gap-1 text-foreground/70 font-semibold text-[10px]">
            <ShieldCheck className="h-3 w-3 text-primary" /> Razorpay Integrable
          </div>
        </div>

        <div className="text-center space-y-1">
          <p className="text-[10px] text-muted-foreground/80">
            Secure processing provided by Profit Finder. Backed by 100% money back guarantee.
          </p>
        </div>
      </div>
    </div>
  );

  if (!isAuthenticated) {
    return <div className="min-h-screen p-2 bg-background flex items-center justify-center">{content}</div>;
  }
  return <AppLayout>{content}</AppLayout>;
}
