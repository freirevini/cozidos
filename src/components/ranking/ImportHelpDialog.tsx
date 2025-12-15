import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface ImportHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImportHelpDialog({ open, onOpenChange }: ImportHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border max-h-[85vh] overflow-y-auto max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-primary flex items-center gap-2">
            📥 Como importar arquivo de classificação
          </DialogTitle>
        </DialogHeader>

        <DialogDescription asChild>
          <div className="space-y-4 text-foreground">
            <p className="text-sm text-muted-foreground">
              O arquivo deve conter as seguintes colunas:
            </p>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/20 text-primary border-primary/30">Obrigatório</Badge>
                <span className="font-mono text-sm">Nickname</span>
                <span className="text-muted-foreground text-sm">- apelido do jogador</span>
              </div>

              <div className="space-y-1 pl-4 border-l-2 border-border">
                <p className="text-sm font-medium text-muted-foreground">Estatísticas (opcionais):</p>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li><code className="bg-muted px-1 rounded">Gols</code> - número de gols marcados</li>
                  <li><code className="bg-muted px-1 rounded">Assistencias</code> - número de assistências</li>
                  <li><code className="bg-muted px-1 rounded">Vitorias</code> - total de vitórias</li>
                  <li><code className="bg-muted px-1 rounded">Empates</code> - total de empates</li>
                  <li><code className="bg-muted px-1 rounded">Derrotas</code> - total de derrotas</li>
                  <li><code className="bg-muted px-1 rounded">Pontos_Totais</code> - pontuação final</li>
                </ul>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">Temporada</Badge>
                <span className="font-mono text-sm">Ano</span>
                <span className="text-muted-foreground text-sm">- formato YYYY (ex: 2024)</span>
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-3 border border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">📄 Exemplo de arquivo:</p>
              <pre className="text-xs overflow-x-auto text-foreground/80">
{`Nickname,Gols,Assistencias,Vitorias,Empates,Derrotas,Pontos_Totais,Ano
felipe,10,4,6,2,2,20,2023
deyse,8,6,5,3,2,18,2023
carlos,5,2,4,4,2,15,2024`}
              </pre>
            </div>

            <div className="bg-primary/10 rounded-lg p-3 border border-primary/30">
              <p className="text-sm font-medium text-primary mb-2">ℹ️ Observações importantes:</p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Campos ausentes serão preenchidos com zero</li>
                <li>• Jogadores são vinculados por <strong>Nickname</strong></li>
                <li>• Quando disponível, o <strong>token</strong> é usado para vinculação segura</li>
                <li>• Dados históricos são preservados separadamente</li>
              </ul>
            </div>
          </div>
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}
