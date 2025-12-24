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
import { Download, Upload, FileText, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import {
  downloadTemplate,
  downloadCSV,
  generateTokensCSV,
  generateErrorsCSV,
  validatePlayerImportRow,
  normalizePosition,
  type ImportResult
} from "@/utils/csv";

interface ImportPlayersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (data: any[]) => Promise<ImportResult | null>;
}

export function ImportPlayersDialog({ open, onOpenChange, onImport }: ImportPlayersDialogProps) {
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [fullData, setFullData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setResult(null);
    setValidationErrors([]);
    setFullData([]);
    setPreviewData([]);

    try {
      const text = await file.text();
      const Papa = (await import('papaparse')).default;

      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data as any[];

          // Normalize keys and sanitization (Strict Lowercase Keys for RPC)
          const normalizedData = data.map(row => {
            // 1. Identify values (Case insensitive lookup)
            const nicknameVal = row.Nickname || row.nickname || row.Apelido || row.apelido || '';
            const positionVal = row.Position || row.position || row.Posicao || row.posicao || '';
            const levelVal = row.Level || row.level || row.Nivel || row.nivel || '';
            const emailVal = row.Email || row.email || '';
            const nameVal = row.Name || row.name || row.Nome || row.nome || '';

            // 2. Return object with strict keys (LOWERCASE)
            return {
              nickname: nicknameVal.toString().trim(),
              name: nameVal.toString().trim() || nicknameVal.toString().trim(), // Fallback name = nickname
              email: emailVal.toString().trim(),
              level: levelVal.toString().toUpperCase().trim(),
              position: normalizePosition(positionVal) // Returns English Enum or 'midfielder' fallback
            };
          });

          setFullData(normalizedData);

          // Validate first 10 rows for preview (or all rows if possible, but keeping preview logic simple)
          const errors: string[] = [];
          normalizedData.forEach((row, idx) => {
            // Only validate preview or full? Better validate all to show errors
            const validation = validatePlayerImportRow(row);
            if (!validation.valid) {
              errors.push(`Linha ${idx + 1}: ${validation.error}`);
            }
          });

          setValidationErrors(errors);
          setPreviewData(normalizedData.slice(0, 10));
        }
      });
    } catch (error) {
      setValidationErrors(['Erro ao ler arquivo']);
    }

    event.target.value = '';
  };

  const handleImport = async () => {
    if (previewData.length === 0) return;

    setImporting(true);
    try {
      const importResult = await onImport(fullData);
      setResult(importResult);
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTokens = () => {
    if (!result?.results) return;
    const csv = generateTokensCSV(result.results);
    downloadCSV(csv, `tokens_gerados_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleDownloadErrors = () => {
    if (!result?.errors) return;
    const csv = generateErrorsCSV(result.errors);
    downloadCSV(csv, `erros_importacao_${new Date().toISOString().split('T')[0]}.csv`);
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
            Importar Jogadores
          </DialogTitle>
          <DialogDescription>
            Importe jogadores via CSV/Excel. Nickname, Nível e Posição são obrigatórios.
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
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/20 text-primary">Obrigatório</Badge>
                <code className="bg-muted px-2 py-0.5 rounded">Nickname</code>
                <span className="text-muted-foreground">- apelido do jogador</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/20 text-primary">Obrigatório</Badge>
                <code className="bg-muted px-2 py-0.5 rounded">Level</code>
                <span className="text-muted-foreground">- nível (A, B, C, D ou E)</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/20 text-primary">Obrigatório</Badge>
                <code className="bg-muted px-2 py-0.5 rounded">Position</code>
                <span className="text-muted-foreground">- goleiro, defensor, meio-campista, atacante</span>
              </div>
            </div>

            <div className="mt-3 bg-background rounded p-2 text-xs font-mono">
              Nickname,Level,Position<br />
              felipe,A,atacante<br />
              joesley,B,meio-campista
            </div>

            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => downloadTemplate('players')}
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar Template
            </Button>
          </div>

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
              <div className="max-h-40 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Nickname</th>
                      <th className="p-2 text-left">Level</th>
                      <th className="p-2 text-left">Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{row.Nickname || row.nickname || '-'}</td>
                        <td className="p-2">{row.Level || row.level || row.Nivel || '-'}</td>
                        <td className="p-2">{row.Position || row.position || row.Posicao || '-'}</td>
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
                    <p className="font-medium">
                      Importação concluída!
                    </p>
                    <ul className="text-sm">
                      <li className="text-green-600">✓ {result.created} jogador(es) criado(s)</li>
                      <li className="text-blue-600">↻ {result.updated} jogador(es) atualizado(s)</li>
                      {result.errors_count > 0 && (
                        <li className="text-yellow-600">⚠ {result.errors_count} erro(s)</li>
                      )}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadTokens}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar CSV com Tokens
                </Button>
                {result.errors_count > 0 && (
                  <Button variant="outline" size="sm" onClick={handleDownloadErrors}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Baixar Erros
                  </Button>
                )}
              </div>
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
