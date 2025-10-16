import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, UserPlus, Info, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast as sonnerToast } from "sonner";
import PunishmentDialog from "@/components/PunishmentDialog";

interface Player {
  id: string;
  name: string;
  nickname: string | null;
  email: string | null;
  birth_date: string | null;
  is_player: boolean;
  player_type: string | null;
  level: string | null;
  position: string | null;
  is_approved: boolean;
  status: string | null;
  user_id: string | null;
}

const positionMap: Record<string, string> = {
  goleiro: "Goleiro",
  defensor: "Defensor",
  "meio-campista": "Meio-campista",
  atacante: "Atacante",
};

const levelMap: Record<string, string> = {
  A: "A",
  B: "B",
  C: "C",
  D: "D",
  E: "E",
};

export default function ManagePlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [punishmentDialog, setPunishmentDialog] = useState<{ open: boolean; playerId: string; playerName: string }>({
    open: false,
    playerId: "",
    playerName: "",
  });
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newPlayer, setNewPlayer] = useState({
    name: "",
    nickname: "",
    level: "",
    position: "",
    email: "",
  });

  // Deletion states
  const [deletingAll, setDeletingAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

      sonnerToast.success("Jogador atualizado com sucesso!");
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deletePlayer = async (playerId: string, playerEmail: string | null) => {
    const normalizedEmail = (playerEmail || "").trim().toLowerCase();
    setDeletingId(playerId);
    try {
      let rpcError = null as any;

      if (normalizedEmail) {
        const { error } = await supabase.rpc('delete_player_by_email', { player_email: normalizedEmail });
        rpcError = error;
      } else {
        rpcError = new Error('no-email');
      }

      // Fallback: if email not found or missing, delete by profile id
      if (rpcError && (rpcError.message?.toLowerCase().includes('jogador não encontrado') || rpcError.message === 'no-email')) {
        const { error: byIdError } = await supabase.rpc('delete_player_by_id', { profile_id: playerId });
        if (byIdError) throw byIdError;
      } else if (rpcError) {
        throw rpcError;
      }

      setPlayers(players.filter(p => p.id !== playerId));
      sonnerToast.success("Jogador e todos os dados relacionados removidos com sucesso!");
    } catch (error: any) {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const deleteAllPlayers = async () => {
    setDeletingAll(true);
    try {
      const { error } = await supabase.rpc('reset_all_data');

      if (error) throw error;

      setPlayers([]);
      sonnerToast.success("Todos os dados do sistema foram removidos com sucesso!");
    } catch (error: any) {
      toast({
        title: "Erro ao apagar tudo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeletingAll(false);
    }
  };

  const handleAddPlayer = async () => {
    if (!newPlayer.name || !newPlayer.nickname || !newPlayer.level || !newPlayer.position || !newPlayer.email) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios: Nome Completo, Apelido, E-mail, Nível e Posição.",
        variant: "destructive",
      });
      return;
    }

    try {
      const playerData: Database['public']['Tables']['profiles']['Insert'] = {
        id: crypto.randomUUID(),
        name: newPlayer.name,
        nickname: newPlayer.nickname,
        email: newPlayer.email.toLowerCase().trim(), // Normalizar email
        level: newPlayer.level as Database['public']['Enums']['player_level'],
        position: newPlayer.position as Database['public']['Enums']['player_position'],
        is_player: true,
        player_type: "avulso",
        status: "aprovado",
        user_id: null,
      };

      const { error } = await supabase
        .from("profiles")
        .insert(playerData);

      if (error) throw error;

      sonnerToast.success("Jogador cadastrado com sucesso!");
      setOpenAddDialog(false);
      setNewPlayer({ name: "", nickname: "", level: "", position: "", email: "" });
      loadPlayers();
    } catch (error: any) {
      toast({
        title: "Erro ao cadastrar jogador",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'csv') {
        Papa.parse(file, {
          header: true,
          complete: async (results) => {
            await processImportedData(results.data);
          },
          error: (error) => {
            throw new Error(error.message);
          }
        });
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          await processImportedData(jsonData);
        };
        reader.readAsArrayBuffer(file);
      } else {
        throw new Error("Formato de arquivo não suportado. Use CSV ou Excel (.xlsx, .xls)");
      }
    } catch (error: any) {
      toast({
        title: "Erro ao importar arquivo",
        description: error.message,
        variant: "destructive",
      });
      setImporting(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const processImportedData = async (data: any[]) => {
    try {
      const validRows = data.filter((row: any) => 
        row["Nome Completo"] && row["Apelido"] && row["Email"] && row["Nivel"] && row["Posicao"]
      );
      
      const invalidRows = data.filter((row: any) => 
        !row["Email"] || !row["Nome Completo"] || !row["Apelido"]
      );

      const playersToUpsert: Database['public']['Tables']['profiles']['Insert'][] = validRows.map((row: any) => {
          const levelKey = row["Nivel"]?.toString().toUpperCase() as Database['public']['Enums']['player_level'];
          const rawPos = row["Posicao"]?.toString().toLowerCase().trim().replace(/_/g, ' ');
          let positionKey = rawPos;
          if (["meio campista", "meio campo", "meio-campo", "meio-campista", "meia"].includes(rawPos)) {
            positionKey = "meio-campista";
          } else if (["defensor", "zagueiro", "defesa"].includes(rawPos)) {
            positionKey = "defensor";
          } else if (["goleiro"].includes(rawPos)) {
            positionKey = "goleiro";
          } else if (["atacante"].includes(rawPos)) {
            positionKey = "atacante";
          }
          const positionValue = positionKey as Database['public']['Enums']['player_position'];
          
          return {
            id: crypto.randomUUID(),
            name: row["Nome Completo"],
            nickname: row["Apelido"],
            email: row["Email"]?.toString().toLowerCase().trim(), // Normalizar email
            level: levelKey,
            position: positionValue,
            is_player: true,
            player_type: "avulso",
            status: "aprovado",
            user_id: null,
          };
        });

      if (playersToUpsert.length === 0) {
        throw new Error("Nenhum jogador válido encontrado no arquivo");
      }

      const { error } = await supabase
        .from("profiles")
        .upsert(playersToUpsert, { 
          onConflict: 'email',
          ignoreDuplicates: false 
        });

      if (error) throw error;

      let message = `${playersToUpsert.length} jogador(es) processado(s) com sucesso!`;
      if (invalidRows.length > 0) {
        message += ` ${invalidRows.length} linha(s) ignorada(s) por falta de e-mail.`;
      }
      
      sonnerToast.success(message);
      loadPlayers();
    } catch (error: any) {
      toast({
        title: "Erro ao processar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="text-3xl font-bold text-primary glow-text">
                Gerenciar Jogadores
              </CardTitle>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileImport}
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                />
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Info className="h-5 w-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Como importar a planilha de jogadores</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold text-lg mb-2">Formatos Aceitos</h3>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li>CSV (.csv)</li>
                          <li>Excel (.xlsx, .xls)</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h3 className="font-semibold text-lg mb-2">Colunas da Planilha</h3>
                        <div className="bg-muted p-4 rounded-md">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 px-2">Coluna</th>
                                <th className="text-left py-2 px-2">Obrigatória</th>
                                <th className="text-left py-2 px-2">Valores Aceitos</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b">
                                <td className="py-2 px-2 font-mono">Nome Completo</td>
                                <td className="py-2 px-2">
                                  <Badge className="bg-red-600">Sim</Badge>
                                </td>
                                <td className="py-2 px-2">Texto livre</td>
                              </tr>
                              <tr className="border-b">
                                <td className="py-2 px-2 font-mono">Apelido</td>
                                <td className="py-2 px-2">
                                  <Badge className="bg-red-600">Sim</Badge>
                                </td>
                                <td className="py-2 px-2">Texto livre</td>
                              </tr>
                              <tr className="border-b">
                                <td className="py-2 px-2 font-mono">Email</td>
                                <td className="py-2 px-2">
                                  <Badge className="bg-red-600">Sim</Badge>
                                </td>
                                <td className="py-2 px-2">E-mail válido (chave única)</td>
                              </tr>
                              <tr className="border-b">
                                <td className="py-2 px-2 font-mono">Nivel</td>
                                <td className="py-2 px-2">
                                  <Badge className="bg-red-600">Sim</Badge>
                                </td>
                                <td className="py-2 px-2">
                                  <code className="bg-background px-1 rounded">A</code>,{" "}
                                  <code className="bg-background px-1 rounded">B</code>,{" "}
                                  <code className="bg-background px-1 rounded">C</code>,{" "}
                                  <code className="bg-background px-1 rounded">D</code>,{" "}
                                  <code className="bg-background px-1 rounded">E</code>
                                  <span className="text-xs text-muted-foreground ml-2">(letras maiúsculas)</span>
                                </td>
                              </tr>
                              <tr>
                                <td className="py-2 px-2 font-mono">Posicao</td>
                                <td className="py-2 px-2">
                                  <Badge className="bg-red-600">Sim</Badge>
                                </td>
                                <td className="py-2 px-2">
                                  <code className="bg-background px-1 rounded">goleiro</code>,{" "}
                                  <code className="bg-background px-1 rounded">defensor</code>,{" "}
                                  <code className="bg-background px-1 rounded">meio-campista</code>,{" "}
                                  <code className="bg-background px-1 rounded">atacante</code>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold text-lg mb-2">Exemplo de Planilha</h3>
                        <div className="bg-muted p-4 rounded-md overflow-x-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 px-3 bg-primary/10">Nome Completo</th>
                                <th className="text-left py-2 px-3 bg-primary/10">Apelido</th>
                                <th className="text-left py-2 px-3 bg-primary/10">Email</th>
                                <th className="text-left py-2 px-3 bg-primary/10">Nivel</th>
                                <th className="text-left py-2 px-3 bg-primary/10">Posicao</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b">
                                <td className="py-2 px-3">João Silva Santos</td>
                                <td className="py-2 px-3">João</td>
                                <td className="py-2 px-3">joao@email.com</td>
                                <td className="py-2 px-3">A</td>
                                <td className="py-2 px-3">atacante</td>
                              </tr>
                              <tr className="border-b">
                                <td className="py-2 px-3">Pedro Costa Lima</td>
                                <td className="py-2 px-3">Pedrinho</td>
                                <td className="py-2 px-3">pedro@email.com</td>
                                <td className="py-2 px-3">B</td>
                                <td className="py-2 px-3">meio-campista</td>
                              </tr>
                              <tr>
                                <td className="py-2 px-3">Carlos Eduardo</td>
                                <td className="py-2 px-3">Carlão</td>
                                <td className="py-2 px-3">carlos@email.com</td>
                                <td className="py-2 px-3">C</td>
                                <td className="py-2 px-3">goleiro</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-md border border-blue-200 dark:border-blue-900">
                        <p className="text-sm">
                          <strong>⚠️ Importante:</strong> Certifique-se de que os nomes das colunas estejam exatamente como especificado acima (incluindo maiúsculas e minúsculas). Linhas com campos obrigatórios vazios serão ignoradas.
                        </p>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  variant="outline"
                  className="flex-1 sm:flex-none"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {importing ? "Importando..." : "Importar Arquivo"}
                </Button>
                <Dialog open={openAddDialog} onOpenChange={setOpenAddDialog}>
                  <DialogTrigger asChild>
                    <Button className="flex-1 sm:flex-none">
                      <UserPlus className="mr-2 h-4 w-4" />
                      Cadastrar Jogador
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cadastrar Novo Jogador</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name">Nome Completo *</Label>
                        <Input
                          id="name"
                          value={newPlayer.name}
                          onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                          placeholder="João Silva"
                        />
                      </div>
                      <div>
                        <Label htmlFor="nickname">Apelido *</Label>
                        <Input
                          id="nickname"
                          value={newPlayer.nickname}
                          onChange={(e) => setNewPlayer({ ...newPlayer, nickname: e.target.value })}
                          placeholder="João"
                        />
                      </div>
                      <div>
                        <Label htmlFor="level">Nível *</Label>
                        <Select
                          value={newPlayer.level}
                          onValueChange={(value) => setNewPlayer({ ...newPlayer, level: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o nível" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(levelMap).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="position">Posição *</Label>
                        <Select
                          value={newPlayer.position}
                          onValueChange={(value) => setNewPlayer({ ...newPlayer, position: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a posição" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(positionMap).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="email">E-mail *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newPlayer.email}
                          onChange={(e) => setNewPlayer({ ...newPlayer, email: e.target.value })}
                          placeholder="joao@email.com"
                          required
                        />
                      </div>
                      <Button onClick={handleAddPlayer} className="w-full">
                        Cadastrar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
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
                      <TableHead>E-mail</TableHead>
                      <TableHead>Idade</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Nível</TableHead>
                      <TableHead>Posição</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Punição</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {players.map((player) => {
                      const isEditing = editingPlayer === player.id;
                      return (
                        <TableRow key={player.id}>
                          <TableCell>
                            {isEditing ? (
                              <Input
                                value={player.name}
                                onChange={(e) => {
                                  setPlayers(players.map(p => 
                                    p.id === player.id ? { ...p, name: e.target.value } : p
                                  ));
                                }}
                                className="min-w-[150px]"
                              />
                            ) : (
                              player.name
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Input
                                value={player.nickname || ""}
                                onChange={(e) => {
                                  setPlayers(players.map(p => 
                                    p.id === player.id ? { ...p, nickname: e.target.value } : p
                                  ));
                                }}
                                className="min-w-[120px]"
                              />
                            ) : (
                              player.nickname || "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <Input
                                type="email"
                                value={player.email || ""}
                                onChange={(e) => {
                                  setPlayers(players.map(p => 
                                    p.id === player.id ? { ...p, email: e.target.value } : p
                                  ));
                                }}
                                className="min-w-[180px]"
                                required
                              />
                            ) : (
                              player.email || "-"
                            )}
                          </TableCell>
                          <TableCell>{calculateAge(player.birth_date)}</TableCell>
                          <TableCell>
                            <Select
                              value={player.player_type || "avulso"}
                              onValueChange={(value) => updatePlayer(player.id, "player_type", value)}
                              disabled={!isEditing}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="Tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="mensal">Mensal</SelectItem>
                                <SelectItem value="avulso_fixo">Avulso Fixo</SelectItem>
                                <SelectItem value="avulso">Avulso</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={player.level || ""}
                              onValueChange={(value) => updatePlayer(player.id, "level", value)}
                              disabled={!isEditing}
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
                              disabled={!isEditing}
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
                            <Select
                              value={player.status || "aprovar"}
                              onValueChange={(value) => updatePlayer(player.id, "status", value)}
                              disabled={!isEditing}
                            >
                              <SelectTrigger className={`w-32 ${
                                player.status === "aprovado" ? "border-green-600" : 
                                player.status === "aprovar" ? "border-yellow-600" : 
                                "border-gray-600"
                              }`}>
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="aprovado">
                                  <span className="text-green-600">Aprovado</span>
                                </SelectItem>
                                <SelectItem value="aprovar">
                                  <span className="text-yellow-600">Aprovar</span>
                                </SelectItem>
                                <SelectItem value="congelado">
                                  <span className="text-gray-600">Congelado</span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPunishmentDialog({
                                open: true,
                                playerId: player.id,
                                playerName: player.nickname || player.name,
                              })}
                            >
                              Gerenciar
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2 flex-wrap">
                              {isEditing ? (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    updatePlayer(player.id, "name", player.name);
                                    updatePlayer(player.id, "nickname", player.nickname);
                                    setEditingPlayer(null);
                                  }}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  Salvar
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => setEditingPlayer(player.id)}
                                  variant="outline"
                                >
                                  Editar
                                </Button>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Remover
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja remover {player.nickname || player.name} e todos os seus dados relacionados (gols, assistências, cartões, estatísticas)?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => deletePlayer(player.id, player.email)}
                                      disabled={deletingId === player.id}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      {deletingId === player.id ? 'Removendo...' : 'Sim, remover'}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <PunishmentDialog
        playerId={punishmentDialog.playerId}
        playerName={punishmentDialog.playerName}
        open={punishmentDialog.open}
        onOpenChange={(open) => setPunishmentDialog({ ...punishmentDialog, open })}
      />
    </div>
  );
}