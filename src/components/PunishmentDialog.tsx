import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { X } from "lucide-react";

interface Punishment {
  id: string;
  round_id: string;
  points: number;
  reason: string | null;
  created_at: string;
  rounds: {
    round_number: number;
  };
}

interface PunishmentDialogProps {
  playerId: string;
  playerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PunishmentDialog({ playerId, playerName, open, onOpenChange }: PunishmentDialogProps) {
  const [punishments, setPunishments] = useState<Punishment[]>([]);
  const [rounds, setRounds] = useState<Array<{ id: string; round_number: number }>>([]);
  const [loading, setLoading] = useState(false);
  interface NewPunishment {
    round_id: string;
    points: string;
    reason: string;
  }

  const [newPunishment, setNewPunishment] = useState<NewPunishment>({
    round_id: "",
    points: "",
    reason: "",
  });

  useEffect(() => {
    if (open) {
      loadPunishments();
      loadRounds();
    }
  }, [open, playerId]);

  const loadPunishments = async () => {
    try {
      const { data, error } = await supabase
        .from("punishments")
        .select(`
          *,
          rounds (
            round_number
          )
        `)
        .eq("player_id", playerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPunishments(data || []);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Erro ao carregar punições:", msg);
      toast.error("Erro ao carregar punições");
    }
  };

  const loadRounds = async () => {
    try {
      const { data, error } = await supabase
        .from("rounds")
        .select("id, round_number")
        .order("round_number", { ascending: false });

      if (error) throw error;
      setRounds(data || []);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Erro ao carregar rodadas:", msg);
      toast.error("Erro ao carregar rodadas");
    }
  };

  const addPunishment = async () => {
    if (!newPunishment.round_id || !newPunishment.points) {
      toast.error("Preencha a rodada e os pontos");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("punishments")
        .insert({
          player_id: playerId,
          round_id: newPunishment.round_id,
          points: parseInt(newPunishment.points),
          reason: newPunishment.reason || null,
        });

      if (error) throw error;

      toast.success("Punição adicionada com sucesso");
      setNewPunishment({ round_id: "", points: "", reason: "" });
      loadPunishments();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error("Erro ao adicionar punição: " + msg);
    } finally {
      setLoading(false);
    }
  };

  const deletePunishment = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta punição?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("punishments")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Punição excluída");
      loadPunishments();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error("Erro ao excluir punição: " + msg);
    }
  };

  const totalPoints = punishments.reduce((sum, p) => sum + p.points, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Punições de {playerName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">Total de Pontos de Punição</p>
            <p className="text-3xl font-bold text-primary">{totalPoints}</p>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Adicionar Nova Punição</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Rodada *</Label>
                <Select value={newPunishment.round_id} onValueChange={(v) => setNewPunishment({ ...newPunishment, round_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {rounds.map((round) => (
                      <SelectItem key={round.id} value={round.id}>
                        Rodada {round.round_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Pontos *</Label>
                <Input
                  type="number"
                  value={newPunishment.points}
                  onChange={(e) => setNewPunishment({ ...newPunishment, points: e.target.value })}
                  placeholder="Ex: -5"
                />
              </div>

              <div className="flex items-end">
                <Button onClick={addPunishment} disabled={loading} className="w-full">
                  Adicionar
                </Button>
              </div>
            </div>

            <div>
              <Label>Motivo (opcional)</Label>
              <Input
                value={newPunishment.reason}
                onChange={(e) => setNewPunishment({ ...newPunishment, reason: e.target.value })}
                placeholder="Descreva o motivo da punição"
              />
            </div>
          </div>

          {punishments.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">Histórico de Punições</h3>
              {punishments.map((punishment) => (
                <div key={punishment.id} className="flex items-center justify-between p-3 bg-muted/30 rounded border border-border">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Rodada {punishment.rounds.round_number}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className={punishment.points < 0 ? "text-red-500 font-bold" : "text-green-500 font-bold"}>
                        {punishment.points} pontos
                      </span>
                    </div>
                    {punishment.reason && (
                      <p className="text-sm text-muted-foreground mt-1">{punishment.reason}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deletePunishment(punishment.id)}
                  >
                    <X size={18} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}