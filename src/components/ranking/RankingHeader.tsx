import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Save, RotateCcw, Upload, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RankingHeaderProps {
  seasons: number[];
  selectedSeason: number;
  onSeasonChange: (season: number) => void;
  editedCount: number;
  saving: boolean;
  recalculating: boolean;
  importing: boolean;
  onAddPlayers: () => void;
  onSave: () => void;
  onRecalculate: () => void;
  onImportClick: () => void;
  onHelpClick: () => void;
  onResetClick: () => void;
}

export default function RankingHeader({
  seasons,
  selectedSeason,
  onSeasonChange,
  editedCount,
  saving,
  recalculating,
  importing,
  onAddPlayers,
  onSave,
  onRecalculate,
  onImportClick,
  onHelpClick,
  onResetClick,
}: RankingHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Title and Season Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl sm:text-2xl font-bold text-primary">
            Gerenciar Classificação
          </h1>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Select
                    value={selectedSeason.toString()}
                    onValueChange={(v) => onSeasonChange(parseInt(v))}
                  >
                    <SelectTrigger className="w-[100px] h-9 bg-muted/30 border-border/50">
                      <SelectValue placeholder="Temporada" />
                    </SelectTrigger>
                    <SelectContent>
                      {seasons.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Selecionar temporada</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onHelpClick}
          className="rounded-full"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onAddPlayers}
                variant="default"
                size="sm"
                className="min-h-[40px]"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Incluir Jogadores</span>
                <span className="sm:hidden">Incluir</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Adicionar novos jogadores à classificação</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {editedCount > 0 && (
          <Button
            onClick={onSave}
            disabled={saving}
            size="sm"
            className="min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Salvando..." : `Salvar (${editedCount})`}
          </Button>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onRecalculate}
                disabled={recalculating}
                variant="secondary"
                size="sm"
                className="min-h-[40px]"
              >
                <RotateCcw className={`mr-2 h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Recalcular</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Recalcular classificação com base nas rodadas</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onResetClick}
                variant="destructive"
                size="sm"
                className="min-h-[40px]"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Resetar</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Resetar toda a classificação</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[40px]"
                disabled={importing}
                onClick={onImportClick}
              >
                <Upload className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">{importing ? "Importando..." : "Importar"}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Importar classificação de arquivo Excel/CSV</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
