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
import { Upload, UserPlus, Info } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast as sonnerToast } from "sonner";

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
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newPlayer, setNewPlayer] = useState({
    name: "",
    nickname: "",
    level: "",
    position: "",
    email: "",
  });

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

  const handleAddPlayer = async () => {
    if (!newPlayer.name || !newPlayer.nickname || !newPlayer.level || !newPlayer.position) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios: Nome Completo, Apelido, Nível e Posição.",
        variant: "destructive",
      });
      return;
    }

    try {
      const playerData: Database['public']['Tables']['profiles']['Insert'] = {
        id: crypto.randomUUID(),
        name: newPlayer.name,
        nickname: newPlayer.nickname,
        level: newPlayer.level as Database['public']['Enums']['player_level'],
        position: newPlayer.position as Database['public']['Enums']['player_position'],
        is_player: true,
        is_approved: true,
        player_type: "avulso",
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
      const playersToInsert: Database['public']['Tables']['profiles']['Insert'][] = data
        .filter((row: any) => row["Nome Completo"] && row["Apelido"] && row["Nivel"] && row["Posicao"])
        .map((row: any) => {
          const levelKey = row["Nivel"]?.toString().toUpperCase() as Database['public']['Enums']['player_level'];
          const positionValue = row["Posicao"]?.toString().toLowerCase().replace(/\s+/g, '_') as Database['public']['Enums']['player_position'];
          
          return {
            id: crypto.randomUUID(),
            name: row["Nome Completo"],
            nickname: row["Apelido"],
            level: levelKey,
            position: positionValue,
            is_player: true,
            is_approved: true,
            player_type: "avulso",
          };
        });

      if (playersToInsert.length === 0) {
        throw new Error("Nenhum jogador válido encontrado no arquivo");
      }

      const { error } = await supabase
        .from("profiles")
        .insert(playersToInsert);

      if (error) throw error;

      sonnerToast.success(`${playersToInsert.length} jogador(es) importado(s) com sucesso!`);
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
              <div className="flex gap-2">
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
                                  <code className="bg-background px-1 rounded">meio campo</code>,{" "}
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
                                <th className="text-left py-2 px-3 bg-primary/10">Nivel</th>
                                <th className="text-left py-2 px-3 bg-primary/10">Posicao</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b">
                                <td className="py-2 px-3">João Silva Santos</td>
                                <td className="py-2 px-3">João</td>
                                <td className="py-2 px-3">A</td>
                                <td className="py-2 px-3">atacante</td>
                              </tr>
                              <tr className="border-b">
                                <td className="py-2 px-3">Pedro Costa Lima</td>
                                <td className="py-2 px-3">Pedrinho</td>
                                <td className="py-2 px-3">B</td>
                                <td className="py-2 px-3">meio campo</td>
                              </tr>
                              <tr>
                                <td className="py-2 px-3">Carlos Eduardo</td>
                                <td className="py-2 px-3">Carlão</td>
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
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {importing ? "Importando..." : "Importar Arquivo"}
                </Button>
                <Dialog open={openAddDialog} onOpenChange={setOpenAddDialog}>
                  <DialogTrigger asChild>
                    <Button>
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
                        <Label htmlFor="email">E-mail (opcional)</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newPlayer.email}
                          onChange={(e) => setNewPlayer({ ...newPlayer, email: e.target.value })}
                          placeholder="joao@email.com"
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