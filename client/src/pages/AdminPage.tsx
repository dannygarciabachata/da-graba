import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  useAdminCheck, useAdminMeta, useProviders, useEndpoints,
  useCreateProvider, useUpdateProvider, useDeleteProvider,
  useCreateEndpoint, useUpdateEndpoint, useDeleteEndpoint,
  useTestEndpoint,
  useAdminStats, useAdminUsers, useAdminSubscriptions, useAdminProducts,
  usePlatformSettings, useUpsertSetting, useBulkUpsertSettings,
  useAnalytics, useAdminTickets, useAdminTicket,
  useUpdateTicket, useReplyToTicket,
  useCloudServers, useCreateCloudServer, useUpdateCloudServer,
  useDeleteCloudServer, useTestCloudServer,
  useUpdateUserRole,
} from "@/hooks/use-admin";
import {
  useStyleKits, useStyleKitMeta, useCreateStyleKit, useUpdateStyleKit,
  useDeleteStyleKit, useUploadInstrument, useDeleteInstrument,
  useAdminAnalyzeKit, useAdminTrainKit,
} from "@/hooks/use-style-kits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Settings, Plus, Trash2, Edit, CheckCircle, XCircle,
  Server, Zap, ArrowLeft, TestTube, Loader2, Save,
  Shield, Globe, Key, ToggleLeft, ToggleRight,
  BarChart3, Users, CreditCard, Music, FileText, Mic, Disc, Upload,
  TrendingUp, MessageSquare, Mail, Sliders, Clock,
  AlertCircle, Send, Eye, Cloud, Wifi, WifiOff, Activity, Play, Cpu, Search,
} from "lucide-react";
import type { ApiProvider, ApiEndpoint, CloudServer } from "@shared/schema";

type Tab = "dashboard" | "analytics" | "users" | "subscriptions" | "support" | "settings" | "email" | "style-kits" | "providers" | "endpoints" | "cloud-servers" | "gpu" | "blog" | "billing";

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const { data: adminCheck, isLoading: checkLoading } = useAdminCheck();
  const { toast } = useToast();

  if (checkLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="admin-loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!adminCheck?.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4" data-testid="admin-denied">
        <Shield className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground text-sm">You need admin privileges to access this page.</p>
        <Button variant="outline" onClick={() => setLocation("/create")} data-testid="button-back-create">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Create
        </Button>
      </div>
    );
  }

  return <AdminDashboard role={adminCheck.role || "user"} />;
}

const TAB_ROLE_ACCESS: Record<string, Tab[]> = {
  super_admin: ["dashboard", "analytics", "users", "subscriptions", "blog", "billing", "support", "settings", "email", "style-kits", "gpu", "cloud-servers", "providers", "endpoints"],
  admin: ["dashboard", "analytics", "users", "subscriptions", "blog", "support", "style-kits", "gpu"],
  moderator: ["support"],
};

function AdminDashboard({ role }: { role: string }) {
  const defaultTab = TAB_ROLE_ACCESS[role]?.[0] || "support";
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);
  const [editingProvider, setEditingProvider] = useState<Partial<ApiProvider> | null>(null);
  const [editingEndpoint, setEditingEndpoint] = useState<Partial<ApiEndpoint> | null>(null);

  const allowedTabs = TAB_ROLE_ACCESS[role] || [];

  const allTabs = [
    { id: "dashboard" as Tab, label: "Dashboard", icon: BarChart3 },
    { id: "analytics" as Tab, label: "Analytics", icon: TrendingUp },
    { id: "users" as Tab, label: "Users", icon: Users },
    { id: "subscriptions" as Tab, label: "Subscriptions", icon: CreditCard },
    { id: "support" as Tab, label: "Support", icon: MessageSquare },
    { id: "settings" as Tab, label: "Settings", icon: Sliders },
    { id: "email" as Tab, label: "Email", icon: Mail },
    { id: "style-kits" as Tab, label: "Style Kits", icon: Disc },
    { id: "blog" as Tab, label: "Blog", icon: FileText },
    { id: "billing" as Tab, label: "Billing", icon: CreditCard },
    { id: "gpu" as Tab, label: "GPU", icon: Cpu },
    { id: "cloud-servers" as Tab, label: "Cloud Servers", icon: Cloud },
    { id: "providers" as Tab, label: "API Providers", icon: Server },
    { id: "endpoints" as Tab, label: "Endpoints", icon: Zap },
  ];

  const tabs = allTabs.filter(tab => allowedTabs.includes(tab.id));

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6" data-testid="admin-dashboard">
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-tr from-primary to-blue-600 p-2 rounded-lg">
          <Settings className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Admin Panel</h1>
            <Badge variant="outline" className="text-xs capitalize" data-testid="badge-admin-role">{role.replace("_", " ")}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Manage users, subscriptions, API providers, and platform settings</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === "providers") setSelectedProviderId(null);
            }}
            data-testid={`tab-${tab.id}`}
          >
            <tab.icon className="h-4 w-4 mr-1" /> {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "dashboard" && <DashboardTab />}
      {activeTab === "analytics" && <AnalyticsTab />}
      {activeTab === "users" && <UsersTab isSuperAdmin={role === "super_admin"} />}
      {activeTab === "subscriptions" && <SubscriptionsTab />}
      {activeTab === "support" && <SupportTab />}
      {activeTab === "settings" && <SettingsTab />}
      {activeTab === "email" && <EmailSettingsTab />}
      {activeTab === "style-kits" && <StyleKitsAdminTab />}
      {activeTab === "blog" && <BlogAdminTab />}
      {activeTab === "billing" && <BillingAdminTab />}
      {activeTab === "gpu" && <GpuTab role={role} />}
      {activeTab === "cloud-servers" && <CloudServersTab />}

      {activeTab === "providers" && (
        <ProvidersTab
          selectedId={selectedProviderId}
          onSelect={setSelectedProviderId}
          editing={editingProvider}
          onEdit={setEditingProvider}
          onViewEndpoints={(id) => { setSelectedProviderId(id); setActiveTab("endpoints"); }}
        />
      )}

      {activeTab === "endpoints" && (
        <EndpointsTab
          providerId={selectedProviderId}
          editing={editingEndpoint}
          onEdit={setEditingEndpoint}
          onBack={() => setActiveTab("providers")}
        />
      )}
    </div>
  );
}

