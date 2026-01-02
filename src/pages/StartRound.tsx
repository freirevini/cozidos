import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  PlayCircle,
  Edit3,
  Trash2,
  CheckCircle,
  Clock,
  Calendar,
  ChevronRight,
  Plus,
  Settings2
} from "lucide-react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh-indicator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Round {
  id: string;
  round_number: number;
  scheduled_date: string;
  status: string;
}

export default function StartRound() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; number: number } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      toast.error("Acesso não autorizado");
      navigate("/");
    } else {
      loadAvailableRounds();
    }
  }, [isAdmin, navigate]);

  const loadAvailableRounds = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("rounds")
        .select("*")
        .or("is_historical.is.null,is_historical.eq.false")
        .neq("round_number", 0)
        .order("round_number", { ascending: false });

      if (error) throw error;
      setRounds(data || []);
    } catch (error) {
      console.error("Erro ao carregar rodadas:", error);
      toast.error("Erro ao carregar rodadas disponíveis");
    } finally {
      setLoading(false);
    }
  };

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await loadAvailableRounds();
      toast.success("Rodadas atualizadas!");
    },
    enabled: true,
  });

  const startRound = async (roundId: string) => {
    setActionLoading(roundId);
    try {
      const { error } = await supabase
        .from("rounds")
        .update({ status: 'em_andamento' })
        .eq("id", roundId);

      if (error) throw error;

      toast.success("Rodada iniciada com sucesso!");
      navigate(`/admin/round/manage?round=${roundId}`);
    } catch (error: any) {
      console.error("Erro ao iniciar rodada:", error);
      toast.error("Erro ao iniciar rodada: " + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const manageRound = (roundId: string) => {
    navigate(`/admin/round/manage?round=${roundId}`);
  };

  const formatDate = (date: string) => {
    const d = new Date(date + "T00:00:00");
    return {
      day: d.getDate(),
      month: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      full: d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
    };
  };

  const deleteRound = async () => {
    if (!deleteConfirm) return;

    setActionLoading(deleteConfirm.id);
    try {
      const { error } = await supabase
        .from("rounds")
        .delete()
        .eq("id", deleteConfirm.id);

      if (error) throw error;

      toast.success("Rodada excluída com sucesso!");
      loadAvailableRounds();
    } catch (error: any) {
      console.error("Erro ao excluir rodada:", error);
      toast.error("Erro ao excluir rodada: " + error.message);
    } finally {
      setActionLoading(null);
      setDeleteConfirm(null);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'a_iniciar':
        return {
          label: 'A Iniciar',
          icon: Clock,
          bgClass: 'bg-slate-600/80',
          textClass: 'text-slate-200',
          borderClass: 'border-slate-500/50',
          glowClass: ''
        };
      case 'em_andamento':
        return {
          label: 'Em Andamento',
          icon: PlayCircle,
          bgClass: 'bg-amber-500/20',
          textClass: 'text-amber-400',
          borderClass: 'border-amber-500/50',
          glowClass: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]'
        };
      case 'finalizada':
        return {
          label: 'Finalizada',
          icon: CheckCircle,
          bgClass: 'bg-emerald-500/20',
          textClass: 'text-emerald-400',
          borderClass: 'border-emerald-500/50',
          glowClass: ''
        };
      default:
        return {
          label: status,
          icon: Clock,
          bgClass: 'bg-gray-500/20',
          textClass: 'text-gray-400',
          borderClass: 'border-gray-500/50',
          glowClass: ''
        };
    }
  };

  // Separate rounds by status
  const inProgressRounds = rounds.filter(r => r.status === 'em_andamento');
  const toStartRounds = rounds.filter(r => r.status === 'a_iniciar');
  const finishedRounds = rounds.filter(r => r.status === 'finalizada');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

      <Header />

      <main className="flex-1 container mx-auto px-4 py-6 pb-24">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary">Gerenciar Rodadas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {rounds.length} rodada{rounds.length !== 1 ? 's' : ''} disponíve{rounds.length !== 1 ? 'is' : 'l'}
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : rounds.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-2">
              Nenhuma rodada disponível
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Defina os times primeiro em "Times → Definir Times"
            </p>
            <Button
              onClick={() => navigate('/admin/teams/define')}
              variant="outline"
            >
              Definir Times
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Em Andamento - Highlight */}
            {inProgressRounds.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <PlayCircle className="h-4 w-4" />
                  Em Andamento
                </h2>
                <div className="space-y-3">
                  <AnimatePresence>
                    {inProgressRounds.map((round) => (
                      <RoundCard
                        key={round.id}
                        round={round}
                        onManage={manageRound}
                        onDelete={(id, num) => setDeleteConfirm({ id, number: num })}
                        onStart={startRound}
                        actionLoading={actionLoading}
                        highlight
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}

            {/* A Iniciar */}
            {toStartRounds.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  A Iniciar
                </h2>
                <div className="space-y-3">
                  <AnimatePresence>
                    {toStartRounds.map((round) => (
                      <RoundCard
                        key={round.id}
                        round={round}
                        onManage={manageRound}
                        onDelete={(id, num) => setDeleteConfirm({ id, number: num })}
                        onStart={startRound}
                        actionLoading={actionLoading}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}

            {/* Finalizadas */}
            {finishedRounds.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Finalizadas
                </h2>
                <div className="space-y-3">
                  <AnimatePresence>
                    {finishedRounds.map((round) => (
                      <RoundCard
                        key={round.id}
                        round={round}
                        onManage={manageRound}
                        onDelete={(id, num) => setDeleteConfirm({ id, number: num })}
                        onStart={startRound}
                        actionLoading={actionLoading}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => navigate('/admin/teams/define')}
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Rodada {deleteConfirm?.number}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Esta ação irá:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Excluir todas as partidas desta rodada</li>
                <li>Remover gols, assistências e cartões</li>
                <li>Recalcular a classificação geral</li>
              </ul>
              <p className="font-medium text-destructive mt-2">Esta ação não pode ser desfeita.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteRound}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Round Card Component - Mobile Optimized
function RoundCard({
  round,
  onManage,
  onDelete,
  onStart,
  actionLoading,
  highlight = false
}: {
  round: Round;
  onManage: (id: string) => void;
  onDelete: (id: string, num: number) => void;
  onStart: (id: string) => void;
  actionLoading: string | null;
  highlight?: boolean;
}) {
  const formatDate = (date: string) => {
    const d = new Date(date + "T00:00:00");
    return {
      day: d.getDate(),
      month: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()
    };
  };

  const dateInfo = formatDate(round.scheduled_date);
  const isLoading = actionLoading === round.id;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'a_iniciar':
        return { label: 'Iniciar', color: 'bg-slate-500', icon: Clock };
      case 'em_andamento':
        return { label: 'Ao Vivo', color: 'bg-amber-500', icon: PlayCircle };
      case 'finalizada':
        return { label: 'Fim', color: 'bg-emerald-500', icon: CheckCircle };
      default:
        return { label: status, color: 'bg-gray-500', icon: Clock };
    }
  };

  const status = getStatusConfig(round.status);
  const StatusIcon = status.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        "relative overflow-hidden rounded-xl border transition-all duration-200",
        "bg-card/80 backdrop-blur-sm",
        highlight
          ? "border-amber-500/50 shadow-lg shadow-amber-500/10"
          : "border-border/50 hover:border-primary/30",
        isLoading && "opacity-60 pointer-events-none"
      )}
    >
      <div className="flex items-stretch">
        {/* Date Column - Compact */}
        <div className={cn(
          "flex flex-col items-center justify-center px-3 py-3 min-w-[56px]",
          highlight ? "bg-amber-500/10" : "bg-muted/30"
        )}>
          <span className="text-xl font-bold text-foreground leading-none">{dateInfo.day}</span>
          <span className="text-[10px] font-medium text-muted-foreground mt-0.5">{dateInfo.month}</span>
        </div>

        {/* Content - Compact */}
        <div className="flex-1 p-3 flex items-center gap-2">
          {/* Round Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base leading-tight">R{round.round_number}</h3>
            <Badge
              variant="secondary"
              className={cn(
                "text-[9px] px-1.5 py-0 font-medium mt-1",
                status.color, "text-white"
              )}
            >
              <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
              {status.label}
            </Badge>
          </div>

          {/* Actions - Compact */}
          <div className="flex items-center gap-1.5">
            {round.status === 'a_iniciar' && (
              <Button
                size="sm"
                onClick={() => onStart(round.id)}
                className="h-9 px-3 text-xs bg-primary hover:bg-primary/90"
                disabled={isLoading}
              >
                <PlayCircle className="h-3.5 w-3.5 mr-1" />
                Iniciar
              </Button>
            )}

            {round.status === 'em_andamento' && (
              <Button
                size="sm"
                onClick={() => onManage(round.id)}
                className="h-9 px-3 text-xs"
                disabled={isLoading}
              >
                <Settings2 className="h-3.5 w-3.5 mr-1" />
                Gerenciar
              </Button>
            )}

            {round.status === 'finalizada' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onManage(round.id)}
                className="h-9 px-3 text-xs"
                disabled={isLoading}
              >
                <Edit3 className="h-3.5 w-3.5 mr-1" />
                Editar
              </Button>
            )}

            <Button
              size="icon"
              variant="ghost"
              onClick={() => onDelete(round.id, round.round_number)}
              className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
              disabled={isLoading}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}