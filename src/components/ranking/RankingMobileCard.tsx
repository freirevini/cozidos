import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RankingInput } from "@/components/ui/ranking-input";
import { Badge } from "@/components/ui/badge";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
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

interface RankingMobileCardProps {
  ranking: PlayerRanking;
  position: number;
  isEdited: boolean;
  onFieldChange: (id: string, field: keyof PlayerRanking, value: number) => void;
  onDelete: (playerId: string, playerName: string) => void;
}

const statFields: { key: keyof PlayerRanking; label: string; icon?: string }[] = [
  { key: 'gols', label: 'Gols', icon: '⚽' },
  { key: 'assistencias', label: 'Assist', icon: '🎯' },
  { key: 'vitorias', label: 'V' },
  { key: 'empates', label: 'E' },
  { key: 'derrotas', label: 'D' },
  { key: 'presencas', label: 'Presenças' },
  { key: 'faltas', label: 'Faltas' },
  { key: 'atrasos', label: 'Atrasos' },
  { key: 'punicoes', label: 'Punições' },
  { key: 'cartoes_amarelos', label: '🟨' },
  { key: 'cartoes_azuis', label: '🟦' },
];

export default function RankingMobileCard({
  ranking,
  position,
  isEdited,
  onFieldChange,
  onDelete,
}: RankingMobileCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className={cn(
        "border-border/30 bg-card/50 transition-all",
        isEdited && "border-l-4 border-l-yellow-500 bg-yellow-500/5"
      )}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-primary w-8">{position}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{ranking.nickname}</span>
                {isEdited && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 bg-yellow-500/20 text-yellow-600">
                    Editado
                  </Badge>
                )}
              </div>
              <span className="text-sm text-muted-foreground">{ranking.email}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-primary">{ranking.pontos_totais}</span>
            <p className="text-xs text-muted-foreground">pontos</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-5 gap-2 mb-3">
          {statFields.slice(0, 5).map((stat) => (
            <div key={stat.key} className="text-center">
              <RankingInput
                min="0"
                value={ranking[stat.key] as number}
                onValueChange={(value) => onFieldChange(ranking.id, stat.key, value)}
                className="w-full h-10 text-center"
              />
              <span className="text-[10px] text-muted-foreground">{stat.icon || stat.label}</span>
            </div>
          ))}
        </div>

        {/* Expand Button */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-8"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1" />
              Menos
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-1" />
              Mais estatísticas
            </>
          )}
        </Button>

        {/* Expanded Stats */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-border/30 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {statFields.slice(5).map((stat) => (
                <div key={stat.key} className="text-center">
                  <RankingInput
                    min="0"
                    value={ranking[stat.key] as number}
                    onValueChange={(value) => onFieldChange(ranking.id, stat.key, value)}
                    className="w-full h-10 text-center"
                  />
                  <span className="text-[10px] text-muted-foreground">{stat.label}</span>
                </div>
              ))}
            </div>

            {/* Delete Button */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="w-full mt-2">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir da classificação
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>⚠️ Excluir Jogador?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Remover <strong>{ranking.nickname}</strong> da classificação?
                    O perfil do jogador será mantido.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(ranking.player_id, ranking.nickname)}
                    className="bg-destructive"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
