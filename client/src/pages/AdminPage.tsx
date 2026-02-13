import { useState } from "react";
import { useLocation } from "wouter";
import {
  useAdminCheck, useAdminMeta, useProviders, useEndpoints,
  useCreateProvider, useUpdateProvider, useDeleteProvider,
  useCreateEndpoint, useUpdateEndpoint, useDeleteEndpoint,
  useTestEndpoint,
} from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Settings, Plus, Trash2, Edit, CheckCircle, XCircle,
  Server, Zap, ArrowLeft, TestTube, Loader2, Save,
  Shield, Globe, Key, ToggleLeft, ToggleRight,
} from "lucide-react";
import type { ApiProvider, ApiEndpoint } from "@shared/schema";

type Tab = "providers" | "endpoints";

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

  return <AdminDashboard />;
}

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("providers");
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);
  const [editingProvider, setEditingProvider] = useState<Partial<ApiProvider> | null>(null);
  const [editingEndpoint, setEditingEndpoint] = useState<Partial<ApiEndpoint> | null>(null);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6" data-testid="admin-dashboard">
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-tr from-primary to-blue-600 p-2 rounded-lg">
          <Settings className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">API Provider Admin</h1>
          <p className="text-xs text-muted-foreground">Configure API providers, endpoints, and operation mappings</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant={activeTab === "providers" ? "default" : "outline"}
          size="sm"
          onClick={() => { setActiveTab("providers"); setSelectedProviderId(null); }}
          data-testid="tab-providers"
        >
          <Server className="h-4 w-4 mr-1" /> Providers
        </Button>
        <Button
          variant={activeTab === "endpoints" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("endpoints")}
          data-testid="tab-endpoints"
        >
          <Zap className="h-4 w-4 mr-1" /> Endpoints
        </Button>
      </div>

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
