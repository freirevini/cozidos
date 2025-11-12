import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Search, Filter, UserCheck, UserX, AlertTriangle, UserPlus } from "lucide-react";
import { AlertDialogIcon } from "@/components/ui/alert-dialog-icon";
import { toast as sonnerToast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Player {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  email: string | null;
  birth_date: string | null;
  is_player: boolean;
  level: string | null;
  position: string | null;
  status: string | null;
  user_id: string | null;
}

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  congelado: "Congelado",
  rejeitado: "Rejeitado",
};

const statusColors: Record<string, string> = {
  pendente: "bg-yellow-600 text-white",
  aprovado: "bg-green-600 text-white",
  congelado: "bg-gray-600 text-white",
  rejeitado: "bg-red-600 text-white",
};

const positionLabels: Record<string, string> = {
  goleiro: "Goleiro",
  defensor: "Defensor",
  "meio-campista": "Meio-Campista",
  atacante: "Atacante",
};

export default function ManagePlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPosition, setFilterPosition] = useState<string>("all");

  // Estados para inline editing
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [nicknameValue, setNicknameValue] = useState("");

  // Estados para dialog de cadastro
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    nickname: "",
    email: "",
    birth_date: "",
    level: "",
    position: "",
  });

  useEffect(() => {
    checkAdmin();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadPlayers();
    }
  }, [isAdmin]);

  useEffect(() => {
    applyFilters();
  }, [players, searchTerm, filterStatus, filterPosition]);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (data?.role !== "admin") {
      navigate("/");
      sonnerToast.error("Acesso negado: apenas administradores");
      return;
    }

    setIsAdmin(true);
  };

  const loadPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_player", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPlayers(data || []);
    } catch (error: any) {
      sonnerToast.error("Erro ao carregar jogadores: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...players];

    // Filtro de busca por nome/apelido/email
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name?.toLowerCase().includes(term) ||
          p.nickname?.toLowerCase().includes(term) ||
          p.first_name?.toLowerCase().includes(term) ||
          p.last_name?.toLowerCase().includes(term) ||
          p.email?.toLowerCase().includes(term)
      );
    }

    // Filtro por status
    if (filterStatus !== "all") {
      filtered = filtered.filter((p) => p.status === filterStatus);
    }

    // Filtro por posição
    if (filterPosition !== "all") {
      filtered = filtered.filter((p) => p.position === filterPosition);
    }

    setFilteredPlayers(filtered);
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

  const updatePlayer = async (playerId: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ [field]: value })
        .eq("id", playerId);

      if (error) throw error;

      setPlayers(
        players.map((p) => (p.id === playerId ? { ...p, [field]: value } : p))
      );

      sonnerToast.success("Jogador atualizado com sucesso!");
    } catch (error: any) {
      sonnerToast.error("Erro ao atualizar: " + error.message);
    }
  };

  const approvePlayer = (playerId: string, playerName: string) => {
    return new Promise<void>((resolve) => {
      const dialog = document.createElement('div');
      document.body.appendChild(dialog);
      
      const root = document.createElement('div');
      dialog.appendChild(root);
      
      const cleanup = () => {
        document.body.removeChild(dialog);
        resolve();
      };

      import('react-dom/client').then(({ createRoot }) => {
        const reactRoot = createRoot(root);
        reactRoot.render(
          <AlertDialogIcon
            icon={UserCheck}
            title="Aprovar Jogador"
            description={`Deseja aprovar ${playerName}? Ele poderá ser escalado em times após a aprovação.`}
            actionText="Aprovar"
            cancelText="Cancelar"
            variant="default"
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                reactRoot.unmount();
                cleanup();
              }
            }}
            onAction={async () => {
              await updatePlayer(playerId, "status", "aprovado");
              reactRoot.unmount();
              cleanup();
            }}
            onCancel={() => {
              reactRoot.unmount();
              cleanup();
            }}
          />
        );
      });
    });
  };

  const rejectPlayer = (playerId: string, playerName: string) => {
    return new Promise<void>((resolve) => {
      const dialog = document.createElement('div');
      document.body.appendChild(dialog);
      
      const root = document.createElement('div');
      dialog.appendChild(root);
      
      const cleanup = () => {
        document.body.removeChild(dialog);
        resolve();
      };

      import('react-dom/client').then(({ createRoot }) => {
        const reactRoot = createRoot(root);
        reactRoot.render(
          <AlertDialogIcon
            icon={UserX}
            title="Rejeitar Jogador"
            description={`Deseja rejeitar o cadastro de ${playerName}? Esta ação pode ser revertida posteriormente.`}
            actionText="Rejeitar"
            cancelText="Cancelar"
            variant="destructive"
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                reactRoot.unmount();
                cleanup();
              }
            }}
            onAction={async () => {
              await updatePlayer(playerId, "status", "rejeitado");
              reactRoot.unmount();
              cleanup();
            }}
            onCancel={() => {
              reactRoot.unmount();
              cleanup();
            }}
          />
        );
      });
    });
  };

  const deletePlayer = async (playerId: string, playerName: string, playerEmail: string | null) => {
    return new Promise<void>((resolve) => {
      const dialog = document.createElement('div');
      document.body.appendChild(dialog);
      
      const root = document.createElement('div');
      dialog.appendChild(root);
      
      const cleanup = () => {
        document.body.removeChild(dialog);
        resolve();
      };

      import('react-dom/client').then(({ createRoot }) => {
        const reactRoot = createRoot(root);
        reactRoot.render(
          <AlertDialogIcon
            icon={AlertTriangle}
            title="Excluir Jogador"
            description={`Tem certeza que deseja excluir ${playerName}? TODOS os dados associados (gols, assistências, cartões, estatísticas, presenças) serão removidos permanentemente. Esta ação NÃO pode ser desfeita.`}
            actionText="Excluir Permanentemente"
            cancelText="Cancelar"
            variant="destructive"
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                reactRoot.unmount();
                cleanup();
              }
            }}
            onAction={async () => {
              reactRoot.unmount();
              cleanup();
              
              try {
                const { data: result, error } = await supabase.rpc("delete_player_complete", {
                  p_profile_id: playerId,
                });

                if (error) throw error;

                const resultData = result as any;

                // Se houver user_id, opcionalmente deletar do auth
                if (resultData?.user_id) {
                  // Segundo dialog para confirmar remoção de auth
                  const dialog2 = document.createElement('div');
                  document.body.appendChild(dialog2);
                  const root2 = document.createElement('div');
                  dialog2.appendChild(root2);
                  
                  const cleanup2 = () => {
                    document.body.removeChild(dialog2);
                  };

                  const reactRoot2 = createRoot(root2);
                  reactRoot2.render(
                    <AlertDialogIcon
                      icon={AlertTriangle}
                      title="Remover Acesso ao Sistema?"
                      description={`Deseja também remover o acesso de autenticação de ${playerName}? Isso impedirá que ele faça login no sistema.`}
                      actionText="Remover Acesso"
                      cancelText="Manter Acesso"
                      variant="destructive"
                      open={true}
                      onOpenChange={(open) => {
                        if (!open) {
                          reactRoot2.unmount();
                          cleanup2();
                        }
                      }}
                      onAction={async () => {
                        const { error: authError } = await supabase.functions.invoke("delete-auth-user", {
                          body: { user_id: resultData.user_id },
                        });

                        if (authError) {
                          console.error("Erro ao remover acesso:", authError);
                          sonnerToast.error("Jogador removido mas houve erro ao remover acesso de autenticação");
                        } else {
                          sonnerToast.success("Jogador e acesso de autenticação removidos com sucesso!");
                        }
                        
                        reactRoot2.unmount();
                        cleanup2();
                      }}
                      onCancel={() => {
                        sonnerToast.success("Jogador removido com sucesso! Acesso de autenticação mantido.");
                        reactRoot2.unmount();
                        cleanup2();
                      }}
                    />
                  );
                } else {
                  sonnerToast.success("Jogador removido com sucesso!");
                }

                setPlayers(players.filter((p) => p.id !== playerId));
              } catch (error: any) {
                sonnerToast.error("Erro ao remover jogador: " + error.message);
              }
            }}
            onCancel={() => {
              reactRoot.unmount();
              cleanup();
            }}
          />
        );
      });
    });
  };

  const handleNicknameEdit = (player: Player) => {
    setEditingNickname(player.id);
    setNicknameValue(player.nickname || "");
  };

  const saveNickname = async (playerId: string) => {
    await updatePlayer(playerId, "nickname", nicknameValue);
    setEditingNickname(null);
  };

  const handleCreatePlayer = async () => {
    // Validações
    if (!formData.first_name || !formData.last_name || !formData.email || !formData.birth_date || !formData.level || !formData.position) {
      sonnerToast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      sonnerToast.error("E-mail inválido");
      return;
    }

    // Validar data de nascimento
    const birthDate = new Date(formData.birth_date);
    const today = new Date();
    if (birthDate > today) {
      sonnerToast.error("Data de nascimento não pode ser no futuro");
      return;
    }
    if (birthDate < new Date("1900-01-01")) {
      sonnerToast.error("Data de nascimento inválida");
      return;
    }

    try {
      // Normalizar email
      const normalizedEmail = formData.email.toLowerCase().trim();

      // Verificar duplicidade de email
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (existing) {
        sonnerToast.error("Já existe um jogador com este e-mail");
        return;
      }

      // Inserir novo perfil
      const { error } = await supabase
        .from("profiles")
        .insert([{
          first_name: formData.first_name,
          last_name: formData.last_name,
          nickname: formData.nickname || formData.first_name,
          name: `${formData.first_name} ${formData.last_name}`,
          email: normalizedEmail,
          birth_date: formData.birth_date,
          level: formData.level as "A" | "B" | "C" | "D" | "E",
          position: formData.position as "goleiro" | "defensor" | "meio-campista" | "atacante",
          is_player: true,
          status: "aprovado" as "aprovado",
          user_id: null,
        }]);

      if (error) throw error;

      sonnerToast.success("Jogador cadastrado com sucesso!");
      setAddDialogOpen(false);
      setFormData({
        first_name: "",
        last_name: "",
        nickname: "",
        email: "",
        birth_date: "",
        level: "",
        position: "",
      });
      loadPlayers();
    } catch (error: any) {
      sonnerToast.error("Erro ao cadastrar jogador: " + error.message);
    }
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-3xl font-bold text-primary glow-text">
              Gerenciar Jogadores
            </CardTitle>
            <Button 
              onClick={() => setAddDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Cadastrar Novo Jogador
            </Button>
          </CardHeader>
          <CardContent>
            {/* Filtros */}
            <div className="mb-6 space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Filter className="h-5 w-5" />
                <span className="font-semibold">Filtros</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Busca */}
                <div className="space-y-2">
                  <Label htmlFor="search">Buscar por Nome/Email</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Digite para buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Filtro Status */}
                <div className="space-y-2">
                  <Label htmlFor="filterStatus">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger id="filterStatus">
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="aprovado">Aprovado</SelectItem>
                      <SelectItem value="congelado">Congelado</SelectItem>
                      <SelectItem value="rejeitado">Rejeitado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro Posição */}
                <div className="space-y-2">
                  <Label htmlFor="filterPosition">Posição</Label>
                  <Select value={filterPosition} onValueChange={setFilterPosition}>
                    <SelectTrigger id="filterPosition">
                      <SelectValue placeholder="Todas as posições" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as posições</SelectItem>
                      <SelectItem value="goleiro">Goleiro</SelectItem>
                      <SelectItem value="defensor">Defensor</SelectItem>
                      <SelectItem value="meio-campista">Meio-Campista</SelectItem>
                      <SelectItem value="atacante">Atacante</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Contador de resultados */}
              <div className="text-sm text-muted-foreground">
                {filteredPlayers.length === players.length
                  ? `${players.length} jogador(es) total`
                  : `${filteredPlayers.length} de ${players.length} jogador(es)`}
              </div>
            </div>

            {/* Desktop: Tabela completa */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Apelido</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Idade</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead>Posição</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filteredPlayers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhum jogador encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPlayers.map((player) => (
                      <TableRow key={player.id}>
                        {/* Nome */}
                        <TableCell className="font-medium">
                          {player.first_name && player.last_name
                            ? `${player.first_name} ${player.last_name}`
                            : player.name || "-"}
                        </TableCell>

                        {/* Apelido (editável) */}
                        <TableCell>
                          {editingNickname === player.id ? (
                            <div className="flex gap-2 items-center">
                              <Input
                                value={nicknameValue}
                                onChange={(e) => setNicknameValue(e.target.value)}
                                className="max-w-[150px]"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveNickname(player.id);
                                  if (e.key === "Escape") setEditingNickname(null);
                                }}
                                autoFocus
                              />
                              <Button
                                size="sm"
                                onClick={() => saveNickname(player.id)}
                              >
                                ✓
                              </Button>
                            </div>
                          ) : (
                            <span
                              className="cursor-pointer hover:underline"
                              onClick={() => handleNicknameEdit(player)}
                            >
                              {player.nickname || "-"}
                            </span>
                          )}
                        </TableCell>

                        {/* Email */}
                        <TableCell className="text-sm text-muted-foreground">
                          {player.email || "-"}
                        </TableCell>

                        {/* Idade */}
                        <TableCell>{calculateAge(player.birth_date)}</TableCell>

                        {/* Nível (editável) */}
                        <TableCell>
                          <Select
                            value={player.level || ""}
                            onValueChange={(value) => updatePlayer(player.id, "level", value)}
                          >
                            <SelectTrigger className="w-[80px]">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="A">A</SelectItem>
                              <SelectItem value="B">B</SelectItem>
                              <SelectItem value="C">C</SelectItem>
                              <SelectItem value="D">D</SelectItem>
                              <SelectItem value="E">E</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Posição (editável) */}
                        <TableCell>
                          <Select
                            value={player.position || ""}
                            onValueChange={(value) => updatePlayer(player.id, "position", value)}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="goleiro">Goleiro</SelectItem>
                              <SelectItem value="defensor">Defensor</SelectItem>
                              <SelectItem value="meio-campista">Meio-Campista</SelectItem>
                              <SelectItem value="atacante">Atacante</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Select
                            value={player.status || "pendente"}
                            onValueChange={(value) => updatePlayer(player.id, "status", value)}
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pendente">Pendente</SelectItem>
                              <SelectItem value="aprovado">Aprovado</SelectItem>
                              <SelectItem value="congelado">Congelado</SelectItem>
                              <SelectItem value="rejeitado">Rejeitado</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Ações */}
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            {player.status === "pendente" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => approvePlayer(player.id, player.name)}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <UserCheck className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => rejectPlayer(player.id, player.name)}
                                >
                                  <UserX className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deletePlayer(player.id, player.name, player.email)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile: Cards */}
            <div className="md:hidden space-y-3">
              {loading ? (
                <div className="text-center py-8">Carregando...</div>
              ) : filteredPlayers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum jogador encontrado
                </div>
              ) : (
                filteredPlayers.map((player) => (
                  <Card key={player.id} className="border-border">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-base">
                            {player.nickname || player.first_name || player.name}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {player.email || "-"}
                          </p>
                        </div>
                        <Badge className={statusColors[player.status || "pendente"]}>
                          {statusLabels[player.status || "pendente"]}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div>
                          <span className="text-muted-foreground">Idade:</span>{" "}
                          <span className="font-medium">{calculateAge(player.birth_date)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Nível:</span>{" "}
                          <span className="font-medium">{player.level || "-"}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Posição:</span>{" "}
                          <span className="font-medium">{positionLabels[player.position || ""] || "-"}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 flex-wrap">
                        {player.status === "pendente" && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => approvePlayer(player.id, player.name)}
                              className="bg-green-600 hover:bg-green-700 flex-1 min-h-[44px]"
                            >
                              <UserCheck className="h-4 w-4 mr-1" />
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => rejectPlayer(player.id, player.name)}
                              className="flex-1 min-h-[44px]"
                            >
                              <UserX className="h-4 w-4 mr-1" />
                              Rejeitar
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deletePlayer(player.id, player.name, player.email)}
                          className={`min-h-[44px] ${player.status === "pendente" ? "w-full" : "flex-1"}`}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Excluir
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dialog de Cadastro */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-primary">
                Cadastrar Novo Jogador
              </DialogTitle>
              <DialogDescription>
                Preencha os dados do jogador. Ele será cadastrado como aprovado e poderá ser escalado imediatamente.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nome */}
                <div className="space-y-2">
                  <Label htmlFor="first_name">
                    Nome <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="first_name"
                    placeholder="Ex: João"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="h-12 text-base"
                  />
                </div>

                {/* Sobrenome */}
                <div className="space-y-2">
                  <Label htmlFor="last_name">
                    Sobrenome <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="last_name"
                    placeholder="Ex: Silva"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="h-12 text-base"
                  />
                </div>

                {/* Apelido */}
                <div className="space-y-2">
                  <Label htmlFor="nickname">Apelido</Label>
                  <Input
                    id="nickname"
                    placeholder="Ex: João (opcional)"
                    value={formData.nickname}
                    onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                    className="h-12 text-base"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">
                    E-mail <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Ex: joao@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-12 text-base"
                  />
                </div>

                {/* Data de Nascimento */}
                <div className="space-y-2">
                  <Label htmlFor="birth_date">
                    Data de Nascimento <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    className="h-12 text-base"
                  />
                </div>

                {/* Nível */}
                <div className="space-y-2">
                  <Label htmlFor="level">
                    Nível <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.level}
                    onValueChange={(value) => setFormData({ ...formData, level: value })}
                  >
                    <SelectTrigger id="level" className="h-12 text-base">
                      <SelectValue placeholder="Selecione o nível" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                      <SelectItem value="C">C</SelectItem>
                      <SelectItem value="D">D</SelectItem>
                      <SelectItem value="E">E</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Posição */}
                <div className="space-y-2">
                  <Label htmlFor="position">
                    Posição <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.position}
                    onValueChange={(value) => setFormData({ ...formData, position: value })}
                  >
                    <SelectTrigger id="position" className="h-12 text-base">
                      <SelectValue placeholder="Selecione a posição" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="goleiro">Goleiro</SelectItem>
                      <SelectItem value="defensor">Defensor</SelectItem>
                      <SelectItem value="meio-campista">Meio-Campista</SelectItem>
                      <SelectItem value="atacante">Atacante</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAddDialogOpen(false);
                  setFormData({
                    first_name: "",
                    last_name: "",
                    nickname: "",
                    email: "",
                    birth_date: "",
                    level: "",
                    position: "",
                  });
                }}
                className="h-12 text-base w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button onClick={handleCreatePlayer} className="h-12 text-base w-full sm:w-auto">
                Cadastrar Jogador
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
