import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Player {
  id: string;
  name: string;
  nickname: string | null;
  birth_date: string | null;
  is_player: boolean;
  player_type: string | null;
  level: string | null;
  position: string | null;
  is_approved: boolean;
}

const positionMap: Record<string, string> = {
  goleiro: "Goleiro",
  defensor: "Defensor",
  meio_campo: "Meio Campo",
  atacante: "Atacante",
};

const levelMap: Record<string, string> = {
  a: "A",
  b: "B",
  c: "C",
  d: "D",
  e: "E",
};

export default function ManagePlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkAdmin();
    loadPlayers();
  }, []);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      setIsAdmin(data?.role === "admin");
    }
  };

  const loadPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_player", true)
        .order("name");

      if (error) throw error;
      setPlayers(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar jogadores",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePlayer = async (playerId: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ [field]: value })
        .eq("id", playerId);

      if (error) throw error;

      setPlayers(players.map(p => 
        p.id === playerId ? { ...p, [field]: value } : p
      ));

      toast({
        title: "Jogador atualizado",
        description: "As informações foram salvas com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return "-";
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header isAdmin={false} />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Acesso restrito a administradores.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header isAdmin={isAdmin} />
      <main className="container mx-auto px-4 py-8">
        <Card className="card-glow bg-card border-border">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-primary glow-text">
              Gerenciar Jogadores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : players.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum jogador cadastrado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Apelido</TableHead>
                      <TableHead>Idade</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Nível</TableHead>
                      <TableHead>Posição</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {players.map((player) => (
                      <TableRow key={player.id}>
                        <TableCell>{player.name}</TableCell>
                        <TableCell>{player.nickname || "-"}</TableCell>
                        <TableCell>{calculateAge(player.birth_date)}</TableCell>
                        <TableCell className="capitalize">{player.player_type || "-"}</TableCell>
                        <TableCell>
                          <Select
                            value={player.level || ""}
                            onValueChange={(value) => updatePlayer(player.id, "level", value)}
                          >
                            <SelectTrigger className="w-20">
                              <SelectValue placeholder="Nível" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(levelMap).map(([key, label]) => (
                                <SelectItem key={key} value={key}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={player.position || ""}
                            onValueChange={(value) => updatePlayer(player.id, "position", value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="Posição" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(positionMap).map(([key, label]) => (
                                <SelectItem key={key} value={key}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {player.is_approved ? (
                            <Badge className="bg-green-600">Aprovado</Badge>
                          ) : (
                            <Badge variant="outline">Pendente</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {!player.is_approved && player.level && player.position && (
                            <Button
                              size="sm"
                              onClick={() => updatePlayer(player.id, "is_approved", true)}
                            >
                              Aprovar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
