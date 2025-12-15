import type { ProfileStats } from "@/hooks/useProfileStats";

interface ProfileStatsGridProps {
  stats: ProfileStats;
}

interface StatItemProps {
  label: string;
  value: number;
  icon?: string;
  color?: string;
}

function StatItem({ label, value, icon, color = "text-foreground" }: StatItemProps) {
  return (
    <div className="flex items-center justify-between py-3 px-4 bg-muted/20 rounded-lg border border-border/30">
      <span className="text-sm text-muted-foreground flex items-center gap-2">
        {icon && <span>{icon}</span>}
        {label}
      </span>
      <span className={`text-lg font-bold ${color}`}>{value}</span>
    </div>
  );
}

export function ProfileStatsGrid({ stats }: ProfileStatsGridProps) {
  const statItems: StatItemProps[] = [
    { label: "Presenças", value: stats.presencas, icon: "✓", color: "text-green-500" },
    { label: "Gols", value: stats.gols, icon: "⚽", color: "text-primary" },
    { label: "Assistências", value: stats.assistencias, icon: "👟", color: "text-blue-400" },
    { label: "Vitórias", value: stats.vitorias, icon: "🏆", color: "text-green-500" },
    { label: "Empates", value: stats.empates, icon: "🤝", color: "text-yellow-500" },
    { label: "Derrotas", value: stats.derrotas, icon: "❌", color: "text-red-500" },
    { label: "Cartões Amarelos", value: stats.cartoes_amarelos, icon: "🟨", color: "text-yellow-400" },
    { label: "Cartões Azuis", value: stats.cartoes_azuis, icon: "🟦", color: "text-blue-500" },
    { label: "Punições", value: stats.punicoes, icon: "⚠️", color: "text-red-400" },
  ];

  return (
    <div className="px-4 py-4">
      <h3 className="text-lg font-semibold text-foreground mb-3">Estatísticas</h3>
      <div className="space-y-2">
        {statItems.map((item) => (
          <StatItem key={item.label} {...item} />
        ))}
      </div>
      
      {/* Total points highlight */}
      <div className="mt-4 p-4 bg-primary/10 rounded-lg border border-primary/30">
        <div className="flex items-center justify-between">
          <span className="text-base font-medium text-foreground">Pontos Totais</span>
          <span className="text-2xl font-bold text-primary">{stats.pontos_totais}</span>
        </div>
      </div>
    </div>
  );
}
