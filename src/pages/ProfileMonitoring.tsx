import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle, Info, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProfileLog {
  id: string;
  user_id: string;
  email: string | null;
  event_type: string;
  message: string;
  error_details: any;
  metadata: any;
  created_at: string;
}

interface SyncStatus {
  total_users: number;
  users_with_profiles: number;
  users_without_profiles: number;
  recent_errors: number;
  last_error_message: string | null;
}

interface MissingProfile {
  user_id: string;
  email: string;
  user_created_at: string;
  email_confirmed_at: string | null;
  last_log_time: string | null;
  last_event_type: string | null;
  last_message: string | null;
}

export default function ProfileMonitoring() {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<ProfileLog[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [missingProfiles, setMissingProfiles] = useState<MissingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/");
    }
  }, [isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Carregar logs
      const { data: logsData, error: logsError } = await supabase
        .from("profile_creation_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (logsError) throw logsError;
      setLogs(logsData || []);

      // Carregar status de sincronização
      const { data: statusData, error: statusError } = await supabase.rpc(
        "check_profile_sync_status"
      );

      if (statusError) throw statusError;
      if (statusData && statusData.length > 0) {
        setSyncStatus(statusData[0]);
      }

      // Carregar perfis faltantes
      const { data: missingData, error: missingError } = await supabase.rpc(
        "get_users_without_profiles"
      );

      if (missingError) throw missingError;
      setMissingProfiles(missingData || []);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados de monitoramento");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncMissingProfiles = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.rpc("sync_missing_profiles");

      if (error) throw error;

      const message = typeof data === 'object' && data !== null && 'message' in data
        ? String(data.message)
        : "Sincronização concluída";
      toast.success(message);
      loadData(); // Recarregar dados
    } catch (error: any) {
      console.error("Erro ao sincronizar perfis:", error);
      toast.error("Erro ao sincronizar perfis faltantes");
    } finally {
      setSyncing(false);
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getEventBadge = (eventType: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary"> = {
      success: "default",
      error: "destructive",
      warning: "secondary",
      info: "secondary",
    };

    return (
      <Badge variant={variants[eventType] || "secondary"}>
        {eventType}
      </Badge>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0e0e10] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0e0e10] text-white font-sans p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-white tracking-tight">Monitoramento de Perfis</h1>
            <p className="text-gray-400 text-[13px] mt-1">
              Logs e sincronização de criação de perfis
            </p>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1c1c1e] border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>

        {/* Cards de Status */}
        {syncStatus && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#1c1c1e] border border-white/5 rounded-2xl p-4 shadow-lg">
              <p className="text-sm font-medium text-gray-400 mb-2">
                Total de Usuários
              </p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-white">
                  {syncStatus.total_users}
                </span>
                <Users className="h-8 w-8 text-gray-500" />
              </div>
            </div>

            <div className="bg-[#1c1c1e] border border-white/5 rounded-2xl p-4 shadow-lg">
              <p className="text-sm font-medium text-gray-400 mb-2">
                Com Perfis
              </p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-emerald-400">
                  {syncStatus.users_with_profiles}
                </span>
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
            </div>

            <div className="bg-[#1c1c1e] border border-white/5 rounded-2xl p-4 shadow-lg">
              <p className="text-sm font-medium text-gray-400 mb-2">
                Sem Perfis
              </p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-red-400">
                  {syncStatus.users_without_profiles}
                </span>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </div>

            <div className="bg-[#1c1c1e] border border-white/5 rounded-2xl p-4 shadow-lg">
              <p className="text-sm font-medium text-gray-400 mb-2">
                Erros (24h)
              </p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-white">
                  {syncStatus.recent_errors}
                </span>
                <AlertCircle className="h-8 w-8 text-gray-500" />
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="logs" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="logs">Logs de Eventos</TabsTrigger>
            <TabsTrigger value="missing">Perfis Faltantes</TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Eventos</CardTitle>
                <CardDescription>
                  Últimos 100 eventos de criação de perfis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {logs.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum log registrado
                    </p>
                  ) : (
                    logs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="mt-1">{getEventIcon(log.event_type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getEventBadge(log.event_type)}
                            <span className="text-sm text-muted-foreground">
                              {format(
                                new Date(log.created_at),
                                "dd/MM/yyyy HH:mm:ss",
                                { locale: ptBR }
                              )}
                            </span>
                            {log.email && (
                              <span className="text-sm font-mono">
                                {log.email}
                              </span>
                            )}
                          </div>
                          <p className="text-sm mt-1">{log.message}</p>
                          {log.error_details && (
                            <details className="mt-2">
                              <summary className="text-xs text-destructive cursor-pointer">
                                Detalhes do erro
                              </summary>
                              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                                {JSON.stringify(log.error_details, null, 2)}
                              </pre>
                            </details>
                          )}
                          {log.metadata && (
                            <details className="mt-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer">
                                Metadados
                              </summary>
                              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="missing" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Usuários Sem Perfil</CardTitle>
                <CardDescription>
                  Usuários que não têm perfil criado na tabela profiles
                </CardDescription>
              </CardHeader>
              <CardContent>
                {missingProfiles.length > 0 && (
                  <div className="mb-4">
                    <Button
                      onClick={handleSyncMissingProfiles}
                      disabled={syncing}
                      className="w-full sm:w-auto"
                    >
                      {syncing ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Sincronizar Perfis Faltantes
                        </>
                      )}
                    </Button>
                  </div>
                )}

                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {missingProfiles.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                      <p className="text-muted-foreground">
                        Todos os usuários têm perfis criados!
                      </p>
                    </div>
                  ) : (
                    missingProfiles.map((profile) => (
                      <div
                        key={profile.user_id}
                        className="p-3 border rounded-lg space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm">
                            {profile.email}
                          </span>
                          {profile.last_event_type && (
                            <Badge variant="secondary">
                              {profile.last_event_type}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>
                            Criado em:{" "}
                            {format(
                              new Date(profile.user_created_at),
                              "dd/MM/yyyy HH:mm",
                              { locale: ptBR }
                            )}
                          </p>
                          {profile.last_log_time && (
                            <p>
                              Último log:{" "}
                              {format(
                                new Date(profile.last_log_time),
                                "dd/MM/yyyy HH:mm",
                                { locale: ptBR }
                              )}
                            </p>
                          )}
                          {profile.last_message && (
                            <p className="italic">{profile.last_message}</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
