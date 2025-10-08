import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import { Trash2, Upload, HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import * as XLSX from "xlsx";
import Papa from "papaparse";

interface PlayerRanking {
  id: string;
  player_id: string;
  nickname: string;
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
  cartoes_vermelhos: number;
  pontos_totais: number;
}

const ManageRanking = () => {
  const [rankings, setRankings] = useState<PlayerRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkAdmin();
    loadRankings();
  }, []);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsAdmin(false);
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    setIsAdmin(roles?.some((r) => r.role === "admin") || false);
  };

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

  const updateRanking = async (id: string, field: keyof PlayerRanking, value: number) => {
    try {
      const { error } = await supabase
        .from("player_rankings")
        .update({ [field]: value })
        .eq("id", id);

      if (error) throw error;

      setRankings((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
      );

      toast({
        title: "Atualizado com sucesso",
        description: "Classificação atualizada.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
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
    const updates: any[] = [];
    const notFound: string[] = [];

    for (const row of data) {
      const nickname = row["Apelido"] || row["apelido"];
      if (!nickname) continue;

      const existing = rankings.find(
        (r) => r.nickname.toLowerCase() === nickname.toLowerCase()
      );

      if (!existing) {
        notFound.push(nickname);
        continue;
      }

      updates.push({
        id: existing.id,
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
        cartoes_vermelhos: parseInt(row["Cartões Vermelhos"] || row["cartoes_vermelhos"]) || 0,
        pontos_totais: parseInt(row["Pontos Totais"] || row["pontos_totais"]) || 0,
      });
    }

    if (updates.length > 0) {
      try {
        for (const update of updates) {
          await supabase
            .from("player_rankings")
            .update(update)
            .eq("id", update.id);
        }

        toast({
          title: "Classificação atualizada com sucesso",
          description: `${updates.length} jogador(es) atualizado(s).`,
        });

        loadRankings();
      } catch (error: any) {
        toast({
          title: "Erro ao atualizar",
          description: error.message,
          variant: "destructive",
        });
      }
    }

    if (notFound.length > 0) {
      toast({
        title: "Jogadores não encontrados",
        description: `Os seguintes jogadores não foram encontrados: ${notFound.join(", ")}`,
        variant: "destructive",
      });
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header isAdmin={isAdmin} />
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
      <Header isAdmin={isAdmin} />
      <div className="container mx-auto px-4 py-8">
        <Card className="bg-card/50 border-primary/20 shadow-card-glow">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-primary text-2xl">
              Gerenciar Classificação Geral
            </CardTitle>
            <div className="flex gap-2">
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
                      <p className="ml-4">
                        Apelido | Gols | Assistências | Vitórias | Empates | Derrotas | Presenças | Faltas | Atrasos | Punições | Cartões Amarelos | Cartões Vermelhos | Pontos Totais
                      </p>
                      <p>2. Todas as colunas devem conter apenas números, exceto Apelido.</p>
                      <p>3. Cada linha representa um jogador.</p>
                      <p>4. O sistema atualizará automaticamente os dados existentes conforme o apelido informado.</p>
                      <p>5. Nenhum dado de rodadas será incluído — a atualização é apenas da classificação geral.</p>
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
                      <TableHead className="text-primary text-center">CV</TableHead>
                      <TableHead className="text-primary text-center font-bold">Pontos</TableHead>
                      <TableHead className="text-primary text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankings.map((ranking, index) => (
                      <TableRow key={ranking.id} className="border-primary/20">
                        <TableCell className="font-medium">{index + 1}º</TableCell>
                        <TableCell>{ranking.nickname}</TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={ranking.gols}
                            onChange={(e) =>
                              updateRanking(ranking.id, "gols", parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-center bg-background/50 border-primary/20"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={ranking.assistencias}
                            onChange={(e) =>
                              updateRanking(ranking.id, "assistencias", parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-center bg-background/50 border-primary/20"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={ranking.vitorias}
                            onChange={(e) =>
                              updateRanking(ranking.id, "vitorias", parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-center bg-background/50 border-primary/20"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={ranking.empates}
                            onChange={(e) =>
                              updateRanking(ranking.id, "empates", parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-center bg-background/50 border-primary/20"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={ranking.derrotas}
                            onChange={(e) =>
                              updateRanking(ranking.id, "derrotas", parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-center bg-background/50 border-primary/20"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={ranking.presencas}
                            onChange={(e) =>
                              updateRanking(ranking.id, "presencas", parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-center bg-background/50 border-primary/20"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={ranking.faltas}
                            onChange={(e) =>
                              updateRanking(ranking.id, "faltas", parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-center bg-background/50 border-primary/20"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={ranking.atrasos}
                            onChange={(e) =>
                              updateRanking(ranking.id, "atrasos", parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-center bg-background/50 border-primary/20"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={ranking.punicoes}
                            onChange={(e) =>
                              updateRanking(ranking.id, "punicoes", parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-center bg-background/50 border-primary/20"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={ranking.cartoes_amarelos}
                            onChange={(e) =>
                              updateRanking(ranking.id, "cartoes_amarelos", parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-center bg-background/50 border-primary/20"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={ranking.cartoes_vermelhos}
                            onChange={(e) =>
                              updateRanking(ranking.id, "cartoes_vermelhos", parseInt(e.target.value) || 0)
                            }
                            className="w-16 text-center bg-background/50 border-primary/20"
                          />
                        </TableCell>
                        <TableCell className="text-center font-bold text-primary">
                          <Input
                            type="number"
                            value={ranking.pontos_totais}
                            onChange={(e) =>
                              updateRanking(ranking.id, "pontos_totais", parseInt(e.target.value) || 0)
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
