import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Upload, FileText, CheckCircle, XCircle, AlertTriangle, Users } from "lucide-react";
import {
  downloadTemplate,
  downloadCSV,
  validateClassificationImportRow,
  type ClassificationImportResult
} from "@/utils/csv";
import { supabase } from "@/integrations/supabase/client";

interface ImportClassificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (data: any[]) => Promise<ClassificationImportResult | null>;
}

export function ImportClassificationDialog({ open, onOpenChange, onImport }: ImportClassificationDialogProps) {
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [fullData, setFullData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [result, setResult] = useState<ClassificationImportResult | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setResult(null);
    setValidationErrors([]);
    setFullData([]);
    setPreviewData([]);

    try {
      // Fetch valid tokens
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('claim_token')
        .not('claim_token', 'is', null);

      if (profileError) throw profileError;

      const validTokens = new Set(profiles?.map(p => p.claim_token) || []);

      const text = await file.text();
      const Papa = (await import('papaparse')).default;

      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data as any[];

          // Store full data for import
          setFullData(data);
          // Store slice for preview
          setPreviewData(data.slice(0, 10));

          // Validate ALL rows
          const errors: string[] = [];
          data.forEach((row, idx) => {
            const validation = validateClassificationImportRow(row);
            if (!validation.valid) {
              errors.push(`Linha ${idx + 1}: ${validation.error}`);
            } else {
              const token = row.Token || row.token || row.ClaimToken || row.claim_token;
              if (token && !validTokens.has(token)) {
                errors.push(`Linha ${idx + 1}: Token '${token}' não encontrado no sistema.`);
              }
            }
          });

          setValidationErrors(errors);
        }
      });
    } catch (error) {
      setValidationErrors(['Erro ao ler arquivo']);
    }

    event.target.value = '';
  };

  const handleImport = async () => {
    if (fullData.length === 0) return;

    setImporting(true);
    try {
      // Send full data to import function
      const importResult = await onImport(fullData);
      setResult(importResult);
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadErrors = () => {
    if (!result?.errors) return;
    const csv = generateErrorsCSV(result.errors);
    downloadCSV(csv, `erros_classificacao_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleClose = () => {
    setPreviewData([]);
    setFullData([]);
    setValidationErrors([]);
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-primary flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Classificação
          </DialogTitle>
          <DialogDescription>
            Importe dados de classificação via CSV/Excel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
          <div className="bg-muted/30 rounded-lg p-4 border border-border">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Formato do arquivo
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex flex-col gap-1">
                <Badge className="bg-primary/20 text-primary w-fit">Campos Obrigatórios</Badge>
                <div className="flex flex-wrap gap-1">
                  <code className="bg-muted px-2 py-0.5 rounded">Nickname</code>
                  <code className="bg-muted px-2 py-0.5 rounded">Token</code>
                  <code className="bg-muted px-2 py-0.5 rounded">Level</code>
                  <code className="bg-muted px-2 py-0.5 rounded">Position</code>
                </div>
              </div>

              <div className="pl-4 border-l-2 border-border space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Estatísticas (opcionais):</p>
                <div className="flex flex-wrap gap-1 text-xs">
                  <code className="bg-muted px-1.5 py-0.5 rounded">Gols</code>
                  <code className="bg-muted px-1.5 py-0.5 rounded">Assistencias</code>
                  <code className="bg-muted px-1.5 py-0.5 rounded">Vitorias</code>
                  <code className="bg-muted px-1.5 py-0.5 rounded">Empates</code>
                  <code className="bg-muted px-1.5 py-0.5 rounded">Derrotas</code>
                  <code className="bg-muted px-1.5 py-0.5 rounded">Presencas</code>
                  <code className="bg-muted px-1.5 py-0.5 rounded">Pontos_Totais</code>
                  <code className="bg-muted px-1.5 py-0.5 rounded">Ano</code>
                </div>
              </div>
            </div>

            <div className="mt-3 bg-background rounded p-2 text-xs font-mono overflow-x-auto">
              Nickname,Token,Level,Position,Gols,Assistencias,Vitorias,Empates,Derrotas,Presencas,Pontos_Totais,Ano<br />
              felipe,ABC12345,A,atacante,10,4,6,2,2,8,20,2023<br />
              joesley,XYZ67890,B,meio-campista,8,6,5,3,2,8,18,2023
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadTemplate('classification')}
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar Template
              </Button>
            </div>
          </div>

          {/* Priority explanation */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Regra de Integração:</strong> A planilha serve apenas para atualizar dados.
              Tokens não encontrados serão rejeitados para evitar duplicidade ou perfis fantasmas.
            </AlertDescription>
          </Alert>

          {/* File Input */}
          {!result && (
            <div className="flex flex-col gap-2">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
              />
            </div>
          )}

          {/* Preview */}
          {previewData.length > 0 && !result && (
            <div className="space-y-2">
              <h4 className="font-medium">Preview (mostrando {previewData.length} de {fullData.length} linhas)</h4>
              <div className="max-h-40 overflow-x-auto border rounded-lg">
                <table className="w-full text-sm min-w-[600px]">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Nickname</th>
                      <th className="p-2 text-left">Token</th>
                      <th className="p-2 text-right">Gols</th>
                      <th className="p-2 text-right">Assist</th>
                      <th className="p-2 text-right">V</th>
                      <th className="p-2 text-right">E</th>
                      <th className="p-2 text-right">D</th>
                      <th className="p-2 text-right">Pres</th>
                      <th className="p-2 text-right">Pts</th>
                      <th className="p-2 text-right">Ano</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{row.Nickname || row.nickname || '-'}</td>
                        <td className="p-2 font-mono text-xs">{row.Token || row.token || '-'}</td>
                        <td className="p-2 text-right">{row.Gols || row.gols || 0}</td>
                        <td className="p-2 text-right">{row.Assistencias || row.assistencias || 0}</td>
                        <td className="p-2 text-right">{row.Vitorias || row.vitorias || 0}</td>
                        <td className="p-2 text-right">{row.Empates || row.empates || 0}</td>
                        <td className="p-2 text-right">{row.Derrotas || row.derrotas || 0}</td>
                        <td className="p-2 text-right">{row.Presencas || row.presencas || 0}</td>
                        <td className="p-2 text-right">{row.Pontos_Totais || row.pontos_totais || 0}</td>
                        <td className="p-2 text-right">{row.Ano || row.ano || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {validationErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc list-inside">
                      {validationErrors.slice(0, 5).map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                      {validationErrors.length > 5 && (
                        <li>...e mais {validationErrors.length - 5} erros</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              <Alert className={result.errors_count > 0 ? "border-yellow-500" : "border-green-500"}>
                {result.errors_count > 0 ? (
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Importação concluída!</p>
                    <ul className="text-sm">
                      <li className="text-green-600">✓ {result.rankings_created || 0} classificação(ões) criada(s)</li>
                      <li className="text-blue-600">↻ {result.rankings_updated || 0} classificação(ões) atualizada(s)</li>
                      {(result.profiles_created || 0) > 0 && (
                        <li className="text-purple-600 flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {result.profiles_created} perfil(s) criado(s)
                        </li>
                      )}
                      {result.errors_count > 0 && (
                        <li className="text-yellow-600">⚠ {result.errors_count} erro(s)</li>
                      )}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>

              {result.errors_count > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Erros encontrados:</h4>
                  <div className="max-h-32 overflow-y-auto border rounded-lg p-2 bg-destructive/10">
                    {result.errors.slice(0, 5).map((err, idx) => (
                      <div key={idx} className="text-sm py-1 border-b last:border-0">
                        <span className="font-mono text-xs bg-muted px-1 rounded">Linha {err.row}</span>
                        <span className="ml-2 text-destructive">{err.error}</span>
                      </div>
                    ))}
                    {result.errors.length > 5 && (
                      <p className="text-xs text-muted-foreground mt-1">...e mais {result.errors.length - 5} erros</p>
                    )}
                  </div>

                  <Button variant="outline" size="sm" onClick={handleDownloadErrors}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Baixar CSV com Erros
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            {result ? 'Fechar' : 'Cancelar'}
          </Button>
          {!result && previewData.length > 0 && (
            <Button onClick={handleImport} disabled={importing}>
              {importing ? 'Importando...' : 'Importar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
