import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, Users, UserCheck, UserX, Crown, Search, ArrowUpDown, RefreshCw, BarChart3 } from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart as ReBarChart,
  Bar as ReBar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from "recharts";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"name" | "date" | "plan">("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [edgeError, setEdgeError] = useState<string | null>(null);
  const [currentUserInfo, setCurrentUserInfo] = useState<any>(null);
  const [dbAdminCheck, setDbAdminCheck] = useState<{ hasRole: boolean; checked: boolean }>({ hasRole: false, checked: false });
  const { toast } = useToast();

  const ADMIN_EMAILS = ["admin12@gmail.com", "info@zhar.in"];

  const load = async () => {
    setLoading(true);

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setCurrentUserInfo(currentUser);

    // Self-insert admin role if not already present (handles first-time admin login)
    if (currentUser && ADMIN_EMAILS.includes(currentUser.email?.toLowerCase() || "")) {
      await supabase
        .from("user_roles")
        .upsert({ user_id: currentUser.id, role: "admin" }, { onConflict: "user_id,role" });
    }

    // Try edge function first
    const { data, error } = await supabase.functions.invoke("admin-users");
    setLoading(false);

    if (!error) {
      setUsers((data as any)?.users || []);
      setEdgeError(null);
      return;
    }

    setEdgeError(error.message || JSON.stringify(error));

    // Fall back to reading profiles and subscriptions directly
    toast({
      title: "Loading limited admin view",
      description: "Edge function unavailable. Showing basic local database data.",
    });

    const [{ data: subs }, { data: profiles, error: profsError }] = await Promise.all([
      supabase.from("subscriptions").select("user_id, plan, status, started_at, expires_at"),
      supabase.from("profiles").select("*")
    ]);

    if (currentUser) {
      const { data: roleCheck } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser.id);

      setDbAdminCheck({
        hasRole: !!roleCheck?.some((r: any) => r.role === "admin"),
        checked: true
      });
    }

    if (profsError) {
      toast({ title: "Failed to load clients", description: profsError.message, variant: "destructive" });
      return;
    }

    const fallbackUsers: AdminUser[] = (profiles || []).map((p: any) => {
      const sub = subs?.find((s: any) => s.user_id === p.id) || null;
      return {
        id: p.id,
        email: p.email || "No Email",
        created_at: p.created_at || new Date().toISOString(),
        last_sign_in_at: null,
        profile: {
          full_name: p.full_name || undefined,
          phone: p.phone || undefined,
          company_name: p.company_name || undefined,
          industry: p.industry || undefined,
          employee_count: p.employee_count || undefined
        },
        subscription: sub ? {
          plan: sub.plan,
          status: sub.status,
          started_at: sub.started_at,
          expires_at: sub.expires_at
        } : {
          plan: "free",
          status: "inactive",
          started_at: p.created_at || new Date().toISOString(),
          expires_at: null
        },
        roles: [],
      };
    });
    setUsers(fallbackUsers);
  };

  useEffect(() => {
    load();
  }, []);

  // --- Derived data ---
  // If the client has no name, use the email ID as the name
  const getClientName = (u: AdminUser) => u.profile?.full_name || u.email || "Unknown";

  const isSubscribed = (u: AdminUser) =>
    u.subscription?.plan === "pro" && u.subscription?.status === "active";

  const subscribedClients = users.filter(isSubscribed);
  const nonSubscribedClients = users.filter((u) => !isSubscribed(u));

  // --- Sorting ---
  const handleSort = (field: "name" | "date" | "plan") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortUsers = (list: AdminUser[]) => {
    const sorted = [...list].sort((a, b) => {
      if (sortField === "name") return getClientName(a).localeCompare(getClientName(b));
      if (sortField === "date") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortField === "plan") return (a.subscription?.plan || "free").localeCompare(b.subscription?.plan || "free");
      return 0;
    });
    return sortAsc ? sorted : sorted.reverse();
  };

  const filterUsers = (list: AdminUser[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (u) =>
        getClientName(u).toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.profile?.company_name || "").toLowerCase().includes(q)
    );
  };

  const processUsers = (list: AdminUser[]) => sortUsers(filterUsers(list));

  // --- Chart / Analytics Processing ---
  // 1. Subscription Distribution Data (Pie Chart)
  const pieData = [
    { name: "Pro Plan", value: subscribedClients.length, color: "#f59e0b" },
    { name: "Free Plan", value: nonSubscribedClients.length, color: "#64748b" }
  ].filter(item => item.value > 0);

  // 2. Signup Trends over time (Bar Chart)
  const signupMap = users.reduce((acc, user) => {
    try {
      const date = new Date(user.created_at);
      const label = date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      acc[label] = (acc[label] || 0) + 1;
    } catch { }
    return acc;
  }, {} as Record<string, number>);

  const signupChartData = Object.entries(signupMap)
    .map(([date, count]) => ({ date, count }))
    .slice(-6); // Last 6 months

  // 3. Industry Breakdown Data (Bar Chart)
  const industryMap = users.reduce((acc, curr) => {
    const ind = curr.profile?.industry || "Unspecified";
    acc[ind] = (acc[ind] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const industryChartData = Object.entries(industryMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Top 5 industries

  // --- Table renderer ---
  const SortButton = ({ field, label }: { field: "name" | "date" | "plan"; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sortField === field ? "text-primary" : "opacity-40"}`} />
    </button>
  );

  const ClientTable = ({ data, emptyMessage }: { data: AdminUser[]; emptyMessage: string }) => {
    const processed = processUsers(data);
    if (processed.length === 0) {
      return (
        <div className="py-12 text-center">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{searchQuery ? "No clients match your search." : emptyMessage}</p>
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[200px]"><SortButton field="name" label="Client Name" /></TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead><SortButton field="plan" label="Plan" /></TableHead>
              <TableHead>Status</TableHead>
              <TableHead><SortButton field="date" label="Joined" /></TableHead>
              <TableHead>Last Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processed.map((u) => (
              <TableRow key={u.id} className="group">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {getClientName(u).slice(0, 2).toUpperCase()}
                    </div>
                    <span className="truncate max-w-[160px]" title={getClientName(u)}>
                      {getClientName(u)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
                <TableCell className="text-sm">{u.profile?.company_name || <span className="text-muted-foreground/50">—</span>}</TableCell>
                <TableCell className="text-sm">{u.profile?.industry || <span className="text-muted-foreground/50">—</span>}</TableCell>
                <TableCell>
                  <Badge
                    variant={u.subscription?.plan === "pro" ? "default" : "outline"}
                    className={u.subscription?.plan === "pro"
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 gap-1"
                      : "text-muted-foreground"
                    }
                  >
                    {u.subscription?.plan === "pro" && <Crown className="h-3 w-3" />}
                    {(u.subscription?.plan || "free").toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.subscription?.status === "active" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                    }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${u.subscription?.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/40"
                      }`} />
                    {u.subscription?.status || "inactive"}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {u.last_sign_in_at
                    ? new Date(u.last_sign_in_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                    : <span className="text-muted-foreground/50">Never</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" /> Client Management & Analytics
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Monitor registered users, plans, and signup distribution statistics.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2 self-start animate-fade-in">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Warning card for Edge Function or DB configuration issues */}
        {edgeError && (
          <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/60 shadow-sm rounded-xl">
            <CardContent className="p-4 flex gap-3">
              <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-850 dark:text-amber-300">
                <p className="font-semibold text-amber-900 dark:text-amber-450">Edge Function Offline / Error</p>
                <p className="mt-0.5">
                  The <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900 rounded font-mono text-xs">admin-users</code> Edge Function returned an error: <span className="font-semibold">{edgeError}</span>.
                </p>
                {dbAdminCheck.checked && !dbAdminCheck.hasRole && (
                  <div className="mt-3 pl-3 border-l-2 border-rose-500 text-rose-800 dark:text-rose-350">
                    <p className="font-semibold text-rose-900 dark:text-rose-450">🚨 Database Admin Privilege Missing</p>
                    <p className="mt-0.5">
                      Your account (<span className="font-semibold">{currentUserInfo?.email}</span>) is not marked as an <code className="font-mono text-xs">admin</code> in the database <code className="font-mono text-xs">user_roles</code> table.
                      Because Row-Level Security (RLS) is active, you are only allowed to read your own client profile details (showing exactly 1 client: yourself).
                    </p>
                    <p className="mt-2">
                      To fix this, please run the following SQL script inside the <b>SQL Editor</b> of your Supabase dashboard:
                    </p>
                    <pre className="mt-1.5 p-2 bg-rose-50 dark:bg-rose-950/50 border border-rose-200/50 text-rose-900 dark:text-rose-300 rounded font-mono text-[10.5px] select-all overflow-x-auto whitespace-pre-wrap">
                      {`INSERT INTO public.user_roles (user_id, role) VALUES ('${currentUserInfo?.id || "your-user-id"}', 'admin') ON CONFLICT DO NOTHING;`}
                    </pre>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-900/20 border-blue-200/60 dark:border-blue-800/40 shadow-sm transition-all hover:shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Total Clients</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-0.5">{loading ? "—" : users.length}</p>
                </div>
                <Users className="h-8 w-8 text-blue-400/45" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 border-emerald-200/60 dark:border-emerald-800/40 shadow-sm transition-all hover:shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Subscribed</p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">{loading ? "—" : subscribedClients.length}</p>
                </div>
                <UserCheck className="h-8 w-8 text-emerald-400/45" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-950/40 dark:to-slate-900/20 border-slate-200/60 dark:border-slate-700/40 shadow-sm transition-all hover:shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Non-Subscribed</p>
                  <p className="text-2xl font-bold text-slate-700 dark:text-slate-300 mt-0.5">{loading ? "—" : nonSubscribedClients.length}</p>
                </div>
                <UserX className="h-8 w-8 text-slate-400/35" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-orange-100/50 dark:from-amber-950/40 dark:to-orange-900/20 border-amber-200/60 dark:border-amber-800/40 shadow-sm transition-all hover:shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Pro Plan</p>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-0.5">{loading ? "—" : users.filter((u) => u.subscription?.plan === "pro").length}</p>
                </div>
                <Crown className="h-8 w-8 text-amber-400/45" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Client Tabs & Analytics */}
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/60" />
            <p className="text-sm text-muted-foreground mt-3">Loading clients...</p>
          </div>
        ) : (
          <Tabs defaultValue="all" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <TabsList className="bg-muted/65 p-1 rounded-xl w-fit self-start">
                <TabsTrigger value="all" className="rounded-lg gap-1.5 data-[state=active]:shadow-sm">
                  <Users className="h-3.5 w-3.5" />
                  All Clients
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] rounded-md">{users.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="subscribed" className="rounded-lg gap-1.5 data-[state=active]:shadow-sm">
                  <UserCheck className="h-3.5 w-3.5" />
                  Subscribed
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] rounded-md">{subscribedClients.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="non-subscribed" className="rounded-lg gap-1.5 data-[state=active]:shadow-sm">
                  <UserX className="h-3.5 w-3.5" />
                  Non-Subscribed
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] rounded-md">{nonSubscribedClients.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="analytics" className="rounded-lg gap-1.5 data-[state=active]:shadow-sm">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Charts & Analytics
                </TabsTrigger>
              </TabsList>

              <TabsContent value="analytics" className="m-0" />
              {/* Only show search bar if we are NOT on the charts/analytics tab */}
              <TabsContent value="all" className="m-0">
                <div className="relative max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 rounded-lg"
                  />
                </div>
              </TabsContent>
              <TabsContent value="subscribed" className="m-0">
                <div className="relative max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search subscribed..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 rounded-lg"
                  />
                </div>
              </TabsContent>
              <TabsContent value="non-subscribed" className="m-0">
                <div className="relative max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search non-subscribed..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 rounded-lg"
                  />
                </div>
              </TabsContent>
            </div>

            <TabsContent value="all">
              <Card className="border-border/60 shadow-sm rounded-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">All Clients</CardTitle>
                  <CardDescription className="text-xs">Complete list of all registered clients on the platform.</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ClientTable data={users} emptyMessage="No clients have registered yet." />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="subscribed">
              <Card className="border-emerald-200/40 dark:border-emerald-800/30 shadow-sm rounded-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-emerald-500" /> Subscribed Clients
                  </CardTitle>
                  <CardDescription className="text-xs">Clients with an active Pro subscription.</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ClientTable data={subscribedClients} emptyMessage="No clients are currently subscribed to Pro." />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="non-subscribed">
              <Card className="border-slate-200/40 dark:border-slate-700/30 shadow-sm rounded-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserX className="h-4 w-4 text-slate-400" /> Non-Subscribed Clients
                  </CardTitle>
                  <CardDescription className="text-xs">Clients on the free plan or without an active subscription.</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ClientTable data={nonSubscribedClients} emptyMessage="All clients are subscribed!" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              {/* Charts grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* 1. Subscription Pie Chart */}
                <Card className="border-border/60 shadow-sm rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Crown className="h-4 w-4 text-amber-500" /> Subscription Share
                    </CardTitle>
                    <CardDescription className="text-xs">Breakdown of Pro versus Free plans.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80 flex items-center justify-center">
                    {pieData.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No subscription data available.</p>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center">
                        <ResponsiveContainer width="100%" height="80%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={4}
                              dataKey="value"
                              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => [`${value} Clients`, 'Count']} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex gap-4 mt-2 justify-center text-xs">
                          {pieData.map((d) => (
                            <div key={d.name} className="flex items-center gap-1.5">
                              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                              <span className="text-muted-foreground font-medium">{d.name} ({d.value})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 2. Signup Trends Bar Chart */}
                <Card className="border-border/60 shadow-sm rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" /> Signup History
                    </CardTitle>
                    <CardDescription className="text-xs">Weekly/monthly cohort of new registrations.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    {signupChartData.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-sm text-muted-foreground">No signup trends database available.</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <ReBarChart data={signupChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                          <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                          <Tooltip formatter={(value) => [`${value} Signups`, 'Registrations']} />
                          <ReBar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={25} />
                        </ReBarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* 3. Industry breakdown horizontal chart */}
                <Card className="border-border/60 shadow-sm rounded-xl md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-indigo-500" /> Distribution by Business Industry
                    </CardTitle>
                    <CardDescription className="text-xs">Top business sectors selected by registered clients.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                    {industryChartData.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-sm text-muted-foreground">No industry data available.</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <ReBarChart
                          data={industryChartData}
                          layout="vertical"
                          margin={{ top: 10, right: 30, left: 30, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.15} />
                          <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                          <YAxis dataKey="name" type="category" fontSize={11} tickLine={false} axisLine={false} />
                          <Tooltip formatter={(value) => [`${value} Clients`, 'Count']} />
                          <ReBar dataKey="count" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={20} />
                        </ReBarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}
