import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, Users, CreditCard, Activity } from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  profile: { full_name?: string; phone?: string; company_name?: string; industry?: string; employee_count?: string } | null;
  subscription: { plan: string; status: string; started_at: string; expires_at: string | null } | null;
  roles: string[];
}

export default function Admin() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [planFilter, setPlanFilter] = useState<string>("all");
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-users");
    setLoading(false);
    if (error) return toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    setUsers((data as any)?.users || []);
  };

  useEffect(() => {
    load();
  }, []);

  const changePlan = async (userId: string, plan: "free" | "pro") => {
    const { error } = await supabase
      .from("subscriptions")
      .update({ plan, status: "active", started_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: `Plan updated to ${plan}` });
    load();
  };

  const filtered = planFilter === "all" ? users : users.filter((u) => u.subscription?.plan === planFilter);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Admin Panel
          </h1>
          <p className="text-sm text-muted-foreground">Manage clients, subscriptions, and activity.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Users</p><p className="text-2xl font-bold">{users.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pro Users</p><p className="text-2xl font-bold text-primary">{users.filter((u) => u.subscription?.plan === "pro").length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Free Users</p><p className="text-2xl font-bold">{users.filter((u) => u.subscription?.plan === "free").length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Admins</p><p className="text-2xl font-bold">{users.filter((u) => u.roles.includes("admin")).length}</p></CardContent></Card>
        </div>

        <Tabs defaultValue="clients">
          <TabsList className="grid grid-cols-3 w-full sm:w-auto">
            <TabsTrigger value="clients"><Users className="h-4 w-4 mr-1 hidden sm:inline" />Clients</TabsTrigger>
            <TabsTrigger value="subs"><CreditCard className="h-4 w-4 mr-1 hidden sm:inline" />Subscriptions</TabsTrigger>
            <TabsTrigger value="activity"><Activity className="h-4 w-4 mr-1 hidden sm:inline" />Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="clients">
            <Card>
              <CardHeader><CardTitle className="text-base">All Clients</CardTitle></CardHeader>
              <CardContent>
                {loading ? <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Industry</TableHead>
                          <TableHead>Employees</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Signup</TableHead>
                          <TableHead>Last Login</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell>{u.profile?.full_name || "—"}</TableCell>
                            <TableCell className="text-xs">{u.email}</TableCell>
                            <TableCell>{u.profile?.company_name || "—"}</TableCell>
                            <TableCell>{u.profile?.industry || "—"}</TableCell>
                            <TableCell>{u.profile?.employee_count || "—"}</TableCell>
                            <TableCell>
                              <Badge variant={u.subscription?.plan === "pro" ? "default" : "outline"}>
                                {u.subscription?.plan || "free"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-xs">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subs">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Subscriptions</CardTitle>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">All plans</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>User</TableHead><TableHead>Plan</TableHead><TableHead>Status</TableHead><TableHead>Started</TableHead><TableHead>Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {filtered.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="text-xs">{u.email}</TableCell>
                          <TableCell><Badge variant={u.subscription?.plan === "pro" ? "default" : "outline"}>{u.subscription?.plan}</Badge></TableCell>
                          <TableCell>{u.subscription?.status}</TableCell>
                          <TableCell className="text-xs">{u.subscription?.started_at ? new Date(u.subscription.started_at).toLocaleDateString() : "—"}</TableCell>
                          <TableCell>
                            {u.subscription?.plan === "free" ? (
                              <Button size="sm" onClick={() => changePlan(u.id, "pro")}>Upgrade to Pro</Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => changePlan(u.id, "free")}>Downgrade</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Signed Up</TableHead><TableHead>Last Sign In</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {[...users].sort((a, b) => (b.last_sign_in_at || "").localeCompare(a.last_sign_in_at || "")).slice(0, 20).map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="text-xs">{u.email}</TableCell>
                          <TableCell className="text-xs">{new Date(u.created_at).toLocaleString()}</TableCell>
                          <TableCell className="text-xs">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "Never"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
