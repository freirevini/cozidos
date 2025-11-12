import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import { Trash2, Upload, HelpCircle, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import * as XLSX from "xlsx";
import Papa from "papaparse";

interface PlayerRanking {
  id: string;
  player_id: string;
  nickname: string;
  email: string | null;
  gols: number;
  assistencias: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  presencas: number;
  faltas: number;
  atrasos: number;
  punicoes: number;
  cartoes_amarelos: number;
  cartoes_azuis: number;
  pontos_totais: number;
}

interface EditedRanking {
  id: string;
  changes: Partial<PlayerRanking>;
}

const ManageRanking = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [rankings, setRankings] = useState<PlayerRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [editedRankings, setEditedRankings] = useState<Map<string, Partial<PlayerRanking>>>(new Map());
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
      toast({
        title: "Acesso negado",
        description: "Acesso restrito a administradores.",
        variant: "destructive",
      });
    } else {
      loadRankings();
    }
  }, [isAdmin, navigate]);

  const loadRankings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("player_rankings")
        .select("*")
        .order("pontos_totais", { ascending: false });

      if (error) throw error;
      setRankings(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar classificação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateRankingField = (id: string, field: keyof PlayerRanking, value: number | string) => {
    // Atualizar estado local
    setRankings((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );

    // Rastrear mudanças
    setEditedRankings((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(id) || {};
      newMap.set(id, { ...existing, [field]: value });
      return newMap;
    });
  };

  const saveChanges = async () => {
    if (editedRankings.size === 0) {
      toast({
        title: "Nenhuma alteração",
        description: "Não há alterações para salvar.",
      });
      return;
    }

    setSaving(true);
    try {
      // Pegar dados completos dos rankings editados
      const updates = Array.from(editedRankings.entries()).map(([id, changes]) => {
        const currentRanking = rankings.find(r => r.id === id);
        return {
          id,
          player_id: currentRanking?.player_id || "",
          nickname: currentRanking?.nickname || "",
          email: currentRanking?.email,
          ...changes,
        };
      });

      const { error } = await supabase
        .from("player_rankings")
        .upsert(updates, { onConflict: 'id' });

      if (error) throw error;

      setEditedRankings(new Map());
      await loadRankings(); // Recarregar para ordenar por pontos

      toast({
        title: "Alterações salvas",
        description: `${updates.length} registro(s) atualizado(s) com sucesso.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteRanking = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este jogador da classificação?")) return;

    try {
      const { error } = await supabase
        .from("player_rankings")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setRankings((prev) => prev.filter((r) => r.id !== id));
      toast({
        title: "Removido com sucesso",
        description: "Jogador removido da classificação.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteAllRankings = async () => {
    try {
      const { error } = await supabase.rpc('reset_all_data');

      if (error) throw error;

      setRankings([]);
      toast({
        title: "Reset completo realizado",
        description: "Todos os dados do sistema foram removidos.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao apagar tudo",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetRankings = async () => {
    setResetting(true);
    try {
      const { data, error } = await supabase.rpc('reset_player_rankings');
      
      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; message?: string };
      if (result?.success === false) throw new Error(result.error);
      
      setRankings([]);
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao resetar classificação",
        description: error.message,
        variant: "destructive",
      });
      return false;
    } finally {
      setResetting(false);
    }
  };

  const resetOnly = async () => {
    const success = await resetRankings();
    if (success) {
      toast({
        title: "Classificação resetada",
        description: "Todos os dados foram removidos. A classificação está zerada.",
      });
    }
  };

  const resetAndRecalculate = async () => {
    setResetting(true);
    
    const resetSuccess = await resetRankings();
    if (!resetSuccess) return;
    
    toast({
      title: "Classificação resetada",
      description: "Iniciando recálculo automático...",
    });
    
    setRecalculating(true);
    try {
      const { data, error } = await supabase.rpc('recalc_all_player_rankings');
      
      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; message?: string };
      if (result?.success === false) throw new Error(result.error);
      
      await loadRankings();
      
      toast({
        title: "Concluído!",
        description: "Classificação resetada e recalculada com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao recalcular pontos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRecalculating(false);
    }
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
        toast({
          title: "Formato inválido",
          description: "Use arquivos .csv, .xlsx ou .xls",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao importar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const processImportedData = async (data: any[]) => {
    // Validar se a coluna Email existe
    if (data.length > 0) {
      const firstRow = data[0];
      const hasEmailColumn = "Email" in firstRow || "email" in firstRow;
      if (!hasEmailColumn) {
        toast({
          title: "Coluna obrigatória ausente",
          description: "A coluna 'Email' é obrigatória para importação de classificação.",
          variant: "destructive",
        });
        return;
      }
    }

    const upserts: any[] = [];
    const invalidRows: string[] = [];
    let updated = 0;
    let created = 0;

    for (const row of data) {
      const email = (row["Email"] || row["email"])?.toString().toLowerCase().trim();
      const nickname = row["Apelido"] || row["apelido"];
      
      if (!email) {
        invalidRows.push(nickname || "Linha sem e-mail");
        continue;
      }

      const rankingData = {
        email: email, // já normalizado acima
        nickname: nickname || email.split("@")[0],
        gols: parseInt(row["Gols"] || row["gols"]) || 0,
        assistencias: parseInt(row["Assistências"] || row["assistencias"]) || 0,
        vitorias: parseInt(row["Vitórias"] || row["vitorias"]) || 0,
        empates: parseInt(row["Empates"] || row["empates"]) || 0,
        derrotas: parseInt(row["Derrotas"] || row["derrotas"]) || 0,
        presencas: parseInt(row["Presenças"] || row["presencas"]) || 0,
        faltas: parseInt(row["Faltas"] || row["faltas"]) || 0,
        atrasos: parseInt(row["Atrasos"] || row["atrasos"]) || 0,
        punicoes: parseInt(row["Punições"] || row["punicoes"]) || 0,
        cartoes_amarelos: parseInt(row["Cartões Amarelos"] || row["cartoes_amarelos"]) || 0,
        cartoes_azuis: parseInt(row["Cartões Azuis"] || row["cartoes_azuis"]) || 0,
        pontos_totais: parseInt(row["Pontos Totais"] || row["pontos_totais"]) || 0,
      };

      // Check if email exists in player_rankings
      const { data: existingRanking } = await supabase
        .from("player_rankings")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingRanking) {
        updated++;
      } else {
        created++;
        
        // Check if profile exists, if not create it
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        if (!existingProfile) {
          await supabase.from("profiles").insert({
            id: crypto.randomUUID(),
            email: email,
            name: nickname || email.split("@")[0],
            nickname: nickname,
            is_player: true,
            player_type: "avulso",
            status: "aprovado",
            user_id: null,
          });
        }
      }

      upserts.push(rankingData);
    }

    if (upserts.length > 0) {
      try {
        const { error } = await supabase
          .from("player_rankings")
          .upsert(upserts, { 
            onConflict: 'email',
            ignoreDuplicates: false 
          });

        if (error) throw error;

        let message = `${updated} atualizado(s), ${created} novo(s) criado(s)`;
        if (invalidRows.length > 0) {
          message += `, ${invalidRows.length} linha(s) ignorada(s)`;
        }

        toast({
          title: "Importação concluída",
          description: message,
        });

        loadRankings();
      } catch (error: any) {
        toast({
          title: "Erro ao processar importação",
          description: error.message,
          variant: "destructive",
        });
      }
    }

    if (invalidRows.length > 0 && upserts.length === 0) {
      toast({
        title: "Nenhum dado válido",
        description: `${invalidRows.length} linha(s) sem e-mail foram ignoradas`,
        variant: "destructive",
      });
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card className="bg-card/50 border-primary/20">
            <CardHeader>
              <CardTitle className="text-primary">Acesso Restrito</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Acesso restrito a administradores.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <Card className="bg-card/50 border-primary/20 shadow-card-glow">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-primary text-2xl">
              Gerenciar Classificação Geral
            </CardTitle>
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Resetar Classificação
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-destructive">
                      ⚠️ Resetar Classificação Geral
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação irá <strong>deletar todos os registros</strong> da tabela de classificação.
                      <br/><br/>
                      <strong>O que será deletado:</strong>
                      <ul className="list-disc ml-6 mt-2">
                        <li>Todos os pontos, gols, assistências da classificação geral</li>
                        <li>Estatísticas acumuladas de todos os jogadores</li>
                      </ul>
                      <br/>
                      <strong className="text-primary">O que NÃO será afetado:</strong>
                      <ul className="list-disc ml-6 mt-2">
                        <li>Rodadas finalizadas</li>
                        <li>Partidas e seus resultados</li>
                        <li>Gols, assistências e cartões registrados nas partidas</li>
                        <li>Cadastro de jogadores</li>
                      </ul>
                      <br/>
                      <strong>O que você deseja fazer?</strong>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={resetOnly}
                      className="bg-orange-600 hover:bg-orange-700"
                      disabled={resetting || recalculating}
                    >
                      {resetting ? "Resetando..." : "Apenas Resetar (deixar zerado)"}
                    </AlertDialogAction>
                    <AlertDialogAction
                      onClick={resetAndRecalculate}
                      className="bg-primary hover:bg-primary/90"
                      disabled={resetting || recalculating}
                    >
                      {resetting || recalculating ? "Processando..." : "Resetar e Recalcular"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button
                variant="default"
                size="sm"
                onClick={saveChanges}
                disabled={saving || editedRankings.size === 0}
              >
                {saving ? "Salvando..." : `Salvar Alterações${editedRankings.size > 0 ? ` (${editedRankings.size})` : ""}`}
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-primary/20">
                  <DialogHeader>
                    <DialogTitle className="text-primary">
                      Como montar o arquivo Excel para importação
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground space-y-2">
                      <p className="font-semibold">
                        1. O arquivo deve conter as colunas abaixo (com os nomes exatamente iguais):
                      </p>
                      <p className="ml-4 font-mono text-xs">
                        Email | Apelido | Gols | Assistências | Vitórias | Empates | Derrotas | Presenças | Faltas | Atrasos | Punições | Cartões Amarelos | Cartões Azuis | Pontos Totais
                      </p>
                      <p>2. <strong>Email é obrigatório</strong> e é a chave de atualização/criação.</p>
                      <p>3. Todas as demais colunas devem conter apenas números, exceto Email e Apelido.</p>
                      <p>4. Se o e-mail já existir, os dados serão atualizados. Se não existir, um novo jogador será criado.</p>
                      <p>5. Linhas sem e-mail serão ignoradas e listadas no relatório.</p>
                      <p>6. Nenhum dado de rodadas será incluído — a atualização é apenas da classificação geral.</p>
                    </DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                className="border-primary/20 hover:bg-primary/10"
                onClick={() => document.getElementById("file-input")?.click()}
                disabled={importing}
              >
                <Upload className="mr-2 h-4 w-4" />
                {importing ? "Importando..." : "Importar Arquivo"}
              </Button>
              <input
                id="file-input"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileImport}
                className="hidden"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando...
              </div>
            ) : rankings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma classificação cadastrada
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-primary/20">
                      <TableHead className="text-primary">Pos.</TableHead>
                      <TableHead className="text-primary">Apelido</TableHead>
                      <TableHead className="text-primary">E-mail</TableHead>
                      <TableHead className="text-primary text-center">Gols</TableHead>
                      <TableHead className="text-primary text-center">Assist.</TableHead>
                      <TableHead className="text-primary text-center">V</TableHead>
                      <TableHead className="text-primary text-center">E</TableHead>
                      <TableHead className="text-primary text-center">D</TableHead>
                      <TableHead className="text-primary text-center">Pres.</TableHead>
                      <TableHead className="text-primary text-center">Faltas</TableHead>
                      <TableHead className="text-primary text-center">Atrasos</TableHead>
                      <TableHead className="text-primary text-center">Pun.</TableHead>
                      <TableHead className="text-primary text-center">CA</TableHead>
                      <TableHead className="text-primary text-center">CAz</TableHead>
                      <TableHead className="text-primary text-center font-bold">Pontos</TableHead>
                      <TableHead className="text-primary text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankings.map((ranking, index) => (
                      <TableRow key={ranking.id} className="border-primary/20">
                        <TableCell className="font-medium">{index + 1}º</TableCell>
                        <TableCell>{ranking.nickname}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{ranking.email || "-"}</TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={ranking.gols}
                            onChange={(e) =>
                              updateRankingField(ranking.id, "gols", parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-center bg-background/50 border-primary/20"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={ranking.assistencias}
                            onChange={(e) =>
                              updateRankingField(ranking.id, "assistencias", parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-center bg-background/50 border-primary/20"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={ranking.vitorias}
                            onChange={(e) =>
                              updateRankingField(ranking.id, "vitorias", parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-center bg-background/50 border-primary/20"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={ranking.empates}
                            onChange={(e) =>
                              updateRankingField(ranking.id, "empates", parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-center bg-background/50 border-primary/20"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={ranking.derrotas}
                            onChange={(e) =>
                              updateRankingField(ranking.id, "derrotas", parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-center bg-background/50 border-primary/20"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={ranking.presencas}
                            onChange={(e) =>
                              updateRankingField(ranking.id, "presencas", parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-center bg-background/50 border-primary/20"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={ranking.faltas}
                            onChange={(e) =>
                              updateRankingField(ranking.id, "faltas", parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-center bg-background/50 border-primary/20"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={ranking.atrasos}
                            onChange={(e) =>
                              updateRankingField(ranking.id, "atrasos", parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-center bg-background/50 border-primary/20"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={ranking.punicoes}
                            onChange={(e) =>
                              updateRankingField(ranking.id, "punicoes", parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-center bg-background/50 border-primary/20"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={ranking.cartoes_amarelos}
                            onChange={(e) =>
                              updateRankingField(ranking.id, "cartoes_amarelos", parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-center bg-background/50 border-primary/20"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={ranking.cartoes_azuis}
                            onChange={(e) =>
                              updateRankingField(ranking.id, "cartoes_azuis", parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-center bg-background/50 border-primary/20"
                          />
                        </TableCell>
                        <TableCell className="text-center font-bold text-primary">
                          <Input
                            type="number"
                            value={ranking.pontos_totais}
                            onChange={(e) =>
                              updateRankingField(ranking.id, "pontos_totais", parseInt(e.target.value) || 0)
                            }
                            className="w-20 text-center bg-background/50 border-primary/20 font-bold"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => deleteRanking(ranking.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default ManageRanking;
