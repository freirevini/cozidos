import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RankingInput } from "@/components/ui/ranking-input";
import { Trash2, Copy, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  source_type?: 'manual' | 'imported' | 'calculated';
}

interface RankingTableRowProps {
  ranking: PlayerRanking;
  position: number;
  isEdited: boolean;
  onFieldChange: (id: string, field: keyof PlayerRanking, value: number) => void;
  onDelete: (playerId: string, playerName: string) => void;
  onCopy: (ranking: PlayerRanking) => void;
  onReset: (ranking: PlayerRanking) => void;
}

export default function RankingTableRow({
  ranking,
  position,
  isEdited,
  onFieldChange,
  onDelete,
  onCopy,
  onReset,
}: RankingTableRowProps) {
  const editableFields: (keyof PlayerRanking)[] = [
    'gols', 'assistencias', 'vitorias', 'empates', 'derrotas',
    'presencas', 'faltas', 'atrasos', 'punicoes', 'cartoes_amarelos', 'cartoes_azuis'
  ];

  return (
    <TableRow
      className={cn(
        "border-border/30 hover:bg-muted/20 transition-colors",
        isEdited && "bg-yellow-500/10 border-l-4 border-l-yellow-500"
      )}
    >
      {/* Position - Sticky */}
      <TableCell className="text-center font-bold text-primary text-lg sticky left-0 bg-background z-10">
        {position}
      </TableCell>

      {/* Nickname - Sticky */}
      <TableCell className="sticky left-12 bg-background z-10">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground truncate max-w-[120px]">
            {ranking.nickname}
          </span>
          {isEdited && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
              Editado
            </Badge>
          )}
          {ranking.source_type === 'imported' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-500/20 text-blue-400 border-blue-500/30">
                    IMP
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Dados importados</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </TableCell>

      {/* Pontos Totais (read-only) */}
      <TableCell className="text-center">
        <span className="font-bold text-lg text-primary">{ranking.pontos_totais}</span>
      </TableCell>

      {/* Editable Fields */}
      {editableFields.map((field) => (
        <TableCell key={field} className="text-center p-1">
          <RankingInput
            min="0"
            value={ranking[field] as number}
            onValueChange={(value) => onFieldChange(ranking.id, field, value)}
            className="w-14 h-8 text-center"
          />
        </TableCell>
      ))}

      {/* Actions */}
      <TableCell className="text-center p-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onCopy(ranking)}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar linha
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onReset(ranking)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Zerar linha
            </DropdownMenuItem>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir jogador
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>⚠️ Excluir Jogador da Classificação?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3">
                    <p>
                      Esta ação irá remover <strong>{ranking.nickname}</strong> da classificação
                      e excluir TODOS os dados relacionados.
                    </p>
                    <p className="text-yellow-600 font-semibold">
                      ⚠️ O perfil do jogador será MANTIDO no sistema.
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(ranking.player_id, ranking.nickname)}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Sim, Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
