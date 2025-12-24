import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import { getUserFriendlyError } from "@/lib/errorHandler";
import { Search, AlertCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from "@/components/ui/alert-dialog";
import { z } from "zod";
import {
  RankingHeader,
  RankingTableHeader,
  RankingTableRow,
  RankingMobileCard,
  ImportHelpDialog,
  ImportClassificationDialog,
} from "@/components/ranking";
import { ClassificationImportResult } from "@/utils/csv";
import { Skeleton } from "@/components/ui/skeleton";

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
  source_type?: 'manual' | 'imported' | 'calculated';
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
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showResetAllDialog, setShowResetAllDialog] = useState(false);
  const [availablePlayers, setAvailablePlayers] = useState<AvailablePlayer[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  // Season support
  const [seasons, setSeasons] = useState<number[]>([new Date().getFullYear()]);
  const [selectedSeason, setSelectedSeason] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
      toast({
        title: "Acesso negado",
        description: "Acesso restrito a administradores.",
        variant: "destructive",
      });
    } else {
      loadSeasons();
      loadRankings();
    }
  }, [isAdmin, navigate]);

  // Restore pending changes after re-authentication
  useEffect(() => {
    const pendingChanges = localStorage.getItem('pending_ranking_changes');

    if (pendingChanges) {
      try {
        const parsedChanges = JSON.parse(pendingChanges);
        const restoredMap = new Map<string, Partial<PlayerRanking>>(parsedChanges);

        setEditedRankings(restoredMap);
        localStorage.removeItem('pending_ranking_changes');

        toast({
          title: "Alterações restauradas",
          description: `${restoredMap.size} jogador(es) com alterações pendentes foram restaurados.`,
        });
      } catch (e) {
        localStorage.removeItem('pending_ranking_changes');
      }
    }
  }, []);

  const loadSeasons = async () => {
    try {
      const { data, error } = await supabase
        .from("rounds")
        .select("scheduled_date")
        .not("scheduled_date", "is", null);

      if (error) throw error;

      const years = [...new Set(
        data?.map(r => new Date(r.scheduled_date!).getFullYear()) || []
      )].sort((a, b) => b - a);

      if (years.length > 0) {
        setSeasons(years);
        setSelectedSeason(years[0]);
      }
    } catch (error) {
      console.error("Erro ao carregar temporadas:", error);
    }
  };

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

  const copyRankingRow = (ranking: PlayerRanking) => {
    const text = `${ranking.nickname}\t${ranking.gols}\t${ranking.assistencias}\t${ranking.vitorias}\t${ranking.empates}\t${ranking.derrotas}\t${ranking.presencas}\t${ranking.pontos_totais}`;
    navigator.clipboard.writeText(text);
    toast({
      title: "Linha copiada",
      description: `Dados de ${ranking.nickname} copiados para a área de transferência.`,
    });
  };

  const resetRankingRow = (ranking: PlayerRanking) => {
    const resetFields: (keyof PlayerRanking)[] = [
      'gols', 'assistencias', 'vitorias', 'empates', 'derrotas',
      'presencas', 'faltas', 'atrasos', 'punicoes', 'cartoes_amarelos', 'cartoes_azuis'
    ];

    resetFields.forEach(field => {
      updateRankingField(ranking.id, field, 0);
    });

    toast({
      title: "Linha zerada",
      description: `Estatísticas de ${ranking.nickname} foram zeradas. Salve para confirmar.`,
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

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      toast({
        title: "Sessão expirada",
        description: "Sua sessão expirou. Faça login novamente.",
        variant: "destructive",
      });
      localStorage.setItem('pending_ranking_changes', JSON.stringify(Array.from(editedRankings.entries())));
      navigate('/auth');
      return;
    }

    const tokenExpiry = session.expires_at;
    const now = Math.floor(Date.now() / 1000);

    if (tokenExpiry && tokenExpiry < now) {
      const { error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        toast({
          title: "Token expirado",
          description: "Não foi possível renovar sua sessão. Faça login novamente.",
          variant: "destructive",
        });
        localStorage.setItem('pending_ranking_changes', JSON.stringify(Array.from(editedRankings.entries())));
        navigate('/auth');
        return;
      }
    }

    setSaving(true);

    try {
      toast({
        title: "⏳ Aplicando ajustes...",
        description: `Processando ${editedRankings.size} jogador(es)`,
      });

      let successCount = 0;
      let fallbackCount = 0;

      for (const [rankingId, fields] of Array.from(editedRankings.entries())) {
        const ranking = rankings.find(r => r.id === rankingId);
        if (!ranking) {
          console.warn(`Ranking não encontrado para ID: ${rankingId}`);
          continue;
        }

        // Verifica se o jogador tem player_id válido para usar RPC
        const hasValidPlayerId = ranking.player_id && ranking.player_id.length > 0;

        if (hasValidPlayerId) {
          // Tenta usar o RPC para jogadores com player_id válido
          let rpcSuccess = true;

          for (const [field, value] of Object.entries(fields)) {
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
            if (!adjustmentType) continue;

            const { data, error } = await supabase.rpc('apply_ranking_adjustment', {
              p_player_id: ranking.player_id,
              p_adjustment_type: adjustmentType,
              p_new_total: value as number,
              p_reason: `Ajuste manual via interface administrativa`,
            });

            if (error) {
              console.error(`RPC falhou para ${ranking.nickname} (${field}):`, error);
              rpcSuccess = false;
              break;
            }

            const result = data as any;
            if (result?.success === false) {
              console.error(`RPC retornou erro para ${ranking.nickname}:`, result);
              rpcSuccess = false;
              break;
            }
          }

          if (rpcSuccess) {
            successCount++;
            continue;
          }

          // Fallback para update direto se RPC falhou
          console.log(`Usando fallback para ${ranking.nickname} (RPC falhou)`);
        }

        // Fallback: Update direto na tabela usando o ID da linha (não player_id)
        // Isso funciona para jogadores importados sem conta (Ghost Profiles)
        const updatePayload: Record<string, number> = {};
        
        for (const [field, value] of Object.entries(fields)) {
          if (['gols', 'assistencias', 'vitorias', 'empates', 'derrotas', 
               'presencas', 'faltas', 'atrasos', 'punicoes', 
               'cartoes_amarelos', 'cartoes_azuis', 'pontos_totais'].includes(field)) {
            updatePayload[field] = value as number;
          }
        }

        if (Object.keys(updatePayload).length > 0) {
          const { error: updateError } = await supabase
            .from('player_rankings')
            .update(updatePayload)
            .eq('id', rankingId); // <-- Usa ID da linha, não player_id

          if (updateError) {
            console.error(`Update direto falhou para ${ranking.nickname}:`, updateError);
            throw new Error(`Erro ao salvar ${ranking.nickname}: ${updateError.message}`);
          }

          fallbackCount++;
          console.log(`✅ Update direto bem-sucedido para ${ranking.nickname}`);
        }
      }

      // NÃO chama recalc_all_player_rankings aqui!
      // Isso sobrescreveria dados importados/manuais com zeros
      // O update direto já salvou os valores corretos

      await new Promise(resolve => setTimeout(resolve, 300));

      const lastData = await fetchRankingsRaw();
      setRankings(lastData);

      const totalProcessed = successCount + fallbackCount;
      toast({
        title: "✅ Alterações salvas!",
        description: `${totalProcessed} jogador(es) atualizado(s)${fallbackCount > 0 ? ` (${fallbackCount} via update direto)` : ''}.`,
      });

      setEditedRankings(new Map());
    } catch (error: any) {
      console.error('Erro ao salvar alterações:', error);
      toast({
        title: "❌ Erro ao salvar",
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
        title: "Classificação resetada",
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
      setShowResetDialog(false);
    }
  };

  const resetAndRecalculate = async () => {
    setResetting(true);

    try {
      const { data: resetData, error: resetError } = await supabase.rpc('reset_full_classification');
      if (resetError) throw resetError;

      const resetResult = resetData as { success: boolean; error?: string };
      if (!resetResult.success) throw new Error(resetResult.error);

      const { data: rounds } = await supabase
        .from('rounds')
        .select('id')
        .eq('status', 'finalizada');

      for (const round of rounds || []) {
        await supabase.rpc('recalc_round_aggregates', { p_round_id: round.id });
      }

      const { error: recalcError } = await supabase.rpc('recalc_all_player_rankings');
      if (recalcError) throw recalcError;

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
      setShowResetDialog(false);
    }
  };

  const handleImportClassification = async (data: any[]): Promise<ClassificationImportResult | null> => {
    setImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Faça login novamente",
          variant: "destructive",
        });
        return null;
      }

      // --- NEW BINDING LOGIC START ---
      // Fetch all profiles to perform binding logic in frontend
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nickname, name, claim_token');

      if (profilesError) throw profilesError;

      // Create Lookup Maps
      const tokenMap = new Map<string, typeof profiles[0]>();
      const nicknameMap = new Map<string, typeof profiles[0]>();

      profiles?.forEach(p => {
        if (p.claim_token) tokenMap.set(p.claim_token.trim(), p);
        if (p.nickname) nicknameMap.set(p.nickname.toLowerCase().trim(), p);
      });

      // Process and Bind Data
      const processedData = data.map(row => {
        // Find existing keys
        const tokenKey = Object.keys(row).find(k => ['token', 'claimtoken', 'claim_token'].includes(k.toLowerCase())) || 'Token';
        const nicknameKey = Object.keys(row).find(k => ['nickname', 'name', 'nome', 'jogador'].includes(k.toLowerCase())) || 'Nickname';

        const rawToken = row[tokenKey]?.toString().trim();
        const rawNickname = row[nicknameKey]?.toString().toLowerCase().trim();

        let resolvedProfile = null;

        // Priority 1: Check Token
        if (rawToken && tokenMap.has(rawToken)) {
          resolvedProfile = tokenMap.get(rawToken);
        }

        // Priority 2: Check Nickname (if no valid token found yet)
        if (!resolvedProfile && rawNickname) {
          // Try exact match first
          if (nicknameMap.has(rawNickname)) {
            resolvedProfile = nicknameMap.get(rawNickname);
          }
          // If needed, we could add fuzzy search here, but prompt requested Case Insensitive + Trim only.
        }

        // If we resolved a profile, FORCE the token in the row data
        // This ensures the RPC finds the correct player by Token (Priority 1)
        if (resolvedProfile && resolvedProfile.claim_token) {
          return {
            ...row,
            [tokenKey]: resolvedProfile.claim_token, // Inject valid token
            // Ensure we use the exact keys expected by RPC if they differ? 
            // We update the existing key to be safe.
          };
        }

        return row;
      });
      // --- NEW BINDING LOGIC END ---

      const { data: result, error } = await supabase.rpc('import_classification_csv', {
        p_rows: processedData,
        p_actor_id: user.id
      });

      if (error) throw error;

      const importResult = result as unknown as ClassificationImportResult;

      if (importResult.success) {
        await loadRankings();

        toast({
          title: "Importação concluída",
          description: `${importResult.created} criados, ${importResult.updated} atualizados, ${importResult.profiles_created} perfis criados`,
        });
      }

      return importResult;
    } catch (error: any) {
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
      return null;
    } finally {
      setImporting(false);
    }
  };

  // Filter rankings by search
  const filteredRankings = rankings.filter(r =>
    r.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.email?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card className="bg-card/50 border-primary/20">
            <CardHeader>
              <h2 className="text-primary text-xl font-bold">Acesso Restrito</h2>
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
      <div className="container mx-auto px-4 py-6">
        <Card className="bg-card/50 border-primary/20 shadow-lg">
          <CardHeader className="pb-4">
            <RankingHeader
              seasons={seasons}
              selectedSeason={selectedSeason}
              onSeasonChange={setSelectedSeason}
              editedCount={editedRankings.size}
              saving={saving}
              recalculating={recalculating}
              importing={importing}
              onAddPlayers={() => {
                loadAvailablePlayers();
                setShowAddDialog(true);
              }}
              onSave={saveChanges}
              onRecalculate={recalculateRankings}
              onImportClick={() => setShowImportDialog(true)}
              onHelpClick={() => setShowHelpDialog(true)}
              onResetClick={() => setShowResetAllDialog(true)}
            />
          </CardHeader>

          <CardContent className="pt-0">
            {/* Pending Changes Alert */}
            {editedRankings.size > 0 && (
              <Alert className="mb-4 bg-yellow-500/10 border-yellow-500/50">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <AlertDescription className="text-yellow-600 font-medium">
                  ⚠️ {editedRankings.size} jogador(es) com alterações não salvas
                </AlertDescription>
              </Alert>
            )}

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar jogador..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10"
              />
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredRankings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery ? "Nenhum jogador encontrado" : "Nenhuma classificação cadastrada"}
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <RankingTableHeader />
                    <TableBody>
                      {filteredRankings.map((ranking, index) => (
                        <RankingTableRow
                          key={ranking.id}
                          ranking={ranking}
                          position={index + 1}
                          isEdited={editedRankings.has(ranking.id)}
                          onFieldChange={updateRankingField}
                          onDelete={deletePlayerCompletely}
                          onCopy={copyRankingRow}
                          onReset={resetRankingRow}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="lg:hidden space-y-3">
                  {filteredRankings.map((ranking, index) => (
                    <RankingMobileCard
                      key={ranking.id}
                      ranking={ranking}
                      position={index + 1}
                      isEdited={editedRankings.has(ranking.id)}
                      onFieldChange={updateRankingField}
                      onDelete={deletePlayerCompletely}
                    />
                  ))}
                </div>

                {/* Count */}
                <div className="text-center py-3 text-sm text-muted-foreground">
                  {filteredRankings.length} jogador(es)
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showResetAllDialog} onOpenChange={setShowResetAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar TODA Classificação?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso apagará TODOS os dados das tabelas de ranking e estatísticas de rodada.
              Esta ação é ideal para reiniciar a temporada ou importar novos dados do zero.
              <br /><br />
              <strong className="text-destructive">Esta ação é irreversível.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={resetOnly}
              className="bg-destructive hover:bg-destructive/90"
            >
              Apagar Tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Players Dialog */}
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

      {/* Reset Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent className="border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              ⚠️ Resetar Classificação Geral
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Esta ação irá <strong>deletar todos os registros</strong> da tabela de classificação.</p>

              <div className="bg-destructive/10 p-3 rounded-lg">
                <p className="font-medium text-destructive mb-1">O que será deletado:</p>
                <ul className="list-disc ml-4 text-sm">
                  <li>Pontos, gols, assistências</li>
                  <li>Estatísticas acumuladas</li>
                </ul>
              </div>

              <div className="bg-primary/10 p-3 rounded-lg">
                <p className="font-medium text-primary mb-1">O que NÃO será afetado:</p>
                <ul className="list-disc ml-4 text-sm">
                  <li>Rodadas finalizadas</li>
                  <li>Partidas e resultados</li>
                  <li>Cadastro de jogadores</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={resetOnly}
              className="bg-orange-600 hover:bg-orange-700"
              disabled={resetting || recalculating}
            >
              {resetting ? "Resetando..." : "Apenas Resetar"}
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

      {/* Import Help Dialog */}
      <ImportHelpDialog open={showHelpDialog} onOpenChange={setShowHelpDialog} />

      {/* Import Classification Dialog */}
      <ImportClassificationDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImportClassification}
      />
    </div>
  );
};

export default ManageRanking;
