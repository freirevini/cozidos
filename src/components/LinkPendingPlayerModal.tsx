import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Link2, User } from "lucide-react";

interface Profile {
  id: string;
  name: string;
  nickname: string | null;
  email: string | null;
  birth_date: string | null;
}

interface MatchingProfile {
  profile_id: string;
  name: string;
  email: string | null;
  birth_date: string | null;
  player_id: string | null;
  user_id: string | null;
  match_score: number;
  match_reason: string;
}

interface LinkPendingPlayerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingProfile: Profile | null;
  onLinked: () => void;
}

export function LinkPendingPlayerModal({
  open,
  onOpenChange,
  pendingProfile,
  onLinked,
}: LinkPendingPlayerModalProps) {
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<MatchingProfile[]>([]);
  const [adminCreatedProfiles, setAdminCreatedProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    if (open && pendingProfile) {
      searchCandidates();
      loadAdminCreatedProfiles();
    }
  }, [open, pendingProfile]);

  const searchCandidates = async () => {
    if (!pendingProfile) return;

    setSearching(true);
    try {
      const { data, error } = await supabase.rpc("find_matching_profiles", {
        p_email: pendingProfile.email || "",
        p_birth_date: pendingProfile.birth_date || null,
        p_first_name: pendingProfile.name?.split(" ")[0] || null,
        p_last_name: pendingProfile.name?.split(" ").slice(1).join(" ") || null,
      });

      if (error) throw error;
      // Filter out profiles that already have user_id
      const filteredData = (data || []).filter((p: MatchingProfile) => !p.user_id);
      setCandidates(filteredData);
    } catch (error: any) {
      console.error("Erro ao buscar candidatos:", error);
    } finally {
      setSearching(false);
    }
  };

  const loadAdminCreatedProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, nickname, email, birth_date")
        .eq("is_player", true)
        .eq("created_by_admin_simple", true)
        .is("user_id", null)
        .order("name");

      if (error) throw error;
      setAdminCreatedProfiles(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar perfis admin:", error);
    }
  };

  const handleLink = async (targetProfileId: string) => {
    if (!pendingProfile) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase.rpc("admin_link_pending_to_profile", {
        p_pending_profile_id: pendingProfile.id,
        p_target_profile_id: targetProfileId,
        p_admin_user_id: user.id,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };

      if (!result.success) {
        throw new Error(result.error || "Erro ao vincular perfis");
      }

      toast.success(result.message || "Perfis vinculados com sucesso!");
      onOpenChange(false);
      onLinked();
    } catch (error: any) {
      toast.error("Erro ao vincular: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "bg-green-600";
    if (score >= 70) return "bg-yellow-600";
    return "bg-gray-600";
  };

  const allCandidates = [
    ...candidates,
    ...adminCreatedProfiles
      .filter((p) => !candidates.some((c) => c.profile_id === p.id))
      .map((p) => ({
        profile_id: p.id,
        name: p.name,
        email: p.email,
        birth_date: p.birth_date,
        player_id: null,
        user_id: null,
        match_score: 0,
        match_reason: "admin_created",
      })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Vincular a Jogador Existente
          </DialogTitle>
          <DialogDescription>
            Selecione o jogador pré-cadastrado para vincular ao perfil de{" "}
            <strong>{pendingProfile?.nickname || pendingProfile?.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info do perfil pendente */}
          <div className="bg-muted/20 p-3 rounded-lg">
            <p className="text-sm font-medium">Perfil Pendente:</p>
            <p className="text-sm text-muted-foreground">
              {pendingProfile?.name} • {pendingProfile?.email}
            </p>
          </div>

          {/* Lista de candidatos */}
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Jogadores disponíveis para vinculação:
            </p>

            {searching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : allCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum jogador pré-cadastrado disponível para vinculação.
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {allCandidates.map((candidate) => (
                  <div
                    key={candidate.profile_id}
                    className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <User className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{candidate.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {candidate.email || "Sem e-mail"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {candidate.match_score > 0 && (
                        <Badge className={getScoreColor(candidate.match_score)}>
                          {candidate.match_score}%
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleLink(candidate.profile_id)}
                        disabled={loading}
                      >
                        {loading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Vincular"
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
