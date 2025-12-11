import { Button } from "@/components/ui/button";
import { UserPlus, Upload, RefreshCw, HelpCircle } from "lucide-react";

interface PlayerQuickActionsProps {
  onAddPlayer: () => void;
  onImportExcel: () => void;
  onRefresh: () => void;
  onShowHelp: () => void;
  importing: boolean;
  refreshing: boolean;
}

export function PlayerQuickActions({
  onAddPlayer,
  onImportExcel,
  onRefresh,
  onShowHelp,
  importing,
  refreshing,
}: PlayerQuickActionsProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button
        onClick={onAddPlayer}
        size="sm"
        className="h-9 gap-1.5 bg-primary hover:bg-primary/90"
      >
        <UserPlus className="h-4 w-4" />
        <span className="hidden sm:inline">Cadastrar</span>
      </Button>

      <div className="flex items-center gap-1.5">
        <Button
          onClick={onImportExcel}
          disabled={importing}
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
        >
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">{importing ? "Importando..." : "Importar"}</span>
        </Button>

        <Button
          onClick={onShowHelp}
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          title="Ajuda para importação"
        >
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
        </Button>

        <Button
          onClick={onRefresh}
          disabled={refreshing}
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          title="Atualizar lista"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>
    </div>
  );
}