function DashboardTab() {
  const { data: stats, isLoading } = useAdminStats();

  if (isLoading) return <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;

  const statCards = [
    { label: "Total Users", value: stats?.totalUsers || 0, icon: Users, color: "text-blue-400" },
    { label: "Total Songs", value: stats?.totalSongs || 0, icon: Music, color: "text-green-400" },
    { label: "Total Samples", value: stats?.totalSamples || 0, icon: Mic, color: "text-purple-400" },
    { label: "Total Lyrics", value: stats?.totalLyrics || 0, icon: FileText, color: "text-yellow-400" },
    { label: "Active Subscriptions", value: stats?.activeSubscriptions || 0, icon: CreditCard, color: "text-primary" },
    { label: "Total Subscriptions", value: stats?.totalSubscriptions || 0, icon: BarChart3, color: "text-orange-400" },
  ];

  return (
    <div className="space-y-4" data-testid="admin-dashboard-stats">
      <h2 className="text-lg font-semibold">Platform Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statCards.map(stat => (
          <Card key={stat.label} data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

const ROLE_OPTIONS = [
  { value: "super_admin", label: "Super Admin", color: "bg-red-500/10 text-red-500 border-red-500/30" },
  { value: "admin", label: "Admin", color: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  { value: "moderator", label: "Moderator", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30" },
  { value: "user", label: "User", color: "" },
];

function UsersTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { data: usersList, isLoading } = useAdminUsers();
  const updateRole = useUpdateUserRole();
  const { toast } = useToast();

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      await updateRole.mutateAsync({ userId, role: newRole });
      toast({ title: "Role updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  if (isLoading) return <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-4" data-testid="admin-users-tab">
      <h2 className="text-lg font-semibold">Users ({usersList?.length || 0})</h2>
      <div className="space-y-2">
        {usersList?.map((u: any) => {
          const roleInfo = ROLE_OPTIONS.find(r => r.value === (u.role || "user")) || ROLE_OPTIONS[3];
          return (
            <Card key={u.id} data-testid={`card-user-${u.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {u.profileImageUrl ? (
                      <img src={u.profileImageUrl} className="h-8 w-8 rounded-full" alt="" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                        {u.firstName?.[0]}{u.lastName?.[0]}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-muted-foreground">{u.email || "No email"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSuperAdmin ? (
                      <select
                        value={u.role || "user"}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="text-xs bg-background border rounded px-2 py-1 cursor-pointer"
                        data-testid={`select-role-${u.id}`}
                      >
                        {ROLE_OPTIONS.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    ) : (
                      <Badge variant="outline" className={`text-[10px] ${roleInfo.color}`} data-testid={`badge-role-${u.id}`}>
                        {roleInfo.label}
                      </Badge>
                    )}
                    <Badge variant={u.subscriptionTier === "premium" ? "default" : u.subscriptionTier === "pro" ? "secondary" : "outline"} className="text-[10px]">
                      {u.subscriptionTier || "free"}
                    </Badge>
                    {u.stripeCustomerId && (
                      <Badge variant="outline" className="text-[10px]">Stripe</Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : ""}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {(!usersList || usersList.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No users found.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SubscriptionsTab() {
  const { data: subs, isLoading: subsLoading } = useAdminSubscriptions();
  const { data: products, isLoading: prodsLoading } = useAdminProducts();
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [showAddPrice, setShowAddPrice] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({ name: "", description: "" });
  const [priceForm, setPriceForm] = useState({ unitAmount: "", currency: "usd", interval: "month" });
  const { toast } = useToast();

  const createProduct = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/stripe/products", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] }); setShowCreateProduct(false); setProductForm({ name: "", description: "" }); toast({ title: "Producto creado en Stripe" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateProduct = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/admin/stripe/products/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] }); setEditingProduct(null); toast({ title: "Producto actualizado" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const archiveProduct = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/stripe/products/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] }); toast({ title: "Producto archivado" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createPrice = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/stripe/prices", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] }); setShowAddPrice(null); setPriceForm({ unitAmount: "", currency: "usd", interval: "month" }); toast({ title: "Precio creado" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deactivatePrice = useMutation({
    mutationFn: (priceId: string) => apiRequest("PATCH", `/api/admin/stripe/prices/${priceId}`, { active: false }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] }); toast({ title: "Precio desactivado" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const cancelSubscription = useMutation({
    mutationFn: (subId: string) => apiRequest("POST", `/api/admin/stripe/subscriptions/${subId}/cancel`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] }); toast({ title: "Suscripción marcada para cancelación" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function startEditProduct(p: any) {
    setEditingProduct(p);
    setProductForm({ name: p.name || p.product_name || "", description: p.description || p.product_description || "" });
  }

  if (subsLoading || prodsLoading) return <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-6" data-testid="admin-subscriptions-tab">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Products & Prices (Stripe)</h2>
          <Button size="sm" onClick={() => { setShowCreateProduct(!showCreateProduct); setProductForm({ name: "", description: "" }); }} data-testid="button-create-stripe-product">
            <Plus className="h-4 w-4 mr-1" /> {showCreateProduct ? "Cancelar" : "Nuevo Producto"}
          </Button>
        </div>

        {showCreateProduct && (
          <Card className="bg-card/50 border-primary/20 mb-4">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold">Crear Producto en Stripe</h3>
              <Input placeholder="Nombre del producto (ej: DGB Studio Pro)" value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} data-testid="input-new-product-name" />
              <Input placeholder="Descripción" value={productForm.description} onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))} data-testid="input-new-product-desc" />
              <Button size="sm" onClick={() => createProduct.mutate(productForm)} disabled={createProduct.isPending || !productForm.name} data-testid="button-submit-create-product">
                {createProduct.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />} Crear en Stripe
              </Button>
            </CardContent>
          </Card>
        )}

        {products && products.length > 0 ? (
          <div className="grid gap-3">
            {products.map((p: any) => {
              const pid = p.id || p.product_id;
              const isEditing = editingProduct && (editingProduct.id || editingProduct.product_id) === pid;
              const isAddingPrice = showAddPrice === pid;

              return (
                <Card key={pid} className="bg-card/50 border-white/10" data-testid={`card-product-${pid}`}>
                  <CardContent className="p-4">
                    {isEditing ? (
                      <div className="space-y-3">
                        <Input value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre" data-testid="input-edit-product-name" />
                        <Input value={productForm.description} onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción" data-testid="input-edit-product-desc" />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => updateProduct.mutate({ id: pid, data: productForm })} disabled={updateProduct.isPending} data-testid="button-save-product">
                            {updateProduct.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />} Guardar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingProduct(null)} data-testid="button-cancel-edit-product">Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-semibold">{p.name || p.product_name}</p>
                              <Badge variant={p.active !== false && p.product_active !== false ? "default" : "secondary"} className="text-[10px]">
                                {p.active !== false && p.product_active !== false ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{p.description || p.product_description || "Sin descripción"}</p>
                            <p className="text-[10px] text-muted-foreground/60 font-mono mt-1">{pid}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setShowAddPrice(isAddingPrice ? null : pid)} title="Agregar precio" data-testid={`button-add-price-${pid}`}>
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => startEditProduct(p)} title="Editar" data-testid={`button-edit-product-${pid}`}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm("¿Archivar este producto en Stripe?")) archiveProduct.mutate(pid); }} title="Archivar" data-testid={`button-archive-product-${pid}`}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {p.unit_amount != null && (
                          <div className="mt-2 flex items-center justify-between bg-background/50 rounded-md p-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-primary">${(Number(p.unit_amount) / 100).toFixed(2)}</span>
                              <span className="text-xs text-muted-foreground">/{(p.recurring as any)?.interval || "month"}</span>
                              <span className="text-[10px] font-mono text-muted-foreground/60">{p.price_id}</span>
                            </div>
                            {p.price_id && (
                              <Button size="sm" variant="ghost" className="text-destructive h-6 px-2" onClick={() => { if (confirm("¿Desactivar este precio?")) deactivatePrice.mutate(p.price_id); }} title="Desactivar precio" data-testid={`button-deactivate-price-${p.price_id}`}>
                                <XCircle className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}

                        {!p.unit_amount && (
                          <p className="text-xs text-muted-foreground mt-2 italic">Sin precio configurado (plan gratuito)</p>
                        )}

                        {isAddingPrice && (
                          <div className="mt-3 p-3 bg-background/50 rounded-md space-y-2 border border-white/10">
                            <p className="text-xs font-semibold">Agregar nuevo precio</p>
                            <div className="flex gap-2">
                              <Input placeholder="Monto (en centavos, ej: 2999)" type="number" value={priceForm.unitAmount} onChange={e => setPriceForm(f => ({ ...f, unitAmount: e.target.value }))} className="flex-1" data-testid="input-price-amount" />
                              <select className="bg-background border border-white/10 rounded-md px-2 text-sm" value={priceForm.interval} onChange={e => setPriceForm(f => ({ ...f, interval: e.target.value }))} data-testid="select-price-interval">
                                <option value="month">Mensual</option>
                                <option value="year">Anual</option>
                              </select>
                              <Button size="sm" onClick={() => createPrice.mutate({ productId: pid, unitAmount: priceForm.unitAmount, currency: priceForm.currency, interval: priceForm.interval })} disabled={createPrice.isPending || !priceForm.unitAmount} data-testid="button-submit-price">
                                {createPrice.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay productos en Stripe.</p>
            <p className="text-xs">Crea un producto para comenzar a vender suscripciones.</p>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Suscripciones Activas ({subs?.length || 0})</h2>
        {subs && subs.length > 0 ? (
          <div className="space-y-2">
            {subs.map((s: any) => (
              <Card key={s.id} className="bg-card/50 border-white/10" data-testid={`card-sub-${s.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono truncate">{s.id}</p>
                      <p className="text-xs text-muted-foreground">Customer: {s.customer}</p>
                      {s.current_period_end && (
                        <p className="text-xs text-muted-foreground">Vence: {new Date(s.current_period_end * 1000).toLocaleDateString()}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={s.status === "active" ? "default" : "secondary"} className="text-[10px]">
                        {s.status}
                      </Badge>
                      {s.cancel_at_period_end && (
                        <Badge variant="destructive" className="text-[10px]">Cancelando</Badge>
                      )}
                      {!s.cancel_at_period_end && s.status === "active" && (
                        <Button size="sm" variant="ghost" className="text-destructive h-7 px-2" onClick={() => { if (confirm("¿Cancelar esta suscripción al final del periodo?")) cancelSubscription.mutate(s.id); }} data-testid={`button-cancel-sub-${s.id}`}>
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No hay suscripciones activas.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProvidersTab({
  selectedId, onSelect, editing, onEdit, onViewEndpoints,
}: {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  editing: Partial<ApiProvider> | null;
  onEdit: (p: Partial<ApiProvider> | null) => void;
  onViewEndpoints: (id: number) => void;
}) {
  const { data: providers, isLoading } = useProviders();
  const { data: meta } = useAdminMeta();
  const createProvider = useCreateProvider();
  const updateProvider = useUpdateProvider();
  const deleteProvider = useDeleteProvider();
  const { toast } = useToast();

  const handleSave = async () => {
    if (!editing) return;
    try {
      if (editing.id) {
        await updateProvider.mutateAsync({ id: editing.id, data: editing });
        toast({ title: "Provider updated" });
      } else {
        await createProvider.mutateAsync(editing);
        toast({ title: "Provider created" });
      }
      onEdit(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteProvider.mutateAsync(id);
      toast({ title: "Provider deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) return <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">API Providers ({providers?.length || 0})</h2>
        <Button
          size="sm"
          onClick={() => onEdit({ name: "", baseUrl: "", authType: "raw", category: "music", isActive: true })}
          data-testid="button-add-provider"
        >
          <Plus className="h-4 w-4 mr-1" /> Add Provider
        </Button>
      </div>

      {editing && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{editing.id ? "Edit Provider" : "New Provider"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="Provider Name"
                value={editing.name || ""}
                onChange={e => onEdit({ ...editing, name: e.target.value })}
                data-testid="input-provider-name"
              />
              <Input
                placeholder="Base URL (e.g. https://api.example.com/v1)"
                value={editing.baseUrl || ""}
                onChange={e => onEdit({ ...editing, baseUrl: e.target.value })}
                data-testid="input-provider-url"
              />
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={editing.authType || "raw"}
                onChange={e => onEdit({ ...editing, authType: e.target.value })}
                data-testid="select-auth-type"
              >
                {(meta?.authTypes || ["raw", "bearer", "header", "query", "none"]).map(t => (
                  <option key={t} value={t}>{t.toUpperCase()}</option>
                ))}
              </select>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={editing.category || "music"}
                onChange={e => onEdit({ ...editing, category: e.target.value })}
                data-testid="select-category"
              >
                {(meta?.providerCategories || ["music", "lyrics", "image", "audio_processing", "voice"]).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <Input
                placeholder="Auth Header Name (default: Authorization)"
                value={editing.authHeaderName || ""}
                onChange={e => onEdit({ ...editing, authHeaderName: e.target.value })}
                data-testid="input-auth-header"
              />
              <Input
                placeholder="API Key Env Variable (e.g. MUSICGPT_API_KEY)"
                value={editing.apiKeyEnvVar || ""}
                onChange={e => onEdit({ ...editing, apiKeyEnvVar: e.target.value })}
                data-testid="input-env-var"
              />
            </div>
            <Textarea
              placeholder="Description"
              value={editing.description || ""}
              onChange={e => onEdit({ ...editing, description: e.target.value })}
              rows={2}
              data-testid="input-provider-desc"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={!editing.name || !editing.baseUrl} data-testid="button-save-provider">
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => onEdit(null)} data-testid="button-cancel-provider">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {providers?.map(provider => (
          <Card key={provider.id} className="hover:border-primary/20 transition-colors" data-testid={`card-provider-${provider.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium truncate">{provider.name}</span>
                    <Badge variant={provider.isActive ? "default" : "secondary"} className="text-[10px]">
                      {provider.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">{provider.category}</Badge>
                    <Badge variant="outline" className="text-[10px]">{provider.authType}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{provider.baseUrl}</p>
                  {provider.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{provider.description}</p>
                  )}
                  {provider.apiKeyEnvVar && (
                    <div className="flex items-center gap-1 mt-1">
                      <Key className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground font-mono">{provider.apiKeyEnvVar}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => onViewEndpoints(provider.id)}
                    data-testid={`button-view-endpoints-${provider.id}`}
                    title="View Endpoints"
                  >
                    <Zap className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => onEdit(provider)}
                    data-testid={`button-edit-provider-${provider.id}`}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => handleDelete(provider.id)}
                    data-testid={`button-delete-provider-${provider.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!providers || providers.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            <Server className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No API providers configured yet.</p>
            <p className="text-xs">Add a provider to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function EndpointsTab({
  providerId, editing, onEdit, onBack,
}: {
  providerId: number | null;
  editing: Partial<ApiEndpoint> | null;
  onEdit: (e: Partial<ApiEndpoint> | null) => void;
  onBack: () => void;
}) {
  const { data: endpoints, isLoading } = useEndpoints(providerId || undefined);
  const { data: providers } = useProviders();
  const { data: meta } = useAdminMeta();
  const createEndpoint = useCreateEndpoint();
  const updateEndpoint = useUpdateEndpoint();
  const deleteEndpoint = useDeleteEndpoint();
  const testEndpoint = useTestEndpoint();
  const { toast } = useToast();
  const [testResults, setTestResults] = useState<Record<number, { success: boolean; message: string }>>({});
  const [requestMappingText, setRequestMappingText] = useState("");
  const [responseMappingText, setResponseMappingText] = useState("");
  const [pollResponseMappingText, setPollResponseMappingText] = useState("");

  const selectedProvider = providers?.find(p => p.id === providerId);

  const handleNewEndpoint = () => {
    setRequestMappingText("{}");
    setResponseMappingText('{"taskId": "task_id"}');
    setPollResponseMappingText("{}");
    onEdit({
      providerId: providerId || 0,
      name: "",
      operationType: "music_generation",
      path: "/",
      method: "POST",
      contentType: "formdata",
      asyncPattern: "polling",
      isActive: true,
      requestMapping: {},
      responseMapping: { taskId: "task_id" },
      pollResponseMapping: {},
    });
  };

  const handleEditEndpoint = (ep: ApiEndpoint) => {
    setRequestMappingText(JSON.stringify(ep.requestMapping || {}, null, 2));
    setResponseMappingText(JSON.stringify(ep.responseMapping || {}, null, 2));
    setPollResponseMappingText(JSON.stringify(ep.pollResponseMapping || {}, null, 2));
    onEdit(ep);
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      let reqMap, resMap, pollResMap;
      try { reqMap = JSON.parse(requestMappingText || "{}"); } catch {
        toast({ title: "Invalid JSON", description: "Request Mapping has invalid JSON", variant: "destructive" });
        return;
      }
      try { resMap = JSON.parse(responseMappingText || "{}"); } catch {
        toast({ title: "Invalid JSON", description: "Response Mapping has invalid JSON", variant: "destructive" });
        return;
      }
      try { pollResMap = JSON.parse(pollResponseMappingText || "{}"); } catch {
        toast({ title: "Invalid JSON", description: "Poll Response Mapping has invalid JSON", variant: "destructive" });
        return;
      }

      const data = { ...editing, requestMapping: reqMap, responseMapping: resMap, pollResponseMapping: pollResMap };

      if (editing.id) {
        await updateEndpoint.mutateAsync({ id: editing.id, data });
        toast({ title: "Endpoint updated" });
      } else {
        await createEndpoint.mutateAsync(data);
        toast({ title: "Endpoint created" });
      }
      onEdit(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteEndpoint.mutateAsync(id);
      toast({ title: "Endpoint deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleTest = async (id: number) => {
    try {
      const result = await testEndpoint.mutateAsync(id);
      setTestResults(prev => ({ ...prev, [id]: result }));
      toast({
        title: result.success ? "Connection OK" : "Connection Failed",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    } catch (err: any) {
      setTestResults(prev => ({ ...prev, [id]: { success: false, message: err.message } }));
    }
  };

  if (isLoading) return <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {providerId && (
            <Button size="sm" variant="ghost" onClick={onBack} data-testid="button-back-providers">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <h2 className="text-lg font-semibold">
            {selectedProvider ? `${selectedProvider.name} Endpoints` : "All Endpoints"} ({endpoints?.length || 0})
          </h2>
        </div>
        <Button size="sm" onClick={handleNewEndpoint} disabled={!providerId} data-testid="button-add-endpoint">
          <Plus className="h-4 w-4 mr-1" /> Add Endpoint
        </Button>
      </div>

      {!providerId && (
        <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
          Select a provider from the Providers tab to add new endpoints, or browse all configured endpoints below.
        </div>
      )}

      {editing && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{editing.id ? "Edit Endpoint" : "New Endpoint"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="Endpoint Name"
                value={editing.name || ""}
                onChange={e => onEdit({ ...editing, name: e.target.value })}
                data-testid="input-endpoint-name"
              />
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={editing.operationType || "music_generation"}
                onChange={e => onEdit({ ...editing, operationType: e.target.value })}
                data-testid="select-operation-type"
              >
                {(meta?.operationTypes || []).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <Input
                placeholder="Path (e.g. /MusicAI)"
                value={editing.path || ""}
                onChange={e => onEdit({ ...editing, path: e.target.value })}
                data-testid="input-endpoint-path"
              />
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={editing.method || "POST"}
                onChange={e => onEdit({ ...editing, method: e.target.value })}
                data-testid="select-method"
              >
                <option value="POST">POST</option>
                <option value="GET">GET</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
              </select>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={editing.contentType || "formdata"}
                onChange={e => onEdit({ ...editing, contentType: e.target.value })}
                data-testid="select-content-type"
              >
                <option value="formdata">FormData</option>
                <option value="json">JSON</option>
              </select>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={editing.asyncPattern || "polling"}
                onChange={e => onEdit({ ...editing, asyncPattern: e.target.value })}
                data-testid="select-async-pattern"
              >
                <option value="polling">Polling</option>
                <option value="webhook">Webhook</option>
                <option value="none">None (Sync)</option>
              </select>
              <Input
                placeholder="Poll Path (e.g. /byId)"
                value={editing.pollPath || ""}
                onChange={e => onEdit({ ...editing, pollPath: e.target.value })}
                data-testid="input-poll-path"
              />
              <Input
                placeholder="Conversion Type (e.g. MUSIC_AI)"
                value={editing.conversionType || ""}
                onChange={e => onEdit({ ...editing, conversionType: e.target.value })}
                data-testid="input-conversion-type"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Request Mapping (JSON)</label>
              <Textarea
                placeholder='{"api_param": "$input_param", "static_field": "value"}'
                value={requestMappingText}
                onChange={e => setRequestMappingText(e.target.value)}
                rows={3}
                className="font-mono text-xs"
                data-testid="input-request-mapping"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Response Mapping (JSON)</label>
              <Textarea
                placeholder='{"taskId": "task_id", "eta": "eta"}'
                value={responseMappingText}
                onChange={e => setResponseMappingText(e.target.value)}
                rows={2}
                className="font-mono text-xs"
                data-testid="input-response-mapping"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Poll Response Mapping (JSON)</label>
              <Textarea
                placeholder='{"dominantKey": "conversion.dominant_key", "bpm": "conversion.bpm"}'
                value={pollResponseMappingText}
                onChange={e => setPollResponseMappingText(e.target.value)}
                rows={2}
                className="font-mono text-xs"
                data-testid="input-poll-response-mapping"
              />
            </div>

            <Textarea
              placeholder="Description"
              value={editing.description || ""}
              onChange={e => onEdit({ ...editing, description: e.target.value })}
              rows={2}
              data-testid="input-endpoint-desc"
            />

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={editing.webhookSupported ?? false}
                  onChange={e => onEdit({ ...editing, webhookSupported: e.target.checked })}
                  data-testid="checkbox-webhook"
                />
                Webhook Supported
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={editing.isActive ?? true}
                  onChange={e => onEdit({ ...editing, isActive: e.target.checked })}
                  data-testid="checkbox-active"
                />
                Active
              </label>
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={!editing.name || !editing.path} data-testid="button-save-endpoint">
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => onEdit(null)} data-testid="button-cancel-endpoint">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {endpoints?.map(endpoint => {
          const testResult = testResults[endpoint.id];
          const providerName = providers?.find(p => p.id === endpoint.providerId)?.name || "Unknown";
          return (
            <Card key={endpoint.id} className="hover:border-primary/20 transition-colors" data-testid={`card-endpoint-${endpoint.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Zap className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium">{endpoint.name}</span>
                      <Badge variant={endpoint.isActive ? "default" : "secondary"} className="text-[10px]">
                        {endpoint.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono">{endpoint.operationType}</Badge>
                      <Badge variant="outline" className="text-[10px]">{endpoint.method}</Badge>
                      <Badge variant="outline" className="text-[10px]">{endpoint.contentType}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{providerName}{endpoint.path}</p>
                    {endpoint.description && (
                      <p className="text-xs text-muted-foreground mt-1">{endpoint.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                      {endpoint.conversionType && <span>Type: {endpoint.conversionType}</span>}
                      <span>Async: {endpoint.asyncPattern}</span>
                      {endpoint.webhookSupported && <span className="text-green-400">Webhook</span>}
                    </div>
                    {testResult && (
                      <div className={`flex items-center gap-1 mt-1.5 text-xs ${testResult.success ? "text-green-400" : "text-red-400"}`}>
                        {testResult.success ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {testResult.message}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => handleTest(endpoint.id)}
                      disabled={testEndpoint.isPending}
                      data-testid={`button-test-endpoint-${endpoint.id}`}
                      title="Test Connection"
                    >
                      {testEndpoint.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => handleEditEndpoint(endpoint)}
                      data-testid={`button-edit-endpoint-${endpoint.id}`}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDelete(endpoint.id)}
                      data-testid={`button-delete-endpoint-${endpoint.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {(!endpoints || endpoints.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No endpoints configured.</p>
            <p className="text-xs">{providerId ? "Add an endpoint to start mapping operations." : "Select a provider to view its endpoints."}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AnalyticsTab() {
  const { data: analytics, isLoading } = useAnalytics();

  if (isLoading) return <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;

  const maxActivity = Math.max(
    ...(analytics?.recentActivity?.map(d => d.songs + d.samples + d.lyrics) || [1])
  );

  return (
    <div className="space-y-6" data-testid="admin-analytics-tab">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" /> Platform Analytics (30 Days)
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card data-testid="stat-tickets-open">
          <CardContent className="p-4 text-center">
            <AlertCircle className="h-6 w-6 mx-auto text-yellow-400 mb-1" />
            <p className="text-2xl font-bold">{analytics?.ticketStats?.open || 0}</p>
            <p className="text-xs text-muted-foreground">Open Tickets</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-tickets-progress">
          <CardContent className="p-4 text-center">
            <Clock className="h-6 w-6 mx-auto text-blue-400 mb-1" />
            <p className="text-2xl font-bold">{analytics?.ticketStats?.inProgress || 0}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-tickets-resolved">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-6 w-6 mx-auto text-green-400 mb-1" />
            <p className="text-2xl font-bold">{analytics?.ticketStats?.resolved || 0}</p>
            <p className="text-xs text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-tickets-closed">
          <CardContent className="p-4 text-center">
            <XCircle className="h-6 w-6 mx-auto text-gray-400 mb-1" />
            <p className="text-2xl font-bold">{analytics?.ticketStats?.closed || 0}</p>
            <p className="text-xs text-muted-foreground">Closed</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Daily Activity</CardTitle>
          <CardDescription className="text-xs">Songs, Samples & Lyrics created per day</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-[2px] h-32" data-testid="chart-daily-activity">
            {analytics?.recentActivity?.slice(-30).map((d, i) => {
              const total = d.songs + d.samples + d.lyrics;
              const height = maxActivity > 0 ? (total / maxActivity) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.date}: ${d.songs}s ${d.samples}sa ${d.lyrics}l`}>
                  <div className="w-full rounded-t bg-primary/70 transition-all" style={{ height: `${Math.max(height, 2)}%` }} />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">30 days ago</span>
            <span className="text-[10px] text-muted-foreground">Today</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Songs by Genre</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2" data-testid="chart-genres">
              {analytics?.songsByGenre?.map((g) => {
                const maxGenreCount = Math.max(...(analytics.songsByGenre?.map(x => x.count) || [1]));
                const width = maxGenreCount > 0 ? (g.count / maxGenreCount) * 100 : 0;
                return (
                  <div key={g.genre} className="flex items-center gap-2">
                    <span className="text-xs w-20 truncate text-muted-foreground">{g.genre}</span>
                    <div className="flex-1 bg-muted rounded-full h-3">
                      <div className="bg-primary rounded-full h-3 transition-all" style={{ width: `${width}%` }} />
                    </div>
                    <span className="text-xs font-medium w-8 text-right">{g.count}</span>
                  </div>
                );
              })}
              {(!analytics?.songsByGenre || analytics.songsByGenre.length === 0) && (
                <p className="text-xs text-muted-foreground text-center py-4">No genre data yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Songs by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2" data-testid="chart-status">
              {analytics?.songsByStatus?.map((s) => (
                <div key={s.status} className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Badge variant={s.status === "completed" ? "default" : s.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">
                      {s.status}
                    </Badge>
                  </div>
                  <span className="text-sm font-bold">{s.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">User Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1" data-testid="chart-user-growth">
              {analytics?.userGrowth?.slice(-10).map((d) => (
                <div key={d.date} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{new Date(d.date).toLocaleDateString()}</span>
                  <Badge variant="outline">{d.count} new</Badge>
                </div>
              ))}
              {(!analytics?.userGrowth || analytics.userGrowth.length === 0) && (
                <p className="text-xs text-muted-foreground text-center py-4">No user growth data yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SupportTab() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const { data: tickets, isLoading } = useAdminTickets(statusFilter);
  const { data: ticketDetail } = useAdminTicket(selectedTicketId);
  const updateTicket = useUpdateTicket();
  const replyToTicket = useReplyToTicket();
  const { toast } = useToast();

  const handleStatusChange = async (ticketId: number, newStatus: string) => {
    try {
      await updateTicket.mutateAsync({ id: ticketId, data: { status: newStatus } });
      toast({ title: `Ticket ${newStatus}` });
    } catch {
      toast({ title: "Failed to update ticket", variant: "destructive" });
    }
  };

  const handleReply = async () => {
    if (!selectedTicketId || !replyText.trim()) return;
    try {
      await replyToTicket.mutateAsync({ ticketId: selectedTicketId, content: replyText.trim() });
      setReplyText("");
      toast({ title: "Reply sent" });
    } catch {
      toast({ title: "Failed to send reply", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;

  if (selectedTicketId && ticketDetail) {
    return (
      <div className="space-y-4" data-testid="admin-ticket-detail">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setSelectedTicketId(null)} data-testid="button-back-tickets">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h2 className="text-lg font-semibold">Ticket #{ticketDetail.id}</h2>
          <Badge variant={ticketDetail.status === "open" ? "destructive" : ticketDetail.status === "in_progress" ? "default" : "secondary"}>
            {ticketDetail.status}
          </Badge>
          <Badge variant="outline">{ticketDetail.priority}</Badge>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-sm">{ticketDetail.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {ticketDetail.userName || "Unknown"} ({ticketDetail.userEmail || "no email"}) • {ticketDetail.createdAt ? new Date(ticketDetail.createdAt).toLocaleString() : ""}
                </p>
              </div>
              <div className="flex gap-1">
                {ticketDetail.status !== "in_progress" && (
                  <Button size="sm" variant="outline" onClick={() => handleStatusChange(ticketDetail.id, "in_progress")} data-testid="button-status-progress">
                    In Progress
                  </Button>
                )}
                {ticketDetail.status !== "resolved" && (
                  <Button size="sm" variant="outline" onClick={() => handleStatusChange(ticketDetail.id, "resolved")} data-testid="button-status-resolved">
                    Resolve
                  </Button>
                )}
                {ticketDetail.status !== "closed" && (
                  <Button size="sm" variant="outline" onClick={() => handleStatusChange(ticketDetail.id, "closed")} data-testid="button-status-closed">
                    Close
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto mb-4">
              {ticketDetail.messages?.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "admin" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "admin" ? "bg-primary text-black rounded-br-sm" :
                    msg.role === "assistant" ? "bg-blue-900/30 rounded-bl-sm border border-blue-500/20" :
                    "bg-muted rounded-bl-sm"
                  }`}>
                    <div className="text-[10px] opacity-60 mb-0.5">
                      {msg.role === "admin" ? "Admin" : msg.role === "assistant" ? "AI Bot" : "User"} • {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ""}
                    </div>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Type admin reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                data-testid="input-admin-reply"
              />
              <Button size="sm" onClick={handleReply} disabled={!replyText.trim() || replyToTicket.isPending} data-testid="button-send-reply">
                {replyToTicket.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="admin-support-tab">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" /> Support Tickets ({tickets?.length || 0})
        </h2>
        <div className="flex gap-1">
          {[undefined, "open", "in_progress", "resolved", "closed"].map(s => (
            <Button
              key={s || "all"}
              size="sm"
              variant={statusFilter === s ? "default" : "outline"}
              onClick={() => setStatusFilter(s)}
              data-testid={`filter-${s || "all"}`}
            >
              {s ? s.replace("_", " ") : "All"}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {tickets?.map(ticket => (
          <Card key={ticket.id} className="hover:border-primary/20 transition-colors cursor-pointer" onClick={() => setSelectedTicketId(ticket.id)} data-testid={`card-ticket-${ticket.id}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">{ticket.subject}</span>
                    <Badge variant={
                      ticket.status === "open" ? "destructive" :
                      ticket.status === "in_progress" ? "default" :
                      ticket.status === "resolved" ? "secondary" : "outline"
                    } className="text-[10px]">
                      {ticket.status}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">{ticket.priority}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ticket.userName || "Unknown"} • {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : ""}
                  </p>
                </div>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
        {(!tickets || tickets.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No support tickets yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsTab() {
  const { data: settings, isLoading } = usePlatformSettings();
  const upsertSetting = useUpsertSetting();
  const bulkUpsert = useBulkUpsertSettings();
  const { toast } = useToast();

  const generalSettings = [
    { key: "site_name", label: "Site Name", defaultValue: "DGB Audio", category: "general", description: "Platform name" },
    { key: "maintenance_mode", label: "Maintenance Mode", defaultValue: "false", category: "general", description: "Enable maintenance page" },
    { key: "signup_enabled", label: "Signup Enabled", defaultValue: "true", category: "general", description: "Allow new user registrations" },
    { key: "default_subscription_tier", label: "Default Tier", defaultValue: "free", category: "billing", description: "Default subscription for new users" },
    { key: "max_upload_size_mb", label: "Max Upload Size (MB)", defaultValue: "50", category: "limits", description: "Max file upload size" },
    { key: "max_songs_free", label: "Max Songs (Free)", defaultValue: "5", category: "limits", description: "Song limit for free tier" },
    { key: "max_songs_pro", label: "Max Songs (Pro)", defaultValue: "50", category: "limits", description: "Song limit for pro tier" },
    { key: "max_songs_premium", label: "Max Songs (Premium)", defaultValue: "unlimited", category: "limits", description: "Song limit for premium tier" },
    { key: "allowed_audio_types", label: "Allowed Audio Types", defaultValue: "wav,mp3,ogg,flac,m4a", category: "limits", description: "Accepted audio formats" },
    { key: "support_auto_reply", label: "Support Auto-Reply", defaultValue: "true", category: "support", description: "AI auto-responds to support chats" },
    { key: "brand_tagline", label: "Brand Tagline", defaultValue: "DGB Studio Engine", category: "branding", description: "Platform tagline" },
  ];

  const currentValues: Record<string, string> = {};
  settings?.forEach(s => { currentValues[s.key] = s.value || ""; });

  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const getVal = (key: string, defaultValue: string) => {
    if (formValues[key] !== undefined) return formValues[key];
    return currentValues[key] ?? defaultValue;
  };

  const handleSaveAll = async () => {
    const toSave = generalSettings.map(s => ({
      key: s.key,
      value: getVal(s.key, s.defaultValue),
      category: s.category,
      description: s.description,
    }));
    try {
      await bulkUpsert.mutateAsync(toSave);
      toast({ title: "Settings saved" });
      setFormValues({});
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-4" data-testid="admin-settings-tab">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sliders className="h-5 w-5 text-primary" /> Platform Settings
        </h2>
        <Button size="sm" onClick={handleSaveAll} disabled={bulkUpsert.isPending} data-testid="button-save-settings">
          {bulkUpsert.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Save All
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {generalSettings.map(setting => (
          <Card key={setting.key} data-testid={`setting-${setting.key}`}>
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{setting.label}</label>
                  <Badge variant="outline" className="text-[10px]">{setting.category}</Badge>
                </div>
                {setting.key === "maintenance_mode" || setting.key === "signup_enabled" || setting.key === "support_auto_reply" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      const current = getVal(setting.key, setting.defaultValue);
                      setFormValues({ ...formValues, [setting.key]: current === "true" ? "false" : "true" });
                    }}
                    data-testid={`toggle-${setting.key}`}
                  >
                    {getVal(setting.key, setting.defaultValue) === "true" ? (
                      <><ToggleRight className="h-4 w-4 mr-2 text-green-400" /> Enabled</>
                    ) : (
                      <><ToggleLeft className="h-4 w-4 mr-2 text-red-400" /> Disabled</>
                    )}
                  </Button>
                ) : (
                  <Input
                    value={getVal(setting.key, setting.defaultValue)}
                    onChange={(e) => setFormValues({ ...formValues, [setting.key]: e.target.value })}
                    placeholder={setting.defaultValue}
                    data-testid={`input-${setting.key}`}
                  />
                )}
                <p className="text-[10px] text-muted-foreground">{setting.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EmailSettingsTab() {
  const { data: settings, isLoading } = usePlatformSettings("email");
  const bulkUpsert = useBulkUpsertSettings();
  const { toast } = useToast();

  const emailFields = [
    { key: "email_provider", label: "Email Provider", defaultValue: "smtp", description: "SMTP, SendGrid, Mailgun, etc." },
    { key: "email_from_name", label: "From Name", defaultValue: "DGB Audio", description: "Sender display name" },
    { key: "email_from_address", label: "From Address", defaultValue: "noreply@dgbaudio.com", description: "Sender email address" },
    { key: "email_smtp_host", label: "SMTP Host", defaultValue: "", description: "e.g. smtp.gmail.com" },
    { key: "email_smtp_port", label: "SMTP Port", defaultValue: "587", description: "Usually 587 (TLS) or 465 (SSL)" },
    { key: "email_smtp_secure", label: "Use TLS/SSL", defaultValue: "true", description: "Enable secure connection" },
    { key: "email_reply_to", label: "Reply-To Address", defaultValue: "", description: "Where replies go" },
  ];

  const templateFields = [
    { key: "email_template_welcome", label: "Welcome Email", defaultValue: "Welcome to DGB Audio! Start creating music with the DGB Studio Engine.", description: "Sent to new users" },
    { key: "email_template_subscription", label: "Subscription Confirmation", defaultValue: "Your {plan} subscription is now active. Enjoy unlimited music creation!", description: "Sent after subscription" },
    { key: "email_template_support_reply", label: "Support Reply Notification", defaultValue: "Your support ticket #{ticketId} has a new reply from our team.", description: "Sent when admin replies to ticket" },
    { key: "email_template_password_reset", label: "Password Reset", defaultValue: "Click the link below to reset your password.", description: "Password reset email" },
  ];

  const currentValues: Record<string, string> = {};
  settings?.forEach(s => { currentValues[s.key] = s.value || ""; });

  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const getVal = (key: string, defaultValue: string) => {
    if (formValues[key] !== undefined) return formValues[key];
    return currentValues[key] ?? defaultValue;
  };

  const handleSave = async () => {
    const allFields = [...emailFields, ...templateFields];
    const toSave = allFields.map(f => ({
      key: f.key,
      value: getVal(f.key, f.defaultValue),
      category: "email",
      description: f.description,
    }));
    try {
      await bulkUpsert.mutateAsync(toSave);
      toast({ title: "Email settings saved" });
      setFormValues({});
    } catch {
      toast({ title: "Failed to save email settings", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-6" data-testid="admin-email-tab">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" /> Email Configuration
        </h2>
        <Button size="sm" onClick={handleSave} disabled={bulkUpsert.isPending} data-testid="button-save-email">
          {bulkUpsert.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Save Email Settings
        </Button>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">SMTP Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {emailFields.map(field => (
            <Card key={field.key} data-testid={`email-${field.key}`}>
              <CardContent className="p-4 space-y-2">
                <label className="text-sm font-medium">{field.label}</label>
                {field.key === "email_smtp_secure" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      const current = getVal(field.key, field.defaultValue);
                      setFormValues({ ...formValues, [field.key]: current === "true" ? "false" : "true" });
                    }}
                    data-testid={`toggle-${field.key}`}
                  >
                    {getVal(field.key, field.defaultValue) === "true" ? (
                      <><ToggleRight className="h-4 w-4 mr-2 text-green-400" /> Enabled</>
                    ) : (
                      <><ToggleLeft className="h-4 w-4 mr-2 text-red-400" /> Disabled</>
                    )}
                  </Button>
                ) : (
                  <Input
                    value={getVal(field.key, field.defaultValue)}
                    onChange={(e) => setFormValues({ ...formValues, [field.key]: e.target.value })}
                    placeholder={field.defaultValue || field.description}
                    data-testid={`input-${field.key}`}
                  />
                )}
                <p className="text-[10px] text-muted-foreground">{field.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Email Templates</h3>
        <div className="space-y-3">
          {templateFields.map(field => (
            <Card key={field.key} data-testid={`template-${field.key}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{field.label}</label>
                  <Badge variant="outline" className="text-[10px]">template</Badge>
                </div>
                <Textarea
                  value={getVal(field.key, field.defaultValue)}
                  onChange={(e) => setFormValues({ ...formValues, [field.key]: e.target.value })}
                  rows={2}
                  className="text-sm"
                  data-testid={`input-${field.key}`}
                />
                <p className="text-[10px] text-muted-foreground">{field.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="border-yellow-500/20 bg-yellow-500/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium">SMTP Credentials</p>
              <p className="text-xs text-muted-foreground mt-1">
                SMTP username and password should be stored as environment secrets (SMTP_USER, SMTP_PASSWORD) for security. Configure them in your environment variables, not in these settings.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StyleKitsAdminTab() {
  const { data: kits, isLoading } = useStyleKits();
  const { data: meta } = useStyleKitMeta();
  const createKit = useCreateStyleKit();
  const deleteKit = useDeleteStyleKit();
  const uploadInstrument = useUploadInstrument();
  const deleteInstrument = useDeleteInstrument();
  const analyzeKit = useAdminAnalyzeKit();
  const trainKit = useAdminTrainKit();
  const { toast } = useToast();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [kitForm, setKitForm] = useState({ name: "", genre: "bachata", description: "" });
  const [expandedKit, setExpandedKit] = useState<number | null>(null);
  const [uploadKitId, setUploadKitId] = useState<number | null>(null);
  const [instrForm, setInstrForm] = useState({ name: "", type: "other", description: "" });

  const genres = meta?.genres || [];
  const instrumentTypes = meta?.instrumentTypes || [];

  const handleCreateKit = async () => {
    if (!kitForm.name.trim()) return;
    try {
      await createKit.mutateAsync(kitForm);
      toast({ title: "Style Kit created" });
      setKitForm({ name: "", genre: "bachata", description: "" });
      setShowCreateForm(false);
    } catch {
      toast({ title: "Failed to create kit", variant: "destructive" });
    }
  };

  const handleDeleteKit = async (id: number) => {
    try {
      await deleteKit.mutateAsync(id);
      toast({ title: "Style Kit deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const handleUploadInstrument = async (kitId: number, file: File) => {
    const formData = new FormData();
    formData.append("audio", file);
    formData.append("name", instrForm.name || file.name.replace(/\.[^/.]+$/, ""));
    formData.append("type", instrForm.type);
    if (instrForm.description) formData.append("description", instrForm.description);

    try {
      await uploadInstrument.mutateAsync({ kitId, formData });
      toast({ title: "Instrument uploaded" });
      setInstrForm({ name: "", type: "other", description: "" });
      setUploadKitId(null);
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
  };

  const handleDeleteInstrument = async (id: number) => {
    try {
      await deleteInstrument.mutateAsync(id);
      toast({ title: "Instrument deleted" });
    } catch {
      toast({ title: "Failed to delete instrument", variant: "destructive" });
    }
  };

  const handleAnalyze = async (kitId: number) => {
    try {
      const result = await analyzeKit.mutateAsync(kitId);
      toast({ title: result.message || "Analysis started" });
    } catch (err: any) {
      toast({ title: err.message || "Analysis failed", variant: "destructive" });
    }
  };

  const handleTrain = async (kitId: number) => {
    try {
      const result = await trainKit.mutateAsync(kitId);
      toast({ title: result.message || "Training started" });
    } catch (err: any) {
      toast({ title: err.message || "Training failed", variant: "destructive" });
    }
  };

  const getStatusBadge = (kit: any) => {
    const status = kit.trainingStatus || "pending";
    const step = kit.pipelineStep || "upload";
    const colors: Record<string, string> = {
      pending: "bg-gray-500/20 text-gray-400",
      analyzing: "bg-blue-500/20 text-blue-400",
      prompting: "bg-purple-500/20 text-purple-400",
      queued: "bg-yellow-500/20 text-yellow-400",
      training: "bg-orange-500/20 text-orange-400",
      ready: "bg-green-500/20 text-green-400",
      failed: "bg-red-500/20 text-red-400",
    };
    const labels: Record<string, string> = {
      pending: "Pendiente",
      analyzing: "Analizando...",
      prompting: "Generando Prompts...",
      queued: "En Cola",
      training: "Entrenando...",
      ready: "Entrenado",
      failed: "Error",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getPipelineSteps = (kit: any) => {
    const steps = ["upload", "analyze", "prompt", "train", "ready"];
    const stepLabels: Record<string, string> = {
      upload: "Subir Audio",
      analyze: "Analizar",
      prompt: "AI Prompts",
      train: "Entrenar",
      ready: "Listo",
    };
    const currentIdx = steps.indexOf(kit.pipelineStep || "upload");
    return (
      <div className="flex items-center gap-1 mt-2">
        {steps.map((step, idx) => (
          <div key={step} className="flex items-center gap-1">
            <div className={`h-1.5 w-8 rounded-full ${idx <= currentIdx ? "bg-primary" : "bg-white/10"}`} />
            {idx === steps.length - 1 && (
              <span className="text-[10px] text-muted-foreground ml-1">{stepLabels[steps[currentIdx]] || ""}</span>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) return <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-4" data-testid="admin-style-kits">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Disc className="h-5 w-5 text-primary" /> Orquestas / Style Kits
        </h2>
        <Button size="sm" onClick={() => setShowCreateForm(!showCreateForm)} data-testid="button-create-kit">
          <Plus className="h-4 w-4 mr-1" /> New Kit
        </Button>
      </div>

      {showCreateForm && (
        <Card className="bg-white/5 border-white/10" data-testid="create-kit-form">
          <CardContent className="pt-4 space-y-3">
            <Input
              placeholder="Kit name (e.g. Bachata)"
              value={kitForm.name}
              onChange={(e) => setKitForm({ ...kitForm, name: e.target.value })}
              data-testid="input-kit-name"
            />
            <select
              className="w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm"
              value={kitForm.genre}
              onChange={(e) => setKitForm({ ...kitForm, genre: e.target.value })}
              data-testid="select-kit-genre"
            >
              {genres.map((g) => (
                <option key={g} value={g}>{g.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
              ))}
            </select>
            <Textarea
              placeholder="Description (optional)"
              value={kitForm.description}
              onChange={(e) => setKitForm({ ...kitForm, description: e.target.value })}
              rows={2}
              data-testid="input-kit-description"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreateKit} disabled={createKit.isPending} data-testid="button-save-kit">
                {createKit.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Create
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCreateForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {kits?.map((kit) => {
          const isExpanded = expandedKit === kit.id;
          const isUploading = uploadKitId === kit.id;
          const hasAudio = kit.instruments.some((i: any) => i.audioUrl);
          const allHaveAudio = kit.instruments.length > 0 && kit.instruments.every((i: any) => i.audioUrl);
          const canAnalyze = hasAudio && kit.trainingStatus !== "analyzing" && kit.trainingStatus !== "training";
          const canTrain = (kit.pipelineStep === "train" || kit.pipelineStep === "prompt") && kit.trainingStatus !== "training" && kit.trainingStatus !== "analyzing";

          return (
            <Card key={kit.id} className="bg-white/5 border-white/10" data-testid={`admin-kit-${kit.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="cursor-pointer flex-1" onClick={() => setExpandedKit(isExpanded ? null : kit.id)}>
                    <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                      {kit.name}
                      <Badge variant="secondary" className="text-xs">{kit.genre}</Badge>
                      <Badge variant="outline" className="text-xs">{kit.instruments.length} instrumentos</Badge>
                      {getStatusBadge(kit)}
                    </CardTitle>
                    {kit.description && <CardDescription className="text-xs mt-0.5">{kit.description}</CardDescription>}
                    {getPipelineSteps(kit)}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setUploadKitId(isUploading ? null : kit.id)}
                      title="Upload instrument audio"
                      data-testid={`button-upload-to-kit-${kit.id}`}
                    >
                      <Upload className="h-3.5 w-3.5" />
                    </Button>
                    {canAnalyze && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-blue-400"
                        onClick={() => handleAnalyze(kit.id)}
                        disabled={analyzeKit.isPending}
                        title="Analyze instruments (GPU)"
                        data-testid={`button-analyze-kit-${kit.id}`}
                      >
                        {analyzeKit.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                    {canTrain && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-green-400"
                        onClick={() => handleTrain(kit.id)}
                        disabled={trainKit.isPending}
                        title="Start training (GPU)"
                        data-testid={`button-train-kit-${kit.id}`}
                      >
                        {trainKit.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cpu className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDeleteKit(kit.id)}
                      data-testid={`button-delete-kit-${kit.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {kit.trainingError && (
                <CardContent className="pt-0 pb-2">
                  <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    {kit.trainingError}
                  </div>
                </CardContent>
              )}

              {isUploading && (
                <CardContent className="pt-0 pb-3 space-y-2">
                  <div className="p-3 rounded-lg bg-white/5 space-y-2">
                    <Input
                      placeholder="Instrument name (e.g. Guitarra Requinto)"
                      value={instrForm.name}
                      onChange={(e) => setInstrForm({ ...instrForm, name: e.target.value })}
                      data-testid="input-instrument-name"
                    />
                    <select
                      className="w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm"
                      value={instrForm.type}
                      onChange={(e) => setInstrForm({ ...instrForm, type: e.target.value })}
                      data-testid="select-instrument-type"
                    >
                      {instrumentTypes.map((t) => (
                        <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                      ))}
                    </select>
                    <Input
                      placeholder="Description (optional)"
                      value={instrForm.description}
                      onChange={(e) => setInstrForm({ ...instrForm, description: e.target.value })}
                      data-testid="input-instrument-description"
                    />
                    <input
                      type="file"
                      accept=".wav,.mp3,.ogg,.flac,.m4a"
                      className="text-xs file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:bg-primary file:text-primary-foreground file:cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadInstrument(kit.id, file);
                      }}
                      data-testid="input-instrument-file"
                    />
                    {uploadInstrument.isPending && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...
                      </div>
                    )}
                  </div>
                </CardContent>
              )}

              {isExpanded && kit.instruments.length > 0 && (
                <CardContent className="pt-0 pb-3">
                  <div className="space-y-1">
                    {kit.instruments.map((instr: any) => (
                      <div key={instr.id} className="flex items-center gap-2 p-2 rounded bg-white/5 text-sm">
                        <Music className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        <span className="flex-1 truncate">{instr.name}</span>
                        <Badge variant="outline" className="text-xs">{instr.type}</Badge>
                        {instr.analysisStatus === "complete" && (
                          <Badge variant="outline" className="text-xs text-green-400 border-green-400/30">
                            {instr.detectedKey && `${instr.detectedKey}`}
                            {instr.detectedBpm && ` ${instr.detectedBpm}bpm`}
                          </Badge>
                        )}
                        {instr.analysisStatus === "analyzing" && <Loader2 className="h-3 w-3 animate-spin text-blue-400" />}
                        {instr.audioUrl ? <CheckCircle className="h-3.5 w-3.5 text-green-400 flex-shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground/30 flex-shrink-0" />}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-destructive"
                          onClick={() => handleDeleteInstrument(instr.id)}
                          data-testid={`button-delete-instrument-${instr.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {!allHaveAudio && (
                    <div className="mt-2 text-xs text-yellow-400/80 bg-yellow-500/10 p-2 rounded flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                      Faltan audios. Sube un archivo de audio para cada instrumento antes de analizar.
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}

        {(!kits || kits.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            <Disc className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay orquestas creadas.</p>
            <p className="text-xs">Click "New Kit" para crear una nueva orquesta.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const CAPABILITY_OPTIONS = [
  { value: "instrument_processing", label: "Instrument Processing" },
  { value: "stem_separation", label: "Stem Separation (Demucs)" },
  { value: "music_generation", label: "Music Generation (SAO)" },
  { value: "training", label: "AI Training" },
  { value: "audio_analysis", label: "Audio Analysis" },
  { value: "midi_conversion", label: "MIDI Conversion" },
  { value: "voice_training", label: "Voice Training" },
];

function GpuTab({ role }: { role: string }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const isSuperAdmin = role === "super_admin";

  async function fetchStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/gpu-status", { credentials: "include" });
      if (res.ok) setStatus(await res.json());
      else toast({ title: "Error", description: "Failed to fetch GPU status", variant: "destructive" });
    } catch {
      toast({ title: "Error", description: "Connection failed", variant: "destructive" });
    }
    setLoading(false);
  }

  async function gpuAction(action: string) {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/admin/gpu/${action}`, { method: "POST", credentials: "include" });
      const data = await res.json();
      toast({
        title: data.success ? "Success" : "Error",
        description: data.message || data.output?.substring(0, 200) || "Done",
        variant: data.success ? "default" : "destructive",
      });
      if (data.success) setTimeout(fetchStatus, 3000);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setActionLoading("");
  }

  return (
    <div className="space-y-4" data-testid="gpu-tab">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">GPU Pod Management</CardTitle>
            </div>
            <Button size="sm" variant="outline" onClick={fetchStatus} disabled={loading} data-testid="button-gpu-refresh">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
              <span className="ml-1">{loading ? "Checking..." : "Check Status"}</span>
            </Button>
          </div>
          <CardDescription>Monitor and control your RunPod GPU pod for music generation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!status && !loading && (
            <p className="text-sm text-muted-foreground" data-testid="text-gpu-hint">Click "Check Status" to see your GPU pod status.</p>
          )}

          {status && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-card border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {status.gpuCount > 0 ? <Wifi className="h-3.5 w-3.5 text-green-500" /> : <WifiOff className="h-3.5 w-3.5 text-red-500" />}
                    <p className="text-sm font-medium" data-testid="text-gpu-status">
                      {status.gpuCount > 0 ? "GPU Active" : status.status === "EXITED" ? "Stopped" : "CPU Only"}
                    </p>
                  </div>
                </div>
                <div className="bg-card border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">GPU</p>
                  <p className="text-sm font-medium mt-1" data-testid="text-gpu-name">{status.gpuName || "None"}</p>
                </div>
                <div className="bg-card border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">CUDA</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {status.cudaAvailable ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                    <p className="text-sm font-medium" data-testid="text-cuda-status">{status.cudaAvailable ? "Available" : "Not Available"}</p>
                  </div>
                </div>
                <div className="bg-card border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Pod ID</p>
                  <p className="text-sm font-mono mt-1" data-testid="text-pod-id">{status.podId || "N/A"}</p>
                </div>
              </div>

              {(status.installedPackages?.length > 0 || status.missingPackages?.length > 0) && (
                <div className="border rounded-lg p-3">
                  <p className="text-xs font-medium mb-2">Packages</p>
                  <div className="flex flex-wrap gap-1.5">
                    {status.installedPackages?.map((p: string) => (
                      <Badge key={p} variant="outline" className="text-xs text-green-600 border-green-600/30" data-testid={`badge-pkg-${p.split("@")[0]}`}>
                        <CheckCircle className="h-3 w-3 mr-1" /> {p}
                      </Badge>
                    ))}
                    {status.missingPackages?.map((p: string) => (
                      <Badge key={p} variant="outline" className="text-xs text-red-500 border-red-500/30" data-testid={`badge-missing-${p}`}>
                        <XCircle className="h-3 w-3 mr-1" /> {p}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {status.error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <p className="text-xs text-red-500" data-testid="text-gpu-error">{status.error}</p>
                </div>
              )}
            </div>
          )}

          {isSuperAdmin && (
            <div className="flex gap-2 flex-wrap pt-2 border-t">
              <Button
                size="sm"
                onClick={() => gpuAction("resume")}
                disabled={!!actionLoading}
                data-testid="button-gpu-resume"
              >
                {actionLoading === "resume" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                Start with GPU
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => gpuAction("stop")}
                disabled={!!actionLoading}
                data-testid="button-gpu-stop"
              >
                {actionLoading === "stop" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                Stop Pod
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => gpuAction("setup")}
                disabled={!!actionLoading}
                data-testid="button-gpu-setup"
              >
                {actionLoading === "setup" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Settings className="h-4 w-4 mr-1" />}
                Install Dependencies
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CloudServersTab() {
  const { data: servers, isLoading } = useCloudServers();
  const createServer = useCreateCloudServer();
  const updateServer = useUpdateCloudServer();
  const deleteServer = useDeleteCloudServer();
  const testServer = useTestCloudServer();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingServer, setEditingServer] = useState<Partial<CloudServer> | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  const [form, setForm] = useState({
    name: "",
    baseUrl: "",
    apiPort: 7860,
    jupyterPort: 8888,
    jupyterToken: "",
    apiKey: "",
    webhookSecret: "",
    authHeaderName: "X-DGB-API-Key",
    webhookHeaderName: "X-Webhook-Secret",
    healthEndpoint: "/api/health",
    uploadEndpoint: "/api/upload-instrument",
    capabilities: ["instrument_processing"] as string[],
    priority: 0,
    isActive: true,
    notes: "",
  });

  function resetForm() {
    setForm({
      name: "", baseUrl: "", apiPort: 7860, jupyterPort: 8888, jupyterToken: "",
      apiKey: "", webhookSecret: "",
      authHeaderName: "X-DGB-API-Key", webhookHeaderName: "X-Webhook-Secret",
      healthEndpoint: "/api/health", uploadEndpoint: "/api/upload-instrument",
      capabilities: ["instrument_processing"], priority: 0, isActive: true, notes: "",
    });
    setEditingServer(null);
    setShowForm(false);
  }

  function startEdit(server: CloudServer) {
    setEditingServer(server);
    setForm({
      name: server.name,
      baseUrl: server.baseUrl,
      apiPort: server.apiPort || 7860,
      jupyterPort: (server as any).jupyterPort || 8888,
      jupyterToken: "",
      apiKey: "",
      webhookSecret: "",
      authHeaderName: server.authHeaderName || "X-DGB-API-Key",
      webhookHeaderName: server.webhookHeaderName || "X-Webhook-Secret",
      healthEndpoint: server.healthEndpoint || "/api/health",
      uploadEndpoint: server.uploadEndpoint || "/api/upload-instrument",
      capabilities: server.capabilities || ["instrument_processing"],
      priority: server.priority || 0,
      isActive: server.isActive ?? true,
      notes: server.notes || "",
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name || !form.baseUrl) {
      toast({ title: "Name and Base URL are required", variant: "destructive" });
      return;
    }

    try {
      const data: any = { ...form };
      if (!data.apiKey) delete data.apiKey;
      if (!data.webhookSecret) delete data.webhookSecret;
      if (!data.jupyterToken) delete data.jupyterToken;

      if (editingServer?.id) {
        await updateServer.mutateAsync({ id: editingServer.id, ...data });
        toast({ title: "Server updated" });
      } else {
        await createServer.mutateAsync(data);
        toast({ title: "Server added" });
      }
      resetForm();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function handleTest(id: number) {
    try {
      const result = await testServer.mutateAsync(id);
      toast({
        title: result.connected ? "Connected" : "Connection Failed",
        description: result.connected ? `GPU: ${result.gpu ? "Available" : "N/A"}` : result.error,
        variant: result.connected ? "default" : "destructive",
      });
    } catch (err: any) {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this cloud server?")) return;
    try {
      await deleteServer.mutateAsync(id);
      toast({ title: "Server deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  function toggleCapability(cap: string) {
    setForm(prev => ({
      ...prev,
      capabilities: prev.capabilities.includes(cap)
        ? prev.capabilities.filter(c => c !== cap)
        : [...prev.capabilities, cap],
    }));
  }

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4" data-testid="cloud-servers-tab">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" /> Cloud GPU Servers
          </h2>
          <p className="text-xs text-muted-foreground">Manage GPU servers for instrument processing, training, and music generation. Add any provider (AWS, Google Cloud, DigitalOcean, etc.) without code changes.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowGuide(!showGuide)} data-testid="button-toggle-guide">
            <FileText className="h-4 w-4 mr-1" /> {showGuide ? "Hide" : "Setup"} Guide
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-add-server">
            <Plus className="h-4 w-4 mr-1" /> Add Server
          </Button>
        </div>
      </div>

      {showGuide && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">How to Connect a New Cloud GPU Server</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-3">
            <div>
              <p className="font-semibold mb-1">1. Prepare your GPU server</p>
              <p className="text-muted-foreground">Set up a GPU server on any cloud provider (AWS, Google Cloud, DigitalOcean, RunPod, etc.). Install the DGB Studio Cloud Engine API on it.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">2. Deploy the Flask API</p>
              <p className="text-muted-foreground font-mono bg-background/50 p-2 rounded">
                export DGB_API_KEY='your_api_key'<br/>
                export TRAINING_WEBHOOK_SECRET='your_webhook_secret'<br/>
                python3 dgb_api_receptor.py
              </p>
              <p className="text-muted-foreground mt-1">The API runs on port 7860 by default. Make sure the port is accessible from the internet.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">3. Add the server here</p>
              <p className="text-muted-foreground">Click "Add Server", enter the server URL, API key, and webhook secret. Select capabilities and set priority (higher = preferred).</p>
            </div>
            <div>
              <p className="font-semibold mb-1">4. Test the connection</p>
              <p className="text-muted-foreground">Use the "Test" button to verify connectivity. The system will automatically use the highest-priority active server for each operation.</p>
            </div>
            <div className="border-t pt-2 mt-2">
              <p className="font-semibold mb-1">Required API Endpoints on Your Server</p>
              <div className="text-muted-foreground font-mono bg-background/50 p-2 rounded space-y-1">
                <p>GET  /api/health - Health check (returns gpu_available)</p>
                <p>POST /api/upload-instrument - Upload audio for analysis</p>
              </div>
              <p className="text-muted-foreground mt-1">The server sends results back via webhook to: <span className="font-mono">/api/dgb-cloud/webhook</span></p>
            </div>
            <div className="border-t pt-2 mt-2">
              <p className="font-semibold mb-1">Multi-Server Setup</p>
              <p className="text-muted-foreground">You can add multiple servers for redundancy. The system uses the highest-priority active server that has the required capability. If a server goes offline, it automatically falls back to the next available one.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{editingServer ? "Edit" : "Add"} Cloud Server</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Server Name *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Primary GPU, AWS East" data-testid="input-server-name" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Base URL *</label>
                <Input value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))} placeholder="https://your-server.com" data-testid="input-server-url" />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">API Port</label>
                <Input type="number" value={form.apiPort} onChange={e => setForm(f => ({ ...f, apiPort: Number(e.target.value) }))} data-testid="input-server-port" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Jupyter Port</label>
                <Input type="number" value={form.jupyterPort} onChange={e => setForm(f => ({ ...f, jupyterPort: Number(e.target.value) }))} placeholder="8888" data-testid="input-jupyter-port" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Priority (higher = preferred)</label>
                <Input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))} data-testid="input-server-priority" />
              </div>
              <div className="flex items-end">
                <Button
                  variant={form.isActive ? "default" : "outline"}
                  size="sm"
                  className="w-full"
                  onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                  data-testid="button-toggle-active"
                >
                  {form.isActive ? <ToggleRight className="h-4 w-4 mr-1" /> : <ToggleLeft className="h-4 w-4 mr-1" />}
                  {form.isActive ? "Active" : "Inactive"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">API Key {editingServer ? "(leave empty to keep)" : ""}</label>
                <Input type="password" value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} placeholder="Your API key" data-testid="input-server-apikey" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Webhook Secret {editingServer ? "(leave empty to keep)" : ""}</label>
                <Input type="password" value={form.webhookSecret} onChange={e => setForm(f => ({ ...f, webhookSecret: e.target.value }))} placeholder="Webhook authentication secret" data-testid="input-server-webhook-secret" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Jupyter Token {editingServer ? "(leave empty to keep)" : ""}</label>
                <Input type="password" value={form.jupyterToken} onChange={e => setForm(f => ({ ...f, jupyterToken: e.target.value }))} placeholder="Jupyter notebook token" data-testid="input-jupyter-token" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Auth Header Name</label>
                <Input value={form.authHeaderName} onChange={e => setForm(f => ({ ...f, authHeaderName: e.target.value }))} data-testid="input-auth-header" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Webhook Header Name</label>
                <Input value={form.webhookHeaderName} onChange={e => setForm(f => ({ ...f, webhookHeaderName: e.target.value }))} data-testid="input-webhook-header" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Health Endpoint</label>
                <Input value={form.healthEndpoint} onChange={e => setForm(f => ({ ...f, healthEndpoint: e.target.value }))} data-testid="input-health-endpoint" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Upload Endpoint</label>
                <Input value={form.uploadEndpoint} onChange={e => setForm(f => ({ ...f, uploadEndpoint: e.target.value }))} data-testid="input-upload-endpoint" />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Capabilities</label>
              <div className="flex flex-wrap gap-2">
                {CAPABILITY_OPTIONS.map(cap => (
                  <Badge
                    key={cap.value}
                    variant={form.capabilities.includes(cap.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleCapability(cap.value)}
                    data-testid={`badge-cap-${cap.value}`}
                  >
                    {form.capabilities.includes(cap.value) ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                    {cap.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes about this server..." rows={2} data-testid="input-server-notes" />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={createServer.isPending || updateServer.isPending} data-testid="button-save-server">
                {(createServer.isPending || updateServer.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                {editingServer ? "Update" : "Add"} Server
              </Button>
              <Button variant="outline" onClick={resetForm} data-testid="button-cancel-server">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {servers?.map(server => (
          <Card key={server.id} className={`${!server.isActive ? "opacity-60" : ""}`} data-testid={`card-server-${server.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm">{server.name}</h3>
                    {server.isActive ? (
                      <Badge variant="default" className="text-xs"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Inactive</Badge>
                    )}
                    {server.status === "connected" && (
                      <Badge variant="default" className="text-xs bg-green-600"><Wifi className="h-3 w-3 mr-1" />Connected</Badge>
                    )}
                    {server.status === "offline" && (
                      <Badge variant="destructive" className="text-xs"><WifiOff className="h-3 w-3 mr-1" />Offline</Badge>
                    )}
                    {server.status === "unknown" && (
                      <Badge variant="outline" className="text-xs"><Activity className="h-3 w-3 mr-1" />Unknown</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{server.baseUrl}:{server.apiPort} {(server as any).jupyterPort ? `(Jupyter: ${(server as any).jupyterPort})` : ""}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {server.capabilities?.map(cap => (
                      <Badge key={cap} variant="outline" className="text-xs">{cap.replace(/_/g, " ")}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>Priority: {server.priority}</span>
                    {server.apiKey && <span><Key className="h-3 w-3 inline mr-1" />API Key: {server.apiKey}</span>}
                    {server.webhookSecret && <span><Shield className="h-3 w-3 inline mr-1" />Webhook: {server.webhookSecret}</span>}
                    {server.lastHealthCheck && <span><Clock className="h-3 w-3 inline mr-1" />Last check: {new Date(server.lastHealthCheck).toLocaleString()}</span>}
                  </div>
                  {server.notes && <p className="text-xs text-muted-foreground mt-1 italic">{server.notes}</p>}
                </div>
                <div className="flex gap-1 ml-3">
                  <Button size="sm" variant="outline" onClick={() => handleTest(server.id)} disabled={testServer.isPending} data-testid={`button-test-server-${server.id}`}>
                    {testServer.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => startEdit(server)} data-testid={`button-edit-server-${server.id}`}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDelete(server.id)} data-testid={`button-delete-server-${server.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!servers || servers.length === 0) && !showForm && (
          <div className="text-center py-12 text-muted-foreground">
            <Cloud className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No cloud servers configured yet.</p>
            <p className="text-xs">The system will use environment variables as fallback. Add a server to manage GPU connections from here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BlogAdminTab() {
  const { data: posts, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/blog/posts"] });
  const { data: categories } = useQuery<any[]>({ queryKey: ["/api/admin/blog/categories"] });
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [postForm, setPostForm] = useState({ title: "", slug: "", content: "", excerpt: "", featuredImageUrl: "", categoryId: "", status: "draft", tags: "", seoTitle: "", seoDescription: "" });
  const [catForm, setCatForm] = useState({ name: "", description: "", color: "#00F3FF" });
  const { toast } = useToast();

  const createPost = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/blog/posts", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/blog/posts"] }); setShowEditor(false); resetPostForm(); toast({ title: "Post creado" }); },
  });

  const updatePost = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/admin/blog/posts/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/blog/posts"] }); setShowEditor(false); setEditingPost(null); resetPostForm(); toast({ title: "Post actualizado" }); },
  });

  const deletePost = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/blog/posts/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/blog/posts"] }); toast({ title: "Post eliminado" }); },
  });

  const createCategory = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/blog/categories", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/blog/categories"] }); setShowCategoryForm(false); setCatForm({ name: "", description: "", color: "#00F3FF" }); toast({ title: "Categoría creada" }); },
  });

  const deleteCategory = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/blog/categories/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/blog/categories"] }); toast({ title: "Categoría eliminada" }); },
  });

  function resetPostForm() {
    setPostForm({ title: "", slug: "", content: "", excerpt: "", featuredImageUrl: "", categoryId: "", status: "draft", tags: "", seoTitle: "", seoDescription: "" });
  }

  function startEdit(post: any) {
    setEditingPost(post);
    setPostForm({
      title: post.title || "",
      slug: post.slug || "",
      content: post.content || "",
      excerpt: post.excerpt || "",
      featuredImageUrl: post.featuredImageUrl || "",
      categoryId: post.categoryId ? String(post.categoryId) : "",
      status: post.status || "draft",
      tags: post.tags || "",
      seoTitle: post.seoTitle || "",
      seoDescription: post.seoDescription || "",
    });
    setShowEditor(true);
  }

  function handleSave() {
    if (editingPost) {
      updatePost.mutate({ id: editingPost.id, data: postForm });
    } else {
      createPost.mutate(postForm);
    }
  }

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (showEditor) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setShowEditor(false); setEditingPost(null); resetPostForm(); }} data-testid="button-back-blog-list">
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver
          </Button>
          <h2 className="text-lg font-semibold">{editingPost ? "Editar Post" : "Nuevo Post"}</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Input placeholder="Título del post" value={postForm.title} onChange={e => setPostForm(p => ({ ...p, title: e.target.value }))} data-testid="input-blog-title" />
            <Input placeholder="slug-del-post (auto-generado si está vacío)" value={postForm.slug} onChange={e => setPostForm(p => ({ ...p, slug: e.target.value }))} data-testid="input-blog-slug" />
            <Textarea placeholder="Contenido del post (HTML soportado)" value={postForm.content} onChange={e => setPostForm(p => ({ ...p, content: e.target.value }))} className="min-h-[300px] font-mono text-sm" data-testid="input-blog-content" />
            <Textarea placeholder="Extracto / resumen corto" value={postForm.excerpt} onChange={e => setPostForm(p => ({ ...p, excerpt: e.target.value }))} rows={3} data-testid="input-blog-excerpt" />
          </div>

          <div className="space-y-4">
            <Card className="bg-card/50 border-white/10">
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold">Publicación</h3>
                <select className="w-full bg-background border border-white/10 rounded-md p-2 text-sm" value={postForm.status} onChange={e => setPostForm(p => ({ ...p, status: e.target.value }))} data-testid="select-blog-status">
                  <option value="draft">Borrador</option>
                  <option value="published">Publicado</option>
                  <option value="archived">Archivado</option>
                </select>
                <select className="w-full bg-background border border-white/10 rounded-md p-2 text-sm" value={postForm.categoryId} onChange={e => setPostForm(p => ({ ...p, categoryId: e.target.value }))} data-testid="select-blog-category">
                  <option value="">Sin categoría</option>
                  {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Input placeholder="Tags (separados por coma)" value={postForm.tags} onChange={e => setPostForm(p => ({ ...p, tags: e.target.value }))} data-testid="input-blog-tags" />
                <Input placeholder="URL imagen destacada" value={postForm.featuredImageUrl} onChange={e => setPostForm(p => ({ ...p, featuredImageUrl: e.target.value }))} data-testid="input-blog-image" />
                <div className="flex items-center gap-2">
                  <label className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      data-testid="input-blog-image-upload"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const formData = new FormData();
                        formData.append("image", file);
                        try {
                          const res = await fetch("/api/admin/blog/upload-image", {
                            method: "POST",
                            body: formData,
                          });
                          const data = await res.json();
                          if (data.url) {
                            setPostForm(p => ({ ...p, featuredImageUrl: data.url }));
                          }
                        } catch (err) {
                          console.error("Upload failed", err);
                        }
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" className="w-full" asChild>
                      <span><Upload className="h-3 w-3 mr-1" /> Subir imagen</span>
                    </Button>
                  </label>
                  {postForm.featuredImageUrl && (
                    <img src={postForm.featuredImageUrl} alt="Preview" className="h-10 w-10 rounded object-cover" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-white/10">
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold">SEO</h3>
                <Input placeholder="SEO Title" value={postForm.seoTitle} onChange={e => setPostForm(p => ({ ...p, seoTitle: e.target.value }))} data-testid="input-blog-seo-title" />
                <Textarea placeholder="SEO Description" value={postForm.seoDescription} onChange={e => setPostForm(p => ({ ...p, seoDescription: e.target.value }))} rows={2} data-testid="input-blog-seo-desc" />
              </CardContent>
            </Card>

            <Button className="w-full" onClick={handleSave} disabled={createPost.isPending || updatePost.isPending} data-testid="button-save-blog-post">
              {(createPost.isPending || updatePost.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {editingPost ? "Actualizar Post" : "Crear Post"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2"><FileText className="h-5 w-5" /> Blog Management</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowCategoryForm(!showCategoryForm)} data-testid="button-manage-categories">
            Categorías
          </Button>
          <Button size="sm" onClick={() => { resetPostForm(); setEditingPost(null); setShowEditor(true); }} data-testid="button-new-blog-post">
            <Plus className="h-4 w-4 mr-1" /> Nuevo Post
          </Button>
        </div>
      </div>

      {showCategoryForm && (
        <Card className="bg-card/50 border-white/10">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold">Categorías</h3>
            <div className="flex gap-2">
              <Input placeholder="Nombre" value={catForm.name} onChange={e => setCatForm(c => ({ ...c, name: e.target.value }))} data-testid="input-category-name" />
              <Input placeholder="Color (#hex)" value={catForm.color} onChange={e => setCatForm(c => ({ ...c, color: e.target.value }))} className="w-32" data-testid="input-category-color" />
              <Button size="sm" onClick={() => createCategory.mutate(catForm)} disabled={createCategory.isPending || !catForm.name} data-testid="button-create-category">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {categories?.map((cat: any) => (
                <Badge key={cat.id} variant="outline" className="flex items-center gap-1 py-1" style={{ borderColor: cat.color }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                  <button onClick={() => deleteCategory.mutate(cat.id)} className="ml-1 hover:text-destructive" data-testid={`button-delete-category-${cat.id}`}>
                    <XCircle className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {posts?.map((post: any) => (
          <Card key={post.id} className="bg-card/50 border-white/10" data-testid={`card-admin-blog-post-${post.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm truncate">{post.title}</h3>
                    <Badge variant={post.status === "published" ? "default" : "secondary"} className="text-xs">
                      {post.status === "published" ? "Publicado" : post.status === "draft" ? "Borrador" : "Archivado"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">/{post.slug} • {post.viewCount || 0} vistas • {new Date(post.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => startEdit(post)} data-testid={`button-edit-post-${post.id}`}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => deletePost.mutate(post.id)} data-testid={`button-delete-post-${post.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!posts || posts.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay posts aún.</p>
            <p className="text-xs">Crea tu primer post para el blog de DGB Audio.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BillingAdminTab() {
  const { data: plans, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/pricing/plans"] });
  const { data: transactions } = useQuery<any[]>({ queryKey: ["/api/admin/stripe/transactions"] });
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: "", tier: "pro", description: "", features: "",
    priceMonthly: 0, priceAnnual: 0,
    stripePriceIdMonthly: "", stripePriceIdAnnual: "", stripeProductId: "",
    credits: 0, creditsLabel: "", iconName: "Zap", color: "text-blue-400",
    isActive: true, isPopular: false, order: 0,
  });
  const { toast } = useToast();

  const createPlan = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/pricing/plans", { ...data, features: data.features.split("\n").filter((f: string) => f.trim()), priceMonthly: parseInt(data.priceMonthly) || 0, priceAnnual: parseInt(data.priceAnnual) || 0, credits: parseInt(data.credits) || 0, order: parseInt(data.order) || 0 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/pricing/plans"] }); setShowForm(false); toast({ title: "Plan creado" }); },
  });

  const updatePlan = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/admin/pricing/plans/${id}`, { ...data, features: data.features.split("\n").filter((f: string) => f.trim()), priceMonthly: parseInt(data.priceMonthly) || 0, priceAnnual: parseInt(data.priceAnnual) || 0, credits: parseInt(data.credits) || 0, order: parseInt(data.order) || 0 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/pricing/plans"] }); setShowForm(false); setEditingPlan(null); toast({ title: "Plan actualizado" }); },
  });

  const deletePlan = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/pricing/plans/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/pricing/plans"] }); toast({ title: "Plan eliminado" }); },
  });

  function resetForm() {
    setForm({ name: "", tier: "pro", description: "", features: "", priceMonthly: 0, priceAnnual: 0, stripePriceIdMonthly: "", stripePriceIdAnnual: "", stripeProductId: "", credits: 0, creditsLabel: "", iconName: "Zap", color: "text-blue-400", isActive: true, isPopular: false, order: 0 });
  }

  function startEdit(plan: any) {
    setEditingPlan(plan);
    setForm({
      name: plan.name || "", tier: plan.tier || "pro", description: plan.description || "",
      features: (plan.features || []).join("\n"),
      priceMonthly: plan.priceMonthly || 0, priceAnnual: plan.priceAnnual || 0,
      stripePriceIdMonthly: plan.stripePriceIdMonthly || "", stripePriceIdAnnual: plan.stripePriceIdAnnual || "",
      stripeProductId: plan.stripeProductId || "",
      credits: plan.credits || 0, creditsLabel: plan.creditsLabel || "",
      iconName: plan.iconName || "Zap", color: plan.color || "text-blue-400",
      isActive: plan.isActive !== false, isPopular: plan.isPopular || false, order: plan.order || 0,
    });
    setShowForm(true);
  }

  function handleSave() {
    if (editingPlan) {
      updatePlan.mutate({ id: editingPlan.id, data: form });
    } else {
      createPlan.mutate(form);
    }
  }

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2"><CreditCard className="h-5 w-5" /> Billing & Pricing</h2>
        <Button size="sm" onClick={() => { resetForm(); setEditingPlan(null); setShowForm(!showForm); }} data-testid="button-new-pricing-plan">
          <Plus className="h-4 w-4 mr-1" /> {showForm ? "Cancelar" : "Nuevo Plan"}
        </Button>
      </div>

      {showForm && (
        <Card className="bg-card/50 border-white/10">
          <CardContent className="p-4 space-y-4">
            <h3 className="font-semibold text-sm">{editingPlan ? "Editar Plan" : "Nuevo Plan de Precio"}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input placeholder="Nombre del plan" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="input-plan-name" />
              <select className="bg-background border border-white/10 rounded-md p-2 text-sm" value={form.tier} onChange={e => setForm(f => ({ ...f, tier: e.target.value }))} data-testid="select-plan-tier">
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="producer">Producer</option>
                <option value="premium">Premium</option>
              </select>
              <Input placeholder="Precio mensual (en centavos)" type="number" value={form.priceMonthly} onChange={e => setForm(f => ({ ...f, priceMonthly: parseInt(e.target.value) || 0 }))} data-testid="input-plan-price-monthly" />
              <Input placeholder="Precio anual (en centavos)" type="number" value={form.priceAnnual} onChange={e => setForm(f => ({ ...f, priceAnnual: parseInt(e.target.value) || 0 }))} data-testid="input-plan-price-annual" />
              <Input placeholder="Créditos incluidos" type="number" value={form.credits} onChange={e => setForm(f => ({ ...f, credits: parseInt(e.target.value) || 0 }))} data-testid="input-plan-credits" />
              <Input placeholder="Label créditos (ej: 100/mes)" value={form.creditsLabel} onChange={e => setForm(f => ({ ...f, creditsLabel: e.target.value }))} data-testid="input-plan-credits-label" />
              <Input placeholder="Orden (0, 1, 2...)" type="number" value={form.order} onChange={e => setForm(f => ({ ...f, order: parseInt(e.target.value) || 0 }))} data-testid="input-plan-order" />
              <Input placeholder="Color (text-blue-400)" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} data-testid="input-plan-color" />
            </div>
            <Textarea placeholder="Descripción del plan" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} data-testid="input-plan-description" />
            <Textarea placeholder="Features (una por línea)" value={form.features} onChange={e => setForm(f => ({ ...f, features: e.target.value }))} rows={5} data-testid="input-plan-features" />

            <div className="border-t border-white/10 pt-3">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">Stripe IDs (vincular con productos de Stripe)</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input placeholder="Stripe Product ID" value={form.stripeProductId} onChange={e => setForm(f => ({ ...f, stripeProductId: e.target.value }))} data-testid="input-plan-stripe-product" />
                <Input placeholder="Stripe Price ID (mensual)" value={form.stripePriceIdMonthly} onChange={e => setForm(f => ({ ...f, stripePriceIdMonthly: e.target.value }))} data-testid="input-plan-stripe-price-monthly" />
                <Input placeholder="Stripe Price ID (anual)" value={form.stripePriceIdAnnual} onChange={e => setForm(f => ({ ...f, stripePriceIdAnnual: e.target.value }))} data-testid="input-plan-stripe-price-annual" />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                Activo
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.isPopular} onChange={e => setForm(f => ({ ...f, isPopular: e.target.checked }))} />
                Popular (destacado)
              </label>
            </div>

            <Button onClick={handleSave} disabled={createPlan.isPending || updatePlan.isPending} data-testid="button-save-pricing-plan">
              {(createPlan.isPending || updatePlan.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {editingPlan ? "Actualizar Plan" : "Crear Plan"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Planes de Precio</h3>
        {plans?.map((plan: any) => (
          <Card key={plan.id} className="bg-card/50 border-white/10" data-testid={`card-pricing-plan-${plan.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm">{plan.name}</h3>
                    <Badge variant="outline" className="text-xs capitalize">{plan.tier}</Badge>
                    {plan.isPopular && <Badge className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Popular</Badge>}
                    {!plan.isActive && <Badge variant="secondary" className="text-xs">Inactivo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">${(plan.priceMonthly / 100).toFixed(2)}/mes • {plan.credits} créditos • Orden: {plan.order}</p>
                  {plan.stripeProductId && <p className="text-xs text-muted-foreground mt-1">Stripe: {plan.stripeProductId}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => startEdit(plan)} data-testid={`button-edit-plan-${plan.id}`}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => deletePlan.mutate(plan.id)} data-testid={`button-delete-plan-${plan.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!plans || plans.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            <CreditCard className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay planes configurados.</p>
            <p className="text-xs">Crea planes de precio para mostrar en la página de precios.</p>
          </div>
        )}
      </div>

      {transactions && transactions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Transacciones Recientes (Stripe)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-2 text-xs text-muted-foreground">Fecha</th>
                  <th className="text-left py-2 px-2 text-xs text-muted-foreground">Monto</th>
                  <th className="text-left py-2 px-2 text-xs text-muted-foreground">Estado</th>
                  <th className="text-left py-2 px-2 text-xs text-muted-foreground">Email</th>
                  <th className="text-left py-2 px-2 text-xs text-muted-foreground">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx: any) => (
                  <tr key={tx.id} className="border-b border-white/5" data-testid={`row-transaction-${tx.id}`}>
                    <td className="py-2 px-2 text-xs">{new Date(tx.created * 1000).toLocaleDateString()}</td>
                    <td className="py-2 px-2 text-xs font-semibold">${(tx.amount / 100).toFixed(2)} {tx.currency?.toUpperCase()}</td>
                    <td className="py-2 px-2"><Badge variant={tx.status === "succeeded" ? "default" : "secondary"} className="text-xs">{tx.status}</Badge></td>
                    <td className="py-2 px-2 text-xs text-muted-foreground">{tx.customerEmail || "—"}</td>
                    <td className="py-2 px-2 text-xs text-muted-foreground truncate max-w-[200px]">{tx.description || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
