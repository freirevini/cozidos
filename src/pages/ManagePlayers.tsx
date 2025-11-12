import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Search, Filter, UserCheck, UserX, AlertTriangle, UserPlus, RefreshCw, Upload } from "lucide-react";
import { AlertDialogIcon } from "@/components/ui/alert-dialog-icon";
import { toast as sonnerToast } from "sonner";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import * as XLSX from "xlsx";
import Papa from "papaparse";
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
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPosition, setFilterPosition] = useState<string>("all");

  // Estados para inline editing (nickname - desktop)
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [nicknameValue, setNicknameValue] = useState("");

  // Estados para edição completa (mobile)
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingPlayerData, setEditingPlayerData] = useState<Player | null>(null);

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
  };

  const loadPlayers = async () => {
    setLoading(true);
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

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await loadPlayers();
      sonnerToast.success("Dados atualizados!");
    },
    enabled: true,
  });

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

  // Funções para edição inline mobile
  const handleEditPlayer = (player: Player) => {
    setEditingPlayerId(player.id);
    setEditingPlayerData({ ...player });
  };

  const handleCancelEdit = () => {
    setEditingPlayerId(null);
    setEditingPlayerData(null);
  };

  const handleSaveEdit = () => {
    if (!editingPlayerData) return;

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
            title="Salvar Alterações"
            description="Deseja realmente salvar as alterações realizadas neste jogador?"
            actionText="Salvar"
            cancelText="Descartar"
            variant="default"
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                reactRoot.unmount();
                cleanup();
              }
            }}
            onAction={async () => {
              try {
                const { error } = await supabase
                  .from("profiles")
                  .update({
                    nickname: editingPlayerData.nickname,
                    level: editingPlayerData.level as "A" | "B" | "C" | "D" | "E" | null,
                    position: editingPlayerData.position as "goleiro" | "defensor" | "meio-campista" | "atacante" | null,
                    status: editingPlayerData.status as "pendente" | "aprovado" | "congelado" | "rejeitado" | null,
                  })
                  .eq("id", editingPlayerData.id);

                if (error) throw error;

                setPlayers(
                  players.map((p) => (p.id === editingPlayerData.id ? editingPlayerData : p))
                );

                sonnerToast.success("Alterações salvas com sucesso!");
                setEditingPlayerId(null);
                setEditingPlayerData(null);
              } catch (error: any) {
                sonnerToast.error("Erro ao salvar: " + error.message);
              }
              
              reactRoot.unmount();
              cleanup();
            }}
            onCancel={() => {
              sonnerToast.info("Alterações descartadas");
              setEditingPlayerId(null);
              setEditingPlayerData(null);
              reactRoot.unmount();
              cleanup();
            }}
          />
        );
      });
    });
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
        sonnerToast.error("Formato inválido. Use arquivos .csv, .xlsx ou .xls");
      }
    } catch (error: any) {
      sonnerToast.error("Erro ao importar: " + error.message);
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const processImportedData = async (data: any[]) => {
    if (data.length === 0) {
      sonnerToast.error("Arquivo vazio");
      return;
    }

    const firstRow = data[0];
    const requiredColumns = ["Nome", "Sobrenome", "E-mail", "Data de Nascimento"];
    const missingColumns = requiredColumns.filter(
      col => !(col in firstRow) && !(col.toLowerCase() in firstRow)
    );

    if (missingColumns.length > 0) {
      sonnerToast.error(
        `Colunas obrigatórias ausentes: ${missingColumns.join(", ")}`
      );
      return;
    }

    const inserts: any[] = [];
    const errors: string[] = [];
    let created = 0;
    let skipped = 0;

    for (const row of data) {
      const firstName = row["Nome"] || row["nome"];
      const lastName = row["Sobrenome"] || row["sobrenome"];
      const nickname = row["Apelido"] || row["apelido"];
      const email = (row["E-mail"] || row["email"])?.toString().toLowerCase().trim();
      const birthDateStr = row["Data de Nascimento"] || row["data de nascimento"];

      if (!firstName || !lastName || !email || !birthDateStr) {
        errors.push(`Linha com dados incompletos: ${email || firstName || "desconhecido"}`);
        skipped++;
        continue;
      }

      let birthDate: string | null = null;
      try {
        const [day, month, year] = birthDateStr.toString().split("/");
        if (day && month && year) {
          birthDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        } else {
          throw new Error("Formato inválido");
        }
      } catch {
        errors.push(`Data de nascimento inválida para ${email}: ${birthDateStr}`);
        skipped++;
        continue;
      }

      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingProfile) {
        errors.push(`E-mail já cadastrado: ${email}`);
        skipped++;
        continue;
      }

      inserts.push({
        id: crypto.randomUUID(),
        first_name: firstName,
        last_name: lastName,
        name: `${firstName} ${lastName}`,
        nickname: nickname || null,
        email: email,
        birth_date: birthDate,
        is_player: true,
        status: 'pendente',
        level: null,
        position: null,
        user_id: null,
      });
      created++;
    }

    if (inserts.length > 0) {
      const { error } = await supabase
        .from("profiles")
        .insert(inserts);

      if (error) {
        sonnerToast.error("Erro ao inserir jogadores: " + error.message);
        return;
      }
    }

    await loadPlayers();

    if (created > 0) {
      sonnerToast.success(
        `✅ ${created} jogador(es) importado(s) com sucesso!` +
        (skipped > 0 ? ` (${skipped} linha(s) ignorada(s))` : "")
      );
    }

    if (errors.length > 0) {
      console.warn("Erros de importação:", errors);
      sonnerToast.warning(
        `${errors.length} linha(s) com erro. Verifique o console para detalhes.`
      );
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
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
      {/* Pull to Refresh Indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div 
          className="fixed top-0 left-0 right-0 flex justify-center items-center z-50 transition-all"
          style={{ 
            transform: `translateY(${Math.min(pullDistance, 60)}px)`,
            opacity: Math.min(pullDistance / 60, 1)
          }}
        >
          <div className="bg-primary/90 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">
              {isRefreshing ? 'Atualizando...' : 'Solte para atualizar'}
            </span>
          </div>
        </div>
      )}

      <Header />
      <main className="container mx-auto px-4 py-8">
        <Card className="card-glow bg-card border-border">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-3xl font-bold text-primary glow-text">
              Gerenciar Jogadores
            </CardTitle>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button 
                onClick={() => document.getElementById('excel-upload')?.click()}
                disabled={importing}
                className="w-full sm:w-auto min-h-[44px] bg-primary hover:bg-primary/90"
              >
                <Upload className="mr-2 h-4 w-4" />
                {importing ? "Importando..." : "Importar Excel"}
              </Button>
              
              <Button 
                onClick={() => setAddDialogOpen(true)} 
                className="w-full sm:w-auto min-h-[44px] bg-primary hover:bg-primary/90"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Cadastrar Novo Jogador
              </Button>
            </div>
            
            <input
              id="excel-upload"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileImport}
              className="hidden"
            />
          </CardHeader>
          <CardContent>
            {/* Quick Filters - Mobile Only */}
            <div className="md:hidden mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-muted-foreground">Filtros Rápidos</span>
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth pb-2">
                <Button
                  variant={filterStatus === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus("all")}
                  className="whitespace-nowrap"
                >
                  Todos
                </Button>
                <Button
                  variant={filterStatus === "pendente" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus("pendente")}
                  className="whitespace-nowrap"
                >
                  Pendentes
                </Button>
                <Button
                  variant={filterStatus === "aprovado" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus("aprovado")}
                  className="whitespace-nowrap"
                >
                  Aprovados
                </Button>
                <Button
                  variant={filterPosition === "goleiro" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterPosition(filterPosition === "goleiro" ? "all" : "goleiro")}
                  className="whitespace-nowrap"
                >
                  🥅 Goleiros
                </Button>
                <Button
                  variant={filterPosition === "defensor" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterPosition(filterPosition === "defensor" ? "all" : "defensor")}
                  className="whitespace-nowrap"
                >
                  🛡️ Defensores
                </Button>
                <Button
                  variant={filterPosition === "meio-campista" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterPosition(filterPosition === "meio-campista" ? "all" : "meio-campista")}
                  className="whitespace-nowrap"
                >
                  ⚙️ Meias
                </Button>
                <Button
                  variant={filterPosition === "atacante" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterPosition(filterPosition === "atacante" ? "all" : "atacante")}
                  className="whitespace-nowrap"
                >
                  ⚽ Atacantes
                </Button>
              </div>
            </div>

            {/* Filtros Completos - Desktop */}
            <div className="mb-6 space-y-4 hidden md:block">
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
                // Skeleton Loading
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="border-border">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-32" />
                          <Skeleton className="h-4 w-48" />
                        </div>
                        <Skeleton className="h-6 w-20" />
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-11 flex-1" />
                        <Skeleton className="h-11 flex-1" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : filteredPlayers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum jogador encontrado
                </div>
              ) : (
                filteredPlayers.map((player) => {
                  const isEditing = editingPlayerId === player.id;
                  const editData = isEditing && editingPlayerData ? editingPlayerData : player;

                  return (
                    <Card key={player.id} className="border-border">
                      <CardContent className="p-4">
                        {/* Cabeçalho */}
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h3 className="font-bold text-base">
                              {player.nickname || player.first_name || player.name}
                            </h3>
                            <p className="text-sm text-muted-foreground truncate">
                              {player.email || "-"}
                            </p>
                          </div>
                          {!isEditing && (
                            <Badge className={statusColors[player.status || "pendente"]}>
                              {statusLabels[player.status || "pendente"]}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Campos - Modo Visualização ou Edição */}
                        {!isEditing ? (
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
                        ) : (
                          <div className="space-y-3 mb-3">
                            {/* Apelido */}
                            <div className="space-y-1">
                              <Label htmlFor={`nickname-${player.id}`} className="text-xs text-muted-foreground">
                                Apelido
                              </Label>
                              <Input
                                id={`nickname-${player.id}`}
                                value={editData.nickname || ""}
                                onChange={(e) => setEditingPlayerData(prev => prev ? { ...prev, nickname: e.target.value } : null)}
                                className="h-11 text-base"
                              />
                            </div>

                            {/* Nível */}
                            <div className="space-y-1">
                              <Label htmlFor={`level-${player.id}`} className="text-xs text-muted-foreground">
                                Nível
                              </Label>
                              <Select
                                value={editData.level || ""}
                                onValueChange={(value) => setEditingPlayerData(prev => prev ? { ...prev, level: value } : null)}
                              >
                                <SelectTrigger id={`level-${player.id}`} className="h-11 text-base">
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
                            <div className="space-y-1">
                              <Label htmlFor={`position-${player.id}`} className="text-xs text-muted-foreground">
                                Posição
                              </Label>
                              <Select
                                value={editData.position || ""}
                                onValueChange={(value) => setEditingPlayerData(prev => prev ? { ...prev, position: value } : null)}
                              >
                                <SelectTrigger id={`position-${player.id}`} className="h-11 text-base">
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

                            {/* Status */}
                            <div className="space-y-1">
                              <Label htmlFor={`status-${player.id}`} className="text-xs text-muted-foreground">
                                Status
                              </Label>
                              <Select
                                value={editData.status || "pendente"}
                                onValueChange={(value) => setEditingPlayerData(prev => prev ? { ...prev, status: value } : null)}
                              >
                                <SelectTrigger id={`status-${player.id}`} className="h-11 text-base">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pendente">Pendente</SelectItem>
                                  <SelectItem value="aprovado">Aprovado</SelectItem>
                                  <SelectItem value="congelado">Congelado</SelectItem>
                                  <SelectItem value="rejeitado">Rejeitado</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                        
                        {/* Botões */}
                        <div className="flex gap-2 flex-wrap">
                          {!isEditing ? (
                            <>
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
                                variant="outline"
                                onClick={() => handleEditPlayer(player)}
                                className={`min-h-[44px] ${player.status === "pendente" ? "w-full" : "flex-1"}`}
                              >
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deletePlayer(player.id, player.name, player.email)}
                                className={`min-h-[44px] ${player.status === "pendente" ? "w-full" : "flex-1"}`}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Excluir
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={handleSaveEdit}
                                className="flex-1 min-h-[44px] bg-primary hover:bg-primary/90"
                              >
                                Salvar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                                className="flex-1 min-h-[44px]"
                              >
                                Cancelar
                              </Button>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
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
