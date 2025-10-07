import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { X } from "lucide-react";

interface Player {
  id: string;
  name: string;
  nickname: string | null;
}

interface AttendanceRecord {
  player_id: string;
  player_name: string;
  status: "atrasado" | "falta";
}

export default function AttendanceRecord() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState("");
  const [currentStatus, setCurrentStatus] = useState<"atrasado" | "falta" | "">("");

  useEffect(() => {
    checkAdmin();
    loadPlayers();
  }, [roundId]);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      
      if (data?.role !== "admin") {
        toast.error("Acesso não autorizado");
        navigate("/");
        return;
      }
      setIsAdmin(data?.role === "admin");
    }
  };

  const loadPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_player", true)
        .eq("status", "aprovado")
        .order("nickname");

      if (error) throw error;
      setPlayers(data || []);
    } catch (error) {
      console.error("Erro ao carregar jogadores:", error);
      toast.error("Erro ao carregar jogadores");
    }
  };

  const addRecord = () => {
    if (!currentPlayer || !currentStatus) {
      toast.error("Selecione um jogador e um status");
      return;
    }

    const player = players.find(p => p.id === currentPlayer);
    if (!player) return;

    // Verificar se já existe
    if (records.some(r => r.player_id === currentPlayer)) {
      toast.error("Jogador já adicionado");
      return;
    }

    setRecords([...records, {
      player_id: currentPlayer,
      player_name: player.nickname || player.name,
      status: currentStatus,
    }]);

    setCurrentPlayer("");
    setCurrentStatus("");
    toast.success("Registro adicionado");
  };

  const removeRecord = (player_id: string) => {
    setRecords(records.filter(r => r.player_id !== player_id));
  };

  const saveAndFinalize = async () => {
    if (!roundId) return;

    if (!confirm("Tem certeza que deseja salvar e finalizar a rodada?")) {
      return;
    }

    setLoading(true);
    try {
      // Verificar se todas as partidas foram finalizadas
      const { data: matches } = await supabase
        .from("matches")
        .select("*")
        .eq("round_id", roundId);

      const unfinishedMatches = matches?.filter(m => m.status !== 'finished') || [];
      if (unfinishedMatches.length > 0) {
        toast.error(`Ainda há ${unfinishedMatches.length} partida(s) não finalizada(s)`);
        setLoading(false);
        return;
      }

      // Salvar registros de atraso/falta
      for (const record of records) {
        // Verificar se já existe um registro de presença
        const { data: existingAttendance } = await supabase
          .from("player_attendance")
          .select("*")
          .eq("player_id", record.player_id)
          .eq("round_id", roundId)
          .maybeSingle();

        if (existingAttendance) {
          // Atualizar
          await supabase
            .from("player_attendance")
            .update({ status: record.status })
            .eq("id", existingAttendance.id);
        } else {
          // Inserir novo
          await supabase
            .from("player_attendance")
            .insert({
              player_id: record.player_id,
              round_id: roundId,
              status: record.status,
              team_color: "branco" // Valor padrão, será ajustado se necessário
            });
        }
      }

      // Finalizar rodada
      const { error: updateError } = await supabase
        .from("rounds")
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq("id", roundId);

      if (updateError) throw updateError;

      toast.success("Rodada finalizada com sucesso!");
      navigate("/admin/round");
    } catch (error: any) {
      console.error("Erro ao finalizar rodada:", error);
      toast.error("Erro ao finalizar rodada: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header isAdmin={isAdmin} />
      <main className="container mx-auto px-4 py-8">
        <Card className="card-glow bg-card border-border max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-primary glow-text text-center">
              REGISTRAR ATRASOS E FALTAS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Select value={currentPlayer} onValueChange={setCurrentPlayer}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o jogador" />
                </SelectTrigger>
                <SelectContent>
                  {players
                    .filter(p => !records.some(r => r.player_id === p.id))
                    .map((player) => (
                      <SelectItem key={player.id} value={player.id}>
                        {player.nickname || player.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Select value={currentStatus} onValueChange={(v) => setCurrentStatus(v as "atrasado" | "falta")}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o evento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="atrasado">Atraso</SelectItem>
                  <SelectItem value="falta">Falta</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={addRecord} className="w-full" disabled={!currentPlayer || !currentStatus}>
                Adicionar Registro
              </Button>
            </div>

            {records.length > 0 && (
              <Card className="bg-muted/20 border-border">
                <CardContent className="pt-6">
                  <h3 className="font-bold mb-4">Registros Adicionados:</h3>
                  <div className="space-y-2">
                    {records.map((record) => (
                      <div key={record.player_id} className="flex items-center justify-between p-3 bg-background rounded border border-border">
                        <div>
                          <p className="font-medium">{record.player_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {record.status === "atrasado" ? "Atrasou" : "Faltou"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRecord(record.player_id)}
                        >
                          <X size={18} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-col gap-3">
              <Button
                onClick={() => navigate(`/admin/round/manage?round=${roundId}`)}
                variant="outline"
                className="w-full"
              >
                Voltar
              </Button>
              <Button
                onClick={async () => {
                  if (!roundId) return;
                  setLoading(true);
                  try {
                    for (const record of records) {
                      const { data: existingAttendance } = await supabase
                        .from("player_attendance")
                        .select("*")
                        .eq("player_id", record.player_id)
                        .eq("round_id", roundId)
                        .maybeSingle();

                      if (existingAttendance) {
                        await supabase
                          .from("player_attendance")
                          .update({ status: record.status })
                          .eq("id", existingAttendance.id);
                      }
                    }
                    toast.success("Atrasos e faltas salvos!");
                    navigate(`/admin/round/manage?round=${roundId}`);
                  } catch (error: any) {
                    toast.error("Erro ao salvar: " + error.message);
                  } finally {
                    setLoading(false);
                  }
                }}
                variant="secondary"
                className="w-full"
                disabled={loading}
              >
                Salvar e Editar Partidas
              </Button>
              <Button
                onClick={saveAndFinalize}
                className="w-full"
                disabled={loading}
              >
                Salvar e Encerrar Rodada
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}