import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import type { RoundStats } from "@/hooks/useProfileStats";
import { TrendingUp } from "lucide-react";

interface ProfileEvolutionChartProps {
  roundStats: RoundStats[];
}

export function ProfileEvolutionChart({ roundStats }: ProfileEvolutionChartProps) {
  if (roundStats.length === 0) {
    return (
      <div className="px-4 py-4">
        <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Evolução do Desempenho
        </h3>
        <div className="p-8 bg-muted/10 rounded-lg border border-border/30 text-center">
          <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">Nenhuma estatística disponível ainda.</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Participe das rodadas para ver sua evolução!</p>
        </div>
      </div>
    );
  }

  const chartData = roundStats.map((rs) => ({
    name: `R${rs.round_number}`,
    pontos: rs.pontos_totais,
    gols: rs.gols,
    assistencias: rs.assistencias,
  }));

  // Cumulative data
  let cumulativePoints = 0;
  const cumulativeData = chartData.map((d) => {
    cumulativePoints += d.pontos;
    return {
      ...d,
      pontosAcumulados: cumulativePoints,
    };
  });

  return (
    <div className="px-4 py-4">
      <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        Evolução do Desempenho
      </h3>

      <div className="bg-muted/10 rounded-lg border border-border/30 p-4">
        <p className="text-xs text-muted-foreground mb-2">Pontos por Rodada</p>
        <div className="h-[250px] sm:h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cumulativeData}>
              <defs>
                <linearGradient id="colorPontos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey="name"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Area
                type="monotone"
                dataKey="pontosAcumulados"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#colorPontos)"
                name="Pontos Acumulados"
              />
              <Line
                type="monotone"
                dataKey="pontos"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", r: 3 }}
                name="Pontos da Rodada"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// Default export for React.lazy compatibility
export default ProfileEvolutionChart;
