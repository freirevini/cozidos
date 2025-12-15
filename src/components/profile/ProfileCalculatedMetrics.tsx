import type { CalculatedMetrics } from "@/hooks/useProfileStats";

interface ProfileCalculatedMetricsProps {
  metrics: CalculatedMetrics;
  hasData: boolean;
}

interface MetricCardProps {
  label: string;
  value: string;
  subtext?: string;
}

function MetricCard({ label, value, subtext }: MetricCardProps) {
  return (
    <div className="p-3 bg-muted/20 rounded-lg border border-border/30 text-center">
      <p className="text-2xl font-bold text-primary">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
      {subtext && <p className="text-xs text-muted-foreground/70">{subtext}</p>}
    </div>
  );
}

export function ProfileCalculatedMetrics({ metrics, hasData }: ProfileCalculatedMetricsProps) {
  if (!hasData) return null;

  return (
    <div className="px-4 py-4">
      <h3 className="text-lg font-semibold text-foreground mb-3">Métricas Calculadas</h3>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Média Gols/Jogo"
          value={metrics.mediaGolsJogo.toFixed(2)}
        />
        <MetricCard
          label="Média Assist./Jogo"
          value={metrics.mediaAssistenciasJogo.toFixed(2)}
        />
        <MetricCard
          label="Partic. em Gols"
          value={`${metrics.participacaoGols.toFixed(0)}%`}
          subtext="(gols + assist.)"
        />
        <MetricCard
          label="Taxa de Vitórias"
          value={`${metrics.taxaVitorias.toFixed(0)}%`}
        />
      </div>
    </div>
  );
}
