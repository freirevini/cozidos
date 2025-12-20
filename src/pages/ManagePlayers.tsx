import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { toast as sonnerToast } from "sonner";
import { getUserFriendlyError } from "@/lib/errorHandler";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { RefreshCw, AlertTriangle, Link2, Copy, Download } from "lucide-react";
import { AlertDialogIcon } from "@/components/ui/alert-dialog-icon";
import { LinkPendingPlayerModal } from "@/components/LinkPendingPlayerModal";
import { AvatarUpload } from "@/components/AvatarUpload";
import { ImportPlayersDialog } from "@/components/players/ImportPlayersDialog";
import { downloadCSV, generateCSV, type ImportResult } from "@/utils/csv";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import {
  PlayerCompactCard,
  PlayerEditDialog,
  PlayerFilters,
  PlayerQuickActions,
  type Player,
} from "@/components/players";

const PLAYERS_PER_PAGE = 20;

export default function ManagePlayers() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  // Data states
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [displayedPlayers, setDisplayedPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [importing, setImporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPosition, setFilterPosition] = useState("all");

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedPendingPlayer, setSelectedPendingPlayer] = useState<Player | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [avatarEditPlayer, setAvatarEditPlayer] = useState<Player | null>(null);
  const [exporting, setExporting] = useState(false);

  // Form state for new player
  const [formData, setFormData] = useState({
    nickname: "",
    level: "",
    position: "",
    player_type_detail: "mensal" as "mensal" | "avulso" | "avulso_fixo",
  });

  // Ref for infinite scroll
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
      return;
    }
    loadPlayers();
  }, [isAdmin]);

  // Fuzzy search with multiple fields
  const fuzzyMatch = useCallback((player: Player, term: string): boolean => {
    const searchLower = term.toLowerCase();
    const fields = [
      player.name,
      player.nickname,
      player.first_name,
      player.last_name,
      player.email,
      player.position,
      player.level,
    ].filter(Boolean).map(f => f?.toLowerCase() || "");

    return fields.some(field => field.includes(searchLower));
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...allPlayers];

    // Fuzzy search
    if (searchTerm) {
      filtered = filtered.filter(p => fuzzyMatch(p, searchTerm));
    }

    // Status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter(p => p.status === filterStatus);
    }

    // Position filter
    if (filterPosition !== "all") {
      filtered = filtered.filter(p => p.position === filterPosition);
    }

    setFilteredPlayers(filtered);
    setDisplayedPlayers(filtered.slice(0, PLAYERS_PER_PAGE));
    setHasMore(filtered.length > PLAYERS_PER_PAGE);
  }, [allPlayers, searchTerm, filterStatus, filterPosition, fuzzyMatch]);

  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMorePlayers();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, filteredPlayers.length, displayedPlayers.length]);

  const loadPlayers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, first_name, last_name, nickname, email, birth_date, is_player, level, position, status, user_id, avatar_url, claim_token, created_by_admin_simple, player_type_detail")
        .eq("is_player", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAllPlayers(data || []);
    } catch (error: any) {
      sonnerToast.error("Erro ao carregar jogadores: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMorePlayers = () => {
    if (loadingMore || displayedPlayers.length >= filteredPlayers.length) return;

    setLoadingMore(true);
    setTimeout(() => {
      const nextBatch = filteredPlayers.slice(
        displayedPlayers.length,
        displayedPlayers.length + PLAYERS_PER_PAGE
      );
      setDisplayedPlayers(prev => [...prev, ...nextBatch]);
      setHasMore(displayedPlayers.length + nextBatch.length < filteredPlayers.length);
      setLoadingMore(false);
    }, 100);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPlayers();
    setRefreshing(false);
    sonnerToast.success("Lista atualizada!");
  };

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: handleRefresh,
    enabled: true,
  });

  // Player actions
  const handleEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setEditDialogOpen(true);
  };

  const handleSavePlayer = async (updatedPlayer: Player) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          nickname: updatedPlayer.nickname,
          email: updatedPlayer.email,
          birth_date: updatedPlayer.birth_date,
          level: updatedPlayer.level as any,
          position: updatedPlayer.position as any,
          status: updatedPlayer.status as any,
        })
        .eq("id", updatedPlayer.id);

      if (error) throw error;

      setAllPlayers(prev => prev.map(p => p.id === updatedPlayer.id ? updatedPlayer : p));
      sonnerToast.success("Jogador atualizado!");
    } catch (error: any) {
      sonnerToast.error(getUserFriendlyError(error));
      throw error;
    }
  };

  const handleDeletePlayer = async (player: Player) => {
    const confirmDialog = document.createElement('div');
    document.body.appendChild(confirmDialog);
    const root = document.createElement('div');
    confirmDialog.appendChild(root);

    const cleanup = () => document.body.removeChild(confirmDialog);

    const { createRoot } = await import('react-dom/client');
    const reactRoot = createRoot(root);

    reactRoot.render(
      <AlertDialogIcon
        icon={AlertTriangle}
        title="Excluir Jogador"
        description={`Tem certeza que deseja excluir ${player.nickname || player.name}? TODOS os dados associados serão removidos permanentemente.`}
        actionText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
        open={true}
        onOpenChange={(open) => { if (!open) { reactRoot.unmount(); cleanup(); } }}
        onAction={async () => {
          try {
            // Se o perfil tem um usuário associado, exclui da Auth primeiro (para evitar zumbis)
            if (player.user_id) {
              const { error: authError } = await supabase.functions.invoke('delete-auth-user', {
                body: { user_id: player.user_id }
              });

              if (authError) {
                console.error("Erro ao excluir usuário de autenticação:", authError);
                // Não interrompe, pois queremos limpar do banco de qualquer jeito
                sonnerToast.warning("Aviso: Não foi possível desvincular o login, mas o perfil será excluído.");
              }
            }

            // Exclui do banco
            const { error } = await supabase.rpc("delete_player_complete", { p_profile_id: player.id });
            if (error) throw error;

            await supabase.rpc('recalc_all_player_rankings');

            // Atualiza estado local imediatamente
            setAllPlayers(prev => prev.filter(p => p.id !== player.id));
            setFilteredPlayers(prev => prev.filter(p => p.id !== player.id));
            setDisplayedPlayers(prev => prev.filter(p => p.id !== player.id));

            sonnerToast.success("Jogador excluído!");
            setEditDialogOpen(false);
          } catch (error: any) {
            sonnerToast.error(getUserFriendlyError(error));
          }
          reactRoot.unmount();
          cleanup();
        }}
        onCancel={() => { reactRoot.unmount(); cleanup(); }}
      />
    );
  };

  const handleResetAllPlayers = async () => {
    const confirmDialog = document.createElement('div');
    document.body.appendChild(confirmDialog);
    const root = document.createElement('div');
    confirmDialog.appendChild(root);

    const cleanup = () => document.body.removeChild(confirmDialog);

    const { createRoot } = await import('react-dom/client');
    const reactRoot = createRoot(root);

    reactRoot.render(
      <AlertDialogIcon
        icon={AlertTriangle}
        title="⚠️ EXCLUIR TODOS OS JOGADORES"
        description="Esta ação EXCLUIRÁ TODOS os perfis do sistema (exceto seu usuário admin atual). Isso é irreversível e usado apenas para testes."
        actionText="CONFIRMAR EXCLUSÃO TOTAL"
        cancelText="Cancelar"
        variant="destructive"
        open={true}
        onOpenChange={(open) => { if (!open) { reactRoot.unmount(); cleanup(); } }}
        onAction={async () => {
          try {
            const { data: user } = await supabase.auth.getUser();
            if (!user.data.user) throw new Error("Usuário não autenticado");

            const { data, error } = await supabase.rpc('reset_all_players', { p_keep_admin_id: null }); // p_user_id check is inside the rpc logic via auth.uid() usually, but our rpc takes p_keep_admin_id to skip. Actually the RPC logic handles auth.uid() skipping. passing null is fine if logic handles it, or pass user.id.

            /* 
              Re-reading the RPC I created: 
              CREATE OR REPLACE FUNCTION public.reset_all_players(p_keep_admin_id uuid)
              ...
              AND is_player = true 
              AND (user_id IS NULL OR user_id != auth.uid());
              
              So it already protects the caller. p_keep_admin_id is basically optional or extra safety?
              The RPC definition I wrote takes `p_keep_admin_id`. I'll pass userId just in case.
            */

            const { error: rpcError } = await supabase.rpc('reset_all_players', { p_keep_admin_id: user.data.user.id });

            if (rpcError) throw rpcError;

            sonnerToast.success("Reset completo executado com sucesso.");
            loadPlayers();
          } catch (error: any) {
            sonnerToast.error(getUserFriendlyError(error));
          }
          reactRoot.unmount();
          cleanup();
        }}
        onCancel={() => { reactRoot.unmount(); cleanup(); }}
      />
    );
  };

  const handleApprovePlayer = async (player: Player) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "aprovado" })
        .eq("id", player.id);
      if (error) throw error;
      setAllPlayers(prev => prev.map(p => p.id === player.id ? { ...p, status: "aprovado" } : p));
      sonnerToast.success(`${player.nickname || player.name} aprovado!`);
    } catch (error: any) {
      sonnerToast.error(getUserFriendlyError(error));
    }
  };

  const handleRejectPlayer = async (player: Player) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "rejeitado" })
        .eq("id", player.id);
      if (error) throw error;
      setAllPlayers(prev => prev.map(p => p.id === player.id ? { ...p, status: "rejeitado" } : p));
      sonnerToast.success(`${player.nickname || player.name} rejeitado`);
    } catch (error: any) {
      sonnerToast.error(getUserFriendlyError(error));
    }
  };

  const handleLinkPlayer = (player: Player) => {
    setSelectedPendingPlayer(player);
    setLinkModalOpen(true);
  };

  const handleEditAvatar = (player: Player) => {
    setAvatarEditPlayer(player);
    setAvatarDialogOpen(true);
  };

  const handleCopyToken = async (token: string) => {
    await navigator.clipboard.writeText(token);
    sonnerToast.success("Token copiado!");
  };

  const handleCopyInviteLink = async (token: string) => {
    const link = `${window.location.origin}/auth?token=${token}`;
    await navigator.clipboard.writeText(link);
    sonnerToast.success("Link copiado!");
  };

  const handleGenerateToken = async (playerId: string) => {
    try {
      const { data: token, error } = await supabase.rpc('generate_claim_token', { p_profile_id: playerId });
      if (error) throw error;
      setAllPlayers(prev => prev.map(p => p.id === playerId ? { ...p, claim_token: token } : p));
      await navigator.clipboard.writeText(token);
      sonnerToast.success(`Token gerado e copiado!`);
    } catch (error: any) {
      sonnerToast.error(getUserFriendlyError(error));
    }
  };

  const handleCreatePlayer = async () => {
    if (!formData.nickname || !formData.level || !formData.position) {
      sonnerToast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      const { data: newProfile, error } = await supabase
        .from("profiles")
        .insert([{
          nickname: formData.nickname.trim(),
          name: formData.nickname.trim(),
          level: formData.level as any,
          position: formData.position as any,
          player_type_detail: formData.player_type_detail as any,
          is_player: true,
          status: "aprovado" as any,
          user_id: null,
          created_by_admin_simple: true,
        }])
        .select("id")
        .single();

      if (error) throw error;

      const { data: token } = await supabase.rpc('generate_claim_token', { p_profile_id: newProfile.id });
      if (token) setGeneratedToken(token);

      sonnerToast.success("Jogador cadastrado!");
      setAddDialogOpen(false);
      setFormData({ nickname: "", level: "", position: "", player_type_detail: "mensal" });
      loadPlayers();
    } catch (error: any) {
      sonnerToast.error(getUserFriendlyError(error));
    }
  };

  // New import using RPC
  const handleImportPlayers = async (data: any[]): Promise<ImportResult | null> => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user?.id) {
        sonnerToast.error("Sessão expirada. Faça login novamente.");
        return null;
      }

      const { data: result, error } = await supabase.rpc('import_players_csv', {
        p_rows: data,
        p_actor_id: session.session.user.id
      });

      if (error) throw error;

      const importResult = result as unknown as ImportResult;

      if (importResult.success) {
        await loadPlayers();
        sonnerToast.success(`Importação concluída: ${importResult.created} criados, ${importResult.updated} atualizados`);
      }

      return importResult;
    } catch (error: any) {
      sonnerToast.error(getUserFriendlyError(error));
      return null;
    }
  };

  // Export players to CSV
  const handleExportPlayers = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("nickname, first_name, last_name, email, level, position, claim_token, status, created_at")
        .eq("is_player", true)
        .order("nickname");

      if (error) throw error;

      const headers = ['Nickname', 'FirstName', 'LastName', 'Email', 'Level', 'Position', 'ClaimToken', 'Status', 'CreatedAt'];
      const rows = (data || []).map(p => [
        p.nickname || '',
        p.first_name || '',
        p.last_name || '',
        p.email || '',
        p.level || '',
        p.position || '',
        p.claim_token || '',
        p.status || '',
        p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : ''
      ]);

      const csv = generateCSV(headers, rows);
      downloadCSV(csv, `jogadores_${new Date().toISOString().split('T')[0]}.csv`);
      sonnerToast.success("Exportação concluída!");
    } catch (error: any) {
      sonnerToast.error(getUserFriendlyError(error));
    } finally {
      setExporting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <p className="text-center text-muted-foreground">Acesso restrito.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Pull to Refresh */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="fixed top-0 left-0 right-0 flex justify-center items-center z-50 transition-all"
          style={{ transform: `translateY(${Math.min(pullDistance, 60)}px)`, opacity: Math.min(pullDistance / 60, 1) }}
        >
          <div className="bg-primary/90 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm">{isRefreshing ? 'Atualizando...' : 'Solte para atualizar'}</span>
          </div>
        </div>
      )}

      <Header />

      <main className="container mx-auto px-4 py-4 pb-20 max-w-2xl">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-primary mb-3">Jogadores</h1>
          <PlayerQuickActions
            onAddPlayer={() => setAddDialogOpen(true)}
            onImportExcel={() => setShowImportDialog(true)}
            onRefresh={handleRefresh}
            onShowHelp={() => setShowImportDialog(true)}
            importing={importing}
            refreshing={refreshing}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPlayers}
            disabled={exporting}
            className="w-full sm:w-auto mt-2"
          >
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exportando...' : 'Exportar CSV'}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleResetAllPlayers}
            className="w-full sm:w-auto mt-2 sm:ml-2"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Excluir Todos (Reset)
          </Button>
        </div>

        {/* Filters */}
        <div className="mb-4">
          <PlayerFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            filterStatus={filterStatus}
            onStatusChange={setFilterStatus}
            filterPosition={filterPosition}
            onPositionChange={setFilterPosition}
            totalCount={allPlayers.length}
            filteredCount={filteredPlayers.length}
          />
        </div>

        {/* Player List */}
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-card/50 border border-border/50">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-9 w-9" />
              </div>
            ))
          ) : displayedPlayers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Nenhum jogador encontrado</p>
            </div>
          ) : (
            <>
              {displayedPlayers.map((player) => (
                <PlayerCompactCard
                  key={player.id}
                  player={player}
                  onEdit={handleEditPlayer}
                  onDelete={handleDeletePlayer}
                  onApprove={handleApprovePlayer}
                  onReject={handleRejectPlayer}
                  onLinkPlayer={handleLinkPlayer}
                  onEditAvatar={handleEditAvatar}
                  onCopyToken={handleCopyToken}
                  onCopyInviteLink={handleCopyInviteLink}
                  onGenerateToken={handleGenerateToken}
                />
              ))}

              {/* Load more trigger */}
              <div ref={loadMoreRef} className="py-4">
                {loadingMore && (
                  <div className="flex justify-center">
                    <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Edit Dialog */}
      <PlayerEditDialog
        player={editingPlayer}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleSavePlayer}
        onDelete={handleDeletePlayer}
        onAvatarEdit={handleEditAvatar}
      />

      {/* Add Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo Jogador</DialogTitle>
            <DialogDescription>Cadastro rápido - aprovado automaticamente</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Apelido *</Label>
              <Input value={formData.nickname} onChange={(e) => setFormData({ ...formData, nickname: e.target.value })} placeholder="Ex: Joãozinho" className="h-11" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Posição *</Label>
                <Select value={formData.position} onValueChange={(v) => setFormData({ ...formData, position: v })}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="goleiro">Goleiro</SelectItem>
                    <SelectItem value="defensor">Defensor</SelectItem>
                    <SelectItem value="meio-campista">Meio-Campista</SelectItem>
                    <SelectItem value="atacante">Atacante</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nível *</Label>
                <Select value={formData.level} onValueChange={(v) => setFormData({ ...formData, level: v })}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                    <SelectItem value="C">C</SelectItem>
                    <SelectItem value="D">D</SelectItem>
                    <SelectItem value="E">E</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formData.player_type_detail} onValueChange={(v) => setFormData({ ...formData, player_type_detail: v as any })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensalista</SelectItem>
                  <SelectItem value="avulso">Avulso</SelectItem>
                  <SelectItem value="avulso_fixo">Avulso Fixo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="flex-1 h-11">Cancelar</Button>
            <Button onClick={handleCreatePlayer} className="flex-1 h-11">Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Token Generated Dialog */}
      <Dialog open={!!generatedToken} onOpenChange={() => setGeneratedToken(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Link2 className="h-5 w-5 text-primary" />Token Gerado</DialogTitle>
            <DialogDescription>Envie para o jogador vincular sua conta</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex gap-2">
              <Input value={generatedToken || ""} readOnly className="font-mono" />
              <Button size="icon" onClick={() => generatedToken && handleCopyToken(generatedToken)}><Copy className="h-4 w-4" /></Button>
            </div>
            <Button variant="outline" className="w-full" onClick={() => generatedToken && handleCopyInviteLink(generatedToken)}>
              <Link2 className="h-4 w-4 mr-2" />Copiar Link
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setGeneratedToken(null)} className="w-full">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Modal */}
      <LinkPendingPlayerModal open={linkModalOpen} onOpenChange={setLinkModalOpen} pendingProfile={selectedPendingPlayer} onLinked={() => loadPlayers()} />

      {/* Avatar Dialog */}
      <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Alterar Foto</DialogTitle></DialogHeader>
          {avatarEditPlayer && (
            <AvatarUpload
              playerId={avatarEditPlayer.id}
              playerName={avatarEditPlayer.nickname || avatarEditPlayer.name}
              currentAvatarUrl={avatarEditPlayer.avatar_url}
              onUploadComplete={(url) => {
                setAllPlayers(prev => prev.map(p => p.id === avatarEditPlayer.id ? { ...p, avatar_url: url } : p));
                setAvatarDialogOpen(false);
                sonnerToast.success("Foto atualizada!");
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Import Players Dialog */}
      <ImportPlayersDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImportPlayers}
      />
    </div>
  );
}
