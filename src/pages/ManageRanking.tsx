import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RankingInput } from "@/components/ui/ranking-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import { getUserFriendlyError } from "@/lib/errorHandler";
import { Trash2, Upload, HelpCircle, RotateCcw, UserPlus, Save, AlertCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { z } from "zod";
import * as XLSX from "xlsx";
import Papa from "papaparse";

interface PlayerRanking {
  id: string;
  player_id: string;
  nickname: string;
  email: string | null;
  gols: number;
  assistencias: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  presencas: number;
  faltas: number;
  atrasos: number;
  punicoes: number;
  cartoes_amarelos: number;
  cartoes_azuis: number;
  pontos_totais: number;
}

interface EditedRanking {
  id: string;
  changes: Partial<PlayerRanking>;
}

interface AvailablePlayer {
  id: string;
  nickname: string | null;
  name: string;
  email: string | null;
}

const ManageRanking = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [rankings, setRankings] = useState<PlayerRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [editedRankings, setEditedRankings] = useState<Map<string, Partial<PlayerRanking>>>(new Map());
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [availablePlayers, setAvailablePlayers] = useState<AvailablePlayer[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
      toast({
        title: "Acesso negado",
        description: "Acesso restrito a administradores.",
        variant: "destructive",
      });
    } else {
      loadRankings();
    }
  }, [isAdmin, navigate]);

  // ✅ Restaurar alterações pendentes após re-autenticação
  useEffect(() => {
    const pendingChanges = localStorage.getItem('pending_ranking_changes');
    
    if (pendingChanges) {
      try {
        const parsedChanges = JSON.parse(pendingChanges);
        const restoredMap = new Map<string, Partial<PlayerRanking>>(parsedChanges);
        
        setEditedRankings(restoredMap);
        localStorage.removeItem('pending_ranking_changes');
        
        console.log("✅ Alterações restauradas:", restoredMap.size, "jogador(es)");
        
        toast({
          title: "Alterações restauradas",
          description: `${restoredMap.size} jogador(es) com alterações pendentes foram restaurados.`,
        });
      } catch (e) {
        console.error('❌ Erro ao restaurar alterações:', e);
        localStorage.removeItem('pending_ranking_changes');
      }
    }
  }, []);

  const fetchRankingsRaw = async (): Promise<PlayerRanking[]> => {
    const { data, error } = await supabase
      .from("player_rankings")
      .select("*")
      .order("pontos_totais", { ascending: false });

    if (error) throw error;
    return data || [];
  };

  const loadRankings = async () => {
    setLoading(true);
    try {
      const data = await fetchRankingsRaw();
      setRankings(data);
      setEditedRankings(new Map());
    } catch (error: any) {
      toast({
        title: "Erro ao carregar classificação",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAvailablePlayers = async () => {
    try {
      const { data: rankingPlayerIds } = await supabase
        .from("player_rankings")
        .select("player_id");
      
      const excludeIds = rankingPlayerIds?.map(r => r.player_id) || [];
      
      let query = supabase
        .from("profiles")
        .select("id, nickname, name, email")
        .eq("is_player", true)
        .eq("status", "aprovado")
        .order("nickname");
      
      if (excludeIds.length > 0) {
        query = query.not("id", "in", `(${excludeIds.join(",")})`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setAvailablePlayers(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar jogadores",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addPlayersToRanking = async () => {
    if (selectedPlayers.length === 0) {
      toast({
        title: "Nenhum jogador selecionado",
        description: "Selecione ao menos um jogador para adicionar.",
      });
      return;
    }

    try {
      const inserts = selectedPlayers.map(playerId => {
        const player = availablePlayers.find(p => p.id === playerId);
        return {
          player_id: playerId,
          nickname: player?.nickname || player?.name || "Jogador",
          email: player?.email,
          gols: 0,
          assistencias: 0,
          vitorias: 0,
          empates: 0,
          derrotas: 0,
          presencas: 0,
          faltas: 0,
          atrasos: 0,
          punicoes: 0,
          cartoes_amarelos: 0,
          cartoes_azuis: 0,
          pontos_totais: 0,
        };
      });

      const { error } = await supabase
        .from("player_rankings")
        .insert(inserts);

      if (error) throw error;

      toast({
        title: `${selectedPlayers.length} jogador(es) adicionado(s)`,
        description: "Jogadores incluídos na classificação com valores zerados.",
      });
      
      setShowAddDialog(false);
      setSelectedPlayers([]);
      await loadRankings();
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar jogadores",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deletePlayerCompletely = async (playerId: string, playerName: string) => {
    try {
      const { error: rankError } = await supabase
        .from("player_rankings")
        .delete()
        .eq("player_id", playerId);
      
      if (rankError) throw rankError;

      const { error: statsError } = await supabase
        .from("player_round_stats")
        .delete()
        .eq("player_id", playerId);

      if (statsError) throw statsError;

      toast({
        title: "Jogador removido da classificação",
        description: `${playerName} e todos os seus dados foram excluídos. Perfil mantido.`,
      });

      await loadRankings();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir jogador",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const recalculateRankings = async () => {
    setRecalculating(true);
    try {
      const { data, error } = await supabase.rpc('recalc_all_player_rankings');
      
      if (error) throw error;
      
      await loadRankings();
      
      toast({
        title: "Classificação recalculada",
        description: "Todas as estatísticas foram atualizadas com base nas rodadas finalizadas.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao recalcular",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRecalculating(false);
    }
  };

  const rankingSchema = z.object({
    pontos_totais: z.number().int().min(0).max(999999),
    gols: z.number().int().min(0).max(9999).optional(),
    assistencias: z.number().int().min(0).max(9999).optional(),
    vitorias: z.number().int().min(0).max(9999).optional(),
    empates: z.number().int().min(0).max(9999).optional(),
    derrotas: z.number().int().min(0).max(9999).optional(),
    presencas: z.number().int().min(0).max(9999).optional(),
    faltas: z.number().int().min(0).max(9999).optional(),
    atrasos: z.number().int().min(0).max(9999).optional(),
    punicoes: z.number().int().min(0).max(9999).optional(),
    cartoes_amarelos: z.number().int().min(0).max(9999).optional(),
    cartoes_azuis: z.number().int().min(0).max(9999).optional(),
  });

  const updateRankingField = (id: string, field: keyof PlayerRanking, value: number | string) => {
    const numValue = typeof value === 'string' ? parseInt(value) || 0 : value;
    
    // Validate the field
    const validation = rankingSchema.partial().safeParse({ [field]: numValue });
    if (!validation.success) {
      toast({
        title: "Erro de validação",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setRankings((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: numValue } : r))
    );

    setEditedRankings((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(id) || {};
      newMap.set(id, { ...existing, [field]: numValue });
      return newMap;
    });
  };

  const saveChanges = async () => {
    if (editedRankings.size === 0) {
      toast({
        title: "Nenhuma alteração",
        description: "Não há alterações pendentes para salvar.",
        variant: "default",
      });
      return;
    }

    // ✅ Verificação robusta de sessão
    console.log("🔍 Verificando sessão antes de salvar...");
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("❌ Erro ao verificar sessão:", sessionError);
      toast({
        title: "Erro de autenticação",
        description: "Não foi possível verificar sua sessão. Faça login novamente.",
        variant: "destructive",
      });
      localStorage.setItem('pending_ranking_changes', JSON.stringify(Array.from(editedRankings.entries())));
      navigate('/auth');
      return;
    }
    
    if (!session) {
      console.warn("⚠️ Sessão não encontrada");
      toast({
        title: "Sessão expirada",
        description: "Sua sessão expirou. Faça login novamente para salvar as alterações.",
        variant: "destructive",
      });
      localStorage.setItem('pending_ranking_changes', JSON.stringify(Array.from(editedRankings.entries())));
      navigate('/auth');
      return;
    }
    
    // ✅ Verificar validade do token
    const tokenExpiry = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    
    if (tokenExpiry && tokenExpiry < now) {
      console.warn("⚠️ Token JWT expirado, tentando renovar...");
      
      // Tentar refresh token automaticamente
      const { error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error("❌ Falha ao renovar token:", refreshError);
        toast({
          title: "Token expirado",
          description: "Não foi possível renovar sua sessão. Faça login novamente.",
          variant: "destructive",
        });
        localStorage.setItem('pending_ranking_changes', JSON.stringify(Array.from(editedRankings.entries())));
        navigate('/auth');
        return;
      }
      
      console.log("✅ Token renovado com sucesso");
    }
    
    // ✅ Log de debug
    console.log("✅ Sessão válida:", {
      userId: session.user.id,
      expiresAt: tokenExpiry ? new Date(tokenExpiry * 1000).toLocaleString() : 'N/A',
    });

    setSaving(true);
    
    try {
      // Passo 1: Aplicar ajustes individuais
      toast({
        title: "⏳ Passo 1/3: Aplicando ajustes...",
        description: `Processando ${editedRankings.size} jogador(es)`,
      });

      const adjustmentPromises = Array.from(editedRankings.entries()).flatMap(
        ([rankingId, fields]) => {
          const ranking = rankings.find(r => r.id === rankingId);
          if (!ranking) return [];

          return Object.entries(fields).map(([field, value]) => {
            const adjustmentTypeMap: Record<string, string> = {
              gols: 'gols',
              assistencias: 'assistencias',
              vitorias: 'vitorias',
              empates: 'empates',
              derrotas: 'derrotas',
              presencas: 'presencas',
              faltas: 'faltas',
              atrasos: 'atrasos',
              punicoes: 'punicoes',
              cartoes_amarelos: 'cartoes_amarelos',
              cartoes_azuis: 'cartoes_azuis',
            };

            const adjustmentType = adjustmentTypeMap[field];
            if (!adjustmentType) return null;

            return supabase.rpc('apply_ranking_adjustment', {
              p_player_id: ranking.player_id,
              p_adjustment_type: adjustmentType,
              p_new_total: value as number,
              p_reason: `Ajuste manual via interface administrativa`,
            });
          }).filter(Boolean);
        }
      );

      const results = await Promise.all(adjustmentPromises);

      // Verificar erros de RPC (erro de conexão, permissão, etc.)
      const rpcErrors = results.filter(r => r.error);
      if (rpcErrors.length > 0) {
        console.error("Erros de RPC nos ajustes:", rpcErrors);
        throw new Error(rpcErrors[0].error.message || "Erro ao aplicar ajustes");
      }

      // Verificar erros nos dados retornados (success === false)
      const dataErrors = results.filter(r => {
        const data = r.data as any;
        return data?.success === false;
      });
      
      if (dataErrors.length > 0) {
        const errorData = dataErrors[0].data as any;
        console.error("Erro no resultado do ajuste:", errorData);
        throw new Error(errorData?.error || "Erro ao aplicar ajustes");
      }

      // Passo 2: Recalcular classificação
      toast({
        title: "⏳ Passo 2/4: Recalculando pontos...",
        description: "Atualizando classificação geral com os ajustes aplicados",
      });

      const { data: recalcData, error: recalcError } = await supabase.rpc('recalc_all_player_rankings');
      
      if (recalcError) {
        console.error("Erro ao recalcular rankings:", recalcError);
        throw new Error("Erro ao recalcular classificação: " + recalcError.message);
      }

      const recalcResult = recalcData as any;
      if (recalcResult?.success === false) {
        console.error("Recalculo retornou falha:", recalcResult);
        throw new Error(recalcResult.error || "Erro ao recalcular classificação");
      }

      // Passo 3: Aguardar processamento com retry
      toast({
        title: "⏳ Passo 3/4: Aguardando processamento...",
        description: "Garantindo consistência dos dados",
      });

      await new Promise(resolve => setTimeout(resolve, 1500));

      // Passo 4: Recarregar dados com retry usando fetch direto do backend
      toast({
        title: "⏳ Passo 4/4: Confirmando atualização...",
        description: "Verificando dados no backend",
      });

      let retries = 0;
      const maxRetries = 3;
      let lastData = rankings;

      while (retries < maxRetries) {
        lastData = await fetchRankingsRaw();

        if (editedRankings.size > 0) {
          const [rankingId, fields] = Array.from(editedRankings.entries())[0];
          const currentRank = lastData.find(r => r.id === rankingId);
          const firstField = Object.keys(fields)[0] as keyof PlayerRanking;

          if (currentRank && currentRank[firstField] === fields[firstField]) {
            console.log("✅ Dados atualizados confirmados no backend:", {
              id: rankingId,
              field: firstField,
              value: currentRank[firstField],
            });
            break;
          }
        } else {
          break;
        }

        retries++;
        if (retries < maxRetries) {
          console.log(`🔄 Tentativa ${retries + 1}/${maxRetries} de verificação no backend...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Atualizar estado local com a última versão confirmada do backend
      setRankings(lastData);

      console.log('📊 Estado atualizado com dados confirmados:', lastData.length, 'jogadores');

      // Sucesso final
      toast({
        title: "✅ Alterações salvas com sucesso!",
        description: `${editedRankings.size} jogador(es) atualizado(s). Classificação recalculada.`,
      });

      setEditedRankings(new Map());
    } catch (error: any) {
      console.error("Erro completo:", error);
      toast({
        title: "❌ Erro ao salvar ajustes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetOnly = async () => {
    setResetting(true);
    try {
      const { data, error } = await supabase.rpc('reset_full_classification');
      if (error) throw error;
      
      const result = data as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error);
      
      await loadRankings();
      toast({
        title: "Classificação resetada completamente",
        description: "Todos os dados de classificação foram removidos.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao resetar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  };

  const resetAndRecalculate = async () => {
    setResetting(true);
    
    try {
      // Passo 1: Reset completo
      const { data: resetData, error: resetError } = await supabase.rpc('reset_full_classification');
      if (resetError) throw resetError;
      
      const resetResult = resetData as { success: boolean; error?: string };
      if (!resetResult.success) throw new Error(resetResult.error);
      
      toast({
        title: "Reset concluído",
        description: "Iniciando recálculo...",
      });
      
      // Passo 2: Recalcular agregados de CADA rodada finalizada
      const { data: rounds } = await supabase
        .from('rounds')
        .select('id')
        .eq('status', 'finalizada');
      
      for (const round of rounds || []) {
        await supabase.rpc('recalc_round_aggregates', { p_round_id: round.id });
      }
      
      // Passo 3: Recalcular rankings globais (sem ajustes, pois foram removidos)
      const { data: recalcData, error: recalcError } = await supabase.rpc('recalc_all_player_rankings');
      if (recalcError) throw recalcError;
      
      const recalcResult = recalcData as { success: boolean; error?: string };
      if (recalcResult && !recalcResult.success) throw new Error(recalcResult.error);
      
      await loadRankings();
      toast({
        title: "Concluído!",
        description: "Classificação resetada e recalculada com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao processar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResetting(false);
      setRecalculating(false);
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const fileExtension = file.name.split(".").pop()?.toLowerCase();

      if (fileExtension === "csv") {
        const text = await file.text();
        Papa.parse(text, {
          header: true,
          complete: (results) => {
            processImportedData(results.data);
          },
        });
      } else if (fileExtension === "xlsx" || fileExtension === "xls") {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        processImportedData(jsonData);
      } else {
        toast({
          title: "Formato inválido",
          description: "Use arquivos .csv, .xlsx ou .xls",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao importar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const processImportedData = async (data: any[]) => {
    if (data.length > 0) {
      const firstRow = data[0];
      const hasEmailColumn = "Email" in firstRow || "email" in firstRow;
      if (!hasEmailColumn) {
        toast({
          title: "Coluna obrigatória ausente",
          description: "A coluna 'Email' é obrigatória para importação de classificação.",
          variant: "destructive",
        });
        return;
      }
    }

    const upserts: any[] = [];
    const invalidRows: string[] = [];
    let updated = 0;
    let created = 0;

    for (const row of data) {
      const email = (row["Email"] || row["email"])?.toString().toLowerCase().trim();
      
      if (!email) {
        invalidRows.push(JSON.stringify(row));
        continue;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .single();

      if (!profileData) {
        invalidRows.push(`Email ${email} não encontrado`);
        continue;
      }

      const player_id = profileData.id;

      const { data: existingRanking } = await supabase
        .from("player_rankings")
        .select("id")
        .eq("player_id", player_id)
        .single();

      if (existingRanking) {
        updated++;
      } else {
        created++;
      }

      upserts.push({
        player_id,
        nickname: row["Nickname"] || row["nickname"] || email,
        email: email,
        gols: parseInt(row["Gols"] || row["gols"] || "0"),
        assistencias: parseInt(row["Assistencias"] || row["assistencias"] || "0"),
        vitorias: parseInt(row["Vitorias"] || row["vitorias"] || "0"),
        empates: parseInt(row["Empates"] || row["empates"] || "0"),
        derrotas: parseInt(row["Derrotas"] || row["derrotas"] || "0"),
        presencas: parseInt(row["Presencas"] || row["presencas"] || "0"),
        faltas: parseInt(row["Faltas"] || row["faltas"] || "0"),
        atrasos: parseInt(row["Atrasos"] || row["atrasos"] || "0"),
        punicoes: parseInt(row["Punicoes"] || row["punicoes"] || "0"),
        cartoes_amarelos: parseInt(row["Cartoes_Amarelos"] || row["cartoes_amarelos"] || "0"),
        cartoes_azuis: parseInt(row["Cartoes_Azuis"] || row["cartoes_azuis"] || "0"),
        pontos_totais: parseInt(row["Pontos_Totais"] || row["pontos_totais"] || "0"),
      });
    }

    if (upserts.length > 0) {
      try {
        const { error } = await supabase
          .from("player_rankings")
          .upsert(upserts, { onConflict: "player_id" });

        if (error) throw error;

        let message = `${updated} atualizado(s), ${created} novo(s) criado(s)`;
        if (invalidRows.length > 0) {
          message += `, ${invalidRows.length} linha(s) ignorada(s)`;
        }

        toast({
          title: "Importação concluída",
          description: message,
        });

        loadRankings();
      } catch (error: any) {
        toast({
          title: "Erro ao processar importação",
          description: error.message,
          variant: "destructive",
        });
      }
    }

    if (invalidRows.length > 0 && upserts.length === 0) {
      toast({
        title: "Nenhum dado válido",
        description: `${invalidRows.length} linha(s) sem e-mail foram ignoradas`,
        variant: "destructive",
      });
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card className="bg-card/50 border-primary/20">
            <CardHeader>
              <CardTitle className="text-primary">Acesso Restrito</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Acesso restrito a administradores.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <Card className="bg-card/50 border-primary/20 shadow-card-glow">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="text-primary text-2xl">
                Gerenciar Classificação Geral
              </CardTitle>
              
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-wrap">
                <Button 
                  onClick={() => {
                    loadAvailablePlayers();
                    setShowAddDialog(true);
                  }}
                  variant="default"
                  className="w-full sm:w-auto min-h-[44px]"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Incluir Jogadores
                </Button>

                {editedRankings.size > 0 && (
                  <Button 
                    onClick={saveChanges}
                    disabled={saving}
                    className="w-full sm:w-auto min-h-[44px] bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Salvando..." : `Salvar Alterações (${editedRankings.size})`}
                  </Button>
                )}

                <Button 
                  onClick={recalculateRankings}
                  disabled={recalculating}
                  variant="secondary"
                  className="w-full sm:w-auto min-h-[44px]"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {recalculating ? "Recalculando..." : "Recalcular"}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full sm:w-auto min-h-[44px]">
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Resetar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-border">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-destructive">
                        ⚠️ Resetar Classificação Geral
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação irá <strong>deletar todos os registros</strong> da tabela de classificação.
                        <br/><br/>
                        <strong>O que será deletado:</strong>
                        <ul className="list-disc ml-6 mt-2">
                          <li>Todos os pontos, gols, assistências da classificação geral</li>
                          <li>Estatísticas acumuladas de todos os jogadores</li>
                        </ul>
                        <br/>
                        <strong className="text-primary">O que NÃO será afetado:</strong>
                        <ul className="list-disc ml-6 mt-2">
                          <li>Rodadas finalizadas</li>
                          <li>Partidas e seus resultados</li>
                          <li>Gols, assistências e cartões registrados nas partidas</li>
                          <li>Cadastro de jogadores</li>
                        </ul>
                        <br/>
                        <strong>O que você deseja fazer?</strong>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={resetOnly}
                        className="bg-orange-600 hover:bg-orange-700"
                        disabled={resetting || recalculating}
                      >
                        {resetting ? "Resetando..." : "Apenas Resetar (deixar zerado)"}
                      </AlertDialogAction>
                      <AlertDialogAction
                        onClick={resetAndRecalculate}
                        className="bg-destructive hover:bg-destructive/90"
                        disabled={resetting || recalculating}
                      >
                        {recalculating ? "Recalculando..." : "Resetar e Recalcular"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Button
                  variant="outline"
                  className="w-full sm:w-auto min-h-[44px]"
                  disabled={importing}
                  onClick={() => document.getElementById("file-import")?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {importing ? "Importando..." : "Importar Excel"}
                </Button>
                <input
                  id="file-import"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileImport}
                  className="hidden"
                />

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
                      <HelpCircle className="h-5 w-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="border-border max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Como importar arquivo de classificação</DialogTitle>
                      <DialogDescription className="space-y-4 text-left">
                        <p>O arquivo deve conter as seguintes colunas:</p>
                        <ul className="list-disc ml-6 space-y-1">
                          <li><strong>Email</strong> (obrigatório): identificador único do jogador</li>
                          <li><strong>Nickname</strong>: apelido do jogador</li>
                          <li><strong>Gols</strong>: número de gols marcados</li>
                          <li><strong>Assistencias</strong>: número de assistências</li>
                          <li><strong>Vitorias</strong>, <strong>Empates</strong>, <strong>Derrotas</strong></li>
                          <li><strong>Presencas</strong>, <strong>Faltas</strong>, <strong>Atrasos</strong></li>
                          <li><strong>Punicoes</strong>: pontos de punição</li>
                          <li><strong>Cartoes_Amarelos</strong>, <strong>Cartoes_Azuis</strong></li>
                          <li><strong>Pontos_Totais</strong>: pontuação total</li>
                        </ul>
                        <p className="text-sm text-muted-foreground">
                          Apenas a coluna <strong>Email</strong> é obrigatória. As demais colunas são opcionais e valores ausentes serão preenchidos com zero.
                        </p>
                      </DialogDescription>
                    </DialogHeader>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {editedRankings.size > 0 && (
              <Alert className="mb-4 bg-yellow-500/10 border-yellow-500/50">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <AlertDescription className="text-yellow-600 font-medium">
                  ⚠️ Você tem {editedRankings.size} jogador(es) com alterações não salvas. Clique em "Salvar Alterações" para confirmar.
                </AlertDescription>
              </Alert>
            )}

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando...
              </div>
            ) : rankings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma classificação cadastrada
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-primary/20">
                      <TableHead className="text-primary">Pos.</TableHead>
                      <TableHead className="text-primary">Apelido</TableHead>
                      <TableHead className="text-primary">E-mail</TableHead>
                      <TableHead className="text-primary text-center">Gols</TableHead>
                      <TableHead className="text-primary text-center">Assist.</TableHead>
                      <TableHead className="text-primary text-center">V</TableHead>
                      <TableHead className="text-primary text-center">E</TableHead>
                      <TableHead className="text-primary text-center">D</TableHead>
                      <TableHead className="text-primary text-center">Pres.</TableHead>
                      <TableHead className="text-primary text-center">Faltas</TableHead>
                      <TableHead className="text-primary text-center">Atrasos</TableHead>
                      <TableHead className="text-primary text-center">Pun.</TableHead>
                      <TableHead className="text-primary text-center">🟨</TableHead>
                      <TableHead className="text-primary text-center">🟦</TableHead>
                      <TableHead className="text-primary text-center font-bold">Pontos</TableHead>
                      <TableHead className="text-primary text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankings.map((ranking, index) => (
                      <TableRow key={ranking.id} className="border-primary/20">
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>{ranking.nickname}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{ranking.email}</TableCell>
                        <TableCell className="text-center">
                          <RankingInput
                            min="0"
                            value={ranking.gols}
                            onValueChange={(value) => updateRankingField(ranking.id, "gols", value)}
                            className="w-20 sm:w-16"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <RankingInput
                            min="0"
                            value={ranking.assistencias}
                            onValueChange={(value) => updateRankingField(ranking.id, "assistencias", value)}
                            className="w-20 sm:w-16"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <RankingInput
                            min="0"
                            value={ranking.vitorias}
                            onValueChange={(value) => updateRankingField(ranking.id, "vitorias", value)}
                            className="w-20 sm:w-16"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <RankingInput
                            min="0"
                            value={ranking.empates}
                            onValueChange={(value) => updateRankingField(ranking.id, "empates", value)}
                            className="w-20 sm:w-16"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <RankingInput
                            min="0"
                            value={ranking.derrotas}
                            onValueChange={(value) => updateRankingField(ranking.id, "derrotas", value)}
                            className="w-20 sm:w-16"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <RankingInput
                            min="0"
                            value={ranking.presencas}
                            onValueChange={(value) => updateRankingField(ranking.id, "presencas", value)}
                            className="w-20 sm:w-16"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <RankingInput
                            min="0"
                            value={ranking.faltas}
                            onValueChange={(value) => updateRankingField(ranking.id, "faltas", value)}
                            className="w-20 sm:w-16"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <RankingInput
                            min="0"
                            value={ranking.atrasos}
                            onValueChange={(value) => updateRankingField(ranking.id, "atrasos", value)}
                            className="w-20 sm:w-16"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <RankingInput
                            value={ranking.punicoes}
                            onValueChange={(value) => updateRankingField(ranking.id, "punicoes", value)}
                            className="w-20 sm:w-16"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <RankingInput
                            min="0"
                            value={ranking.cartoes_amarelos}
                            onValueChange={(value) => updateRankingField(ranking.id, "cartoes_amarelos", value)}
                            className="w-20 sm:w-16"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <RankingInput
                            min="0"
                            value={ranking.cartoes_azuis}
                            onValueChange={(value) => updateRankingField(ranking.id, "cartoes_azuis", value)}
                            className="w-20 sm:w-16"
                          />
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          {ranking.pontos_totais}
                        </TableCell>
                        <TableCell className="text-center">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="destructive" 
                                size="sm"
                                className="min-h-[36px]"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>⚠️ Excluir Jogador da Classificação?</AlertDialogTitle>
                                <AlertDialogDescription className="space-y-3">
                                  <p>
                                    Esta ação irá remover <strong>{ranking.nickname}</strong> da classificação
                                    e excluir TODOS os dados relacionados:
                                  </p>
                                  <ul className="list-disc list-inside space-y-1 text-sm">
                                    <li>Estatísticas de todas as rodadas</li>
                                    <li>Gols, assistências e cartões</li>
                                    <li>Presenças e punições</li>
                                    <li>Participação em times</li>
                                  </ul>
                                  <p className="text-yellow-600 dark:text-yellow-400 font-semibold">
                                    ⚠️ O perfil do jogador será MANTIDO no sistema.
                                  </p>
                                  <p>Esta ação NÃO pode ser desfeita!</p>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deletePlayerCompletely(ranking.player_id, ranking.nickname)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Sim, Excluir Tudo
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Jogadores à Classificação</DialogTitle>
            <DialogDescription>
              Selecione jogadores aprovados que ainda não estão na classificação
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {availablePlayers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Todos os jogadores aprovados já estão na classificação
              </p>
            ) : (
              <div className="space-y-2">
                {availablePlayers.map(player => (
                  <div 
                    key={player.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => {
                      if (selectedPlayers.includes(player.id)) {
                        setSelectedPlayers(selectedPlayers.filter(id => id !== player.id));
                      } else {
                        setSelectedPlayers([...selectedPlayers, player.id]);
                      }
                    }}
                  >
                    <Checkbox
                      checked={selectedPlayers.includes(player.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedPlayers([...selectedPlayers, player.id]);
                        } else {
                          setSelectedPlayers(selectedPlayers.filter(id => id !== player.id));
                        }
                      }}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{player.nickname || player.name}</p>
                      <p className="text-sm text-muted-foreground">{player.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={addPlayersToRanking}
              disabled={selectedPlayers.length === 0}
            >
              Adicionar {selectedPlayers.length > 0 && `(${selectedPlayers.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageRanking;
