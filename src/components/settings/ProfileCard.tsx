import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { User, Loader2, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const industries = ["Food & Beverage", "Manufacturing", "Retail", "Services", "Bakery", "Restaurant", "Other"];
const empRanges = ["1-5", "6-20", "21-50", "51-200", "200+"];

export function ProfileCard() {
  const { user } = useAuth();
  const { isPro, plan } = useSubscription();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", company_name: "", industry: "", employee_count: "" });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) setForm({
        full_name: data.full_name || "",
        phone: data.phone || "",
        company_name: data.company_name || "",
        industry: data.industry || "",
        employee_count: data.employee_count || "",
      });
      setLoading(false);
    });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({ id: user.id, email: user.email, ...form });
    setSaving(false);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Profile updated" });
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 flex-wrap">
          <User className="h-5 w-5 text-primary" /> Profile
          <Badge variant={isPro ? "default" : "outline"} className="ml-auto">
            {isPro && <Crown className="h-3 w-3 mr-1" />}
            {plan.toUpperCase()} plan
          </Badge>
        </CardTitle>
        <CardDescription>Your account and company details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Full Name</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Email</Label>
              <Input value={user?.email || ""} disabled /></div>
            <div className="space-y-1.5"><Label>Company Name</Label>
              <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Industry</Label>
                <Select value={form.industry} onValueChange={(v) => setForm({ ...form, industry: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-popover">{industries.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1.5"><Label>Employees</Label>
                <Select value={form.employee_count} onValueChange={(v) => setForm({ ...form, employee_count: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-popover">{empRanges.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
            <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Profile"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
