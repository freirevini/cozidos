import type { ProfileStats } from "@/hooks/useProfileStats";
import { Target, Goal, Footprints } from "lucide-react";

interface ProfileStatsGridProps {
  stats: ProfileStats;
}

export function ProfileStatsGrid({ stats }: ProfileStatsGridProps) {
  return (
    <div className="px-4 py-4 space-y-3">
      {/* Primeira linha: Partidas, Gols, Assistências */}
      <div className="bg-card rounded-2xl border border-border/50 p-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="flex flex-col items-center">
            <span className="text-4xl font-bold text-white">{stats.partidas}</span>
            <span className="text-sm text-muted-foreground mt-1">Partidas</span>
            <Target className="w-5 h-5 text-primary/60 mt-2" />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-4xl font-bold text-white">{stats.gols}</span>
            <span className="text-sm text-muted-foreground mt-1">Gols</span>
            <Goal className="w-5 h-5 text-primary/60 mt-2" />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-4xl font-bold text-white">{stats.assistencias}</span>
            <span className="text-sm text-muted-foreground mt-1">Assistências</span>
            <Footprints className="w-5 h-5 text-primary/60 mt-2" />
          </div>
        </div>
      </div>

      {/* Segunda linha: Vitórias, Empates, Derrotas */}
      <div className="bg-card rounded-2xl border border-border/50 p-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="flex flex-col items-center">
            <span className="text-4xl font-bold text-white">{stats.vitorias}</span>
            <span className="text-sm text-muted-foreground mt-1">Vitórias</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-4xl font-bold text-white">{stats.empates}</span>
            <span className="text-sm text-muted-foreground mt-1">Empates</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-4xl font-bold text-white">{stats.derrotas}</span>
            <span className="text-sm text-muted-foreground mt-1">Derrotas</span>
          </div>
        </div>
      </div>

      {/* Total de pontos */}
      <div className="bg-primary/10 rounded-2xl border border-primary/30 p-4">
        <div className="flex items-center justify-between">
          <span className="text-base font-medium text-foreground">Pontos Totais</span>
          <span className="text-2xl font-bold text-primary">{stats.pontos_totais}</span>
        </div>
      </div>
    </div>
  );
}
