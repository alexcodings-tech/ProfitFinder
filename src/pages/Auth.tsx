import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Receipt, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const industries = ["Food & Beverage", "Manufacturing", "Retail", "Services", "Bakery", "Restaurant", "Other"];
const empRanges = ["1-5", "6-20", "21-50", "51-200", "200+"];

export default function AuthPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("signin");

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPwd, setSignInPwd] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    password: "",
    company_name: "",
    industry: "",
    employee_count: "",
  });

  useEffect(() => {
    if (!loading && isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: signInEmail, password: signInPwd });
    setBusy(false);
    if (error) {
      // Check if it's the admin details to provide a helpful tip
      if (signInEmail.toLowerCase() === "admin12@gmail.com") {
        toast({
          title: "Sign in failed",
          description: `${error.message}. TIP: If you just created the database, make sure 'admin12@gmail.com' exists in Supabase. Or create your account using the SignUp tab and it will get Admin access automatically!`,
          variant: "destructive"
        });
      } else {
        toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
      }
      return;
    }
    toast({ title: "Welcome back!" });
    navigate("/", { replace: true });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.password) {
      return toast({ title: "Missing fields", variant: "destructive" });
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: form.full_name,
          phone: form.phone,
          company_name: form.company_name,
          industry: form.industry,
          employee_count: form.employee_count,
        },
      },
    });
    setBusy(false);
    if (error) return toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
    toast({
      title: `Welcome, ${form.full_name}!`,
      description: form.email.toLowerCase() === "admin12@gmail.com"
        ? "Admin account created successfully! You are now logged in."
        : "Account created. Let's set up your first product."
    });
    navigate(form.email.toLowerCase() === "admin12@gmail.com" ? "/" : "/setup", { replace: true });
  };

  const handleGoogle = async () => {
    const message =
      "Google Sign-In has failed because your Supabase project (tcnlrekdngtglqscylwz) is missing the Google OAuth client secret.\n\n" +
      "To resolve this, you must configure the Google provider in your Supabase Auth Panel by entering your Google Client ID and Client Secret API keys.\n\n" +
      "Would you like to try signing in anyway?";
    const proceed = window.confirm(message);
    if (!proceed) return;

    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setBusy(false);
      toast({
        title: "Google sign-in failed",
        description: "Google provider is not configured. Go to Supabase Dashboard -> Auth -> Providers -> Google to add client ID and client secret.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-background">
      {/* Background Graphic Overlay for Auth Page */}
      <div className="absolute inset-0 -z-10">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
          style={{
            backgroundImage: `radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />
        {/* Modern decorative light blobs (Glassmorphic look) */}
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-45 -right-45 w-[650px] h-[650px] rounded-full bg-indigo-500/10 blur-[130px] pointer-events-none" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary mb-3 shadow-md">
            <Receipt className="h-6 w-6 text-primary-foreground animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Profit Finder</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Ingredient costing and margin analysis for growth
          </p>
        </div>

        <Card className="shadow-2xl border border-border/80 bg-card/85 backdrop-blur-md rounded-2xl">
          <CardHeader className="pb-3 text-center sm:text-left">
            <CardTitle className="text-xl font-bold">Get Started</CardTitle>
            <CardDescription>Sign in or create your Profit Finder account</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid grid-cols-2 w-full bg-muted/65 p-1 rounded-xl">
                <TabsTrigger value="signin" className="rounded-lg">Sign In</TabsTrigger>
                <TabsTrigger value="signup" className="rounded-lg">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-4 mt-4">
                <form onSubmit={handleSignIn} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="si-email">Email</Label>
                    <Input
                      id="si-email"
                      type="email"
                      placeholder="admin12@gmail.com"
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      required
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="si-pwd">Password</Label>
                    <Input
                      id="si-pwd"
                      type="password"
                      placeholder="••••••••"
                      value={signInPwd}
                      onChange={(e) => setSignInPwd(e.target.value)}
                      required
                      minLength={6}
                      className="rounded-lg"
                    />
                  </div>
                  <Button type="submit" className="w-full gradient-primary hover:opacity-95 font-semibold text-white py-3 rounded-lg shadow-sm mt-2 transition-all" disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : "Sign In"}
                  </Button>
                </form>

                {/* Admin Quick Entry Helper */}
                <div className="bg-muted/40 p-2.5 rounded-lg border border-border/40 text-[11px] text-muted-foreground flex flex-col gap-1">
                  <div className="flex items-center gap-1 font-semibold text-foreground/80">
                    <AlertTriangle className="h-3 w-3 text-primary" /> Admin Panel Login Quick Note:
                  </div>
                  <p>
                    Use email <span className="font-mono text-primary font-semibold select-all bg-muted px-1 py-0.5 rounded">admin12@gmail.com</span> and password <span className="font-mono text-primary font-semibold select-all bg-muted px-1 py-0.5 rounded">admin123</span> to login as administrator.
                  </p>
                </div>

                <div className="text-right">
                  <Link to="/reset-password" className="text-xs text-primary hover:underline font-medium">Forgot password?</Link>
                </div>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4 mt-4">
                <form onSubmit={handleSignUp} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Full Name *</Label>
                      <Input
                        placeholder="John Doe"
                        value={form.full_name}
                        onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                        required
                        className="rounded-lg"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Phone</Label>
                      <Input
                        type="tel"
                        placeholder="+91..."
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Password *</Label>
                    <Input
                      type="password"
                      placeholder="At least 6 characters"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                      minLength={6}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Company Name</Label>
                    <Input
                      placeholder="Acme Foods"
                      value={form.company_name}
                      onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Industry</Label>
                      <Select value={form.industry} onValueChange={(v) => setForm({ ...form, industry: v })}>
                        <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent className="bg-popover border border-border">
                          {industries.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Employees</Label>
                      <Select value={form.employee_count} onValueChange={(v) => setForm({ ...form, employee_count: v })}>
                        <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent className="bg-popover border border-border">
                          {empRanges.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" className="w-full gradient-primary hover:opacity-95 font-semibold text-white py-3 rounded-lg shadow-sm mt-4 transition-all" disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {/* <div className="relative my-5">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground font-semibold">Or</span>
              </div>
            </div>

            <Button type="button" variant="outline" className="w-full gap-2 py-5 rounded-lg border-border hover:bg-muted/50 font-medium transition-all" onClick={handleGoogle} disabled={busy}>
              <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
              Continue with Google
            </Button>
            
            <div className="mt-4 p-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 text-[10px] text-yellow-600 dark:text-yellow-400 text-center leading-normal">
              <strong>Google Sign-In Alert:</strong> Re-routing will cause an OAuth secret validation error if credentials aren't setup in your Supabase Auth Console. Use direct signup as a reliable alternative!
            </div> */}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          <Link to="/pricing" className="hover:underline font-medium hover:text-primary transition-colors">View Pricing</Link>
        </p>
      </div>
    </div>
  );
}
