import type { BestWorstPeriod } from "@/hooks/useProfileStats";
import { TrendingUp, TrendingDown, Trophy, AlertTriangle } from "lucide-react";

interface ProfileBestWorstCardsProps {
  bestWorstPeriods: {
    bestRound: BestWorstPeriod | null;
    worstRound: BestWorstPeriod | null;
    bestMonth: BestWorstPeriod | null;
    worstMonth: BestWorstPeriod | null;
  } | null;
}

interface PeriodCardProps {
  title: string;
  period: BestWorstPeriod;
  variant: "best" | "worst";
}

function PeriodCard({ title, period, variant }: PeriodCardProps) {
  const isBest = variant === "best";
  const Icon = isBest ? Trophy : AlertTriangle;
  const iconColor = isBest ? "text-green-500" : "text-red-500";
  const borderColor = isBest ? "border-green-500/30" : "border-red-500/30";
  const bgColor = isBest ? "bg-green-500/5" : "bg-red-500/5";

  return (
    <div className={`p-4 rounded-lg border ${borderColor} ${bgColor}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
      </div>
      <p className="text-sm font-semibold text-foreground mb-2">{period.period}</p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold text-primary">{period.pontos}</p>
          <p className="text-xs text-muted-foreground">Pts</p>
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">{period.gols}</p>
          <p className="text-xs text-muted-foreground">Gols</p>
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">{period.assistencias}</p>
          <p className="text-xs text-muted-foreground">Assist</p>
        </div>
      </div>
      <div className="flex justify-center gap-4 mt-2 text-xs">
        <span className="text-green-500">{period.vitorias}V</span>
        <span className="text-yellow-500">{period.empates}E</span>
        <span className="text-red-500">{period.derrotas}D</span>
      </div>
    </div>
  );
}

export function ProfileBestWorstCards({ bestWorstPeriods }: ProfileBestWorstCardsProps) {
  if (!bestWorstPeriods) return null;

  const { bestRound, worstRound, bestMonth, worstMonth } = bestWorstPeriods;

  // Check if we have any data to show
  if (!bestRound && !worstRound && !bestMonth && !worstMonth) return null;

  return (
    <div className="px-4 py-4">
      <h3 className="text-lg font-semibold text-foreground mb-3">Melhores e Piores Momentos</h3>
      
      <div className="grid grid-cols-2 gap-3">
        {bestMonth && <PeriodCard title="Melhor Mês" period={bestMonth} variant="best" />}
        {worstMonth && <PeriodCard title="Pior Mês" period={worstMonth} variant="worst" />}
        {bestRound && <PeriodCard title="Melhor Rodada" period={bestRound} variant="best" />}
        {worstRound && <PeriodCard title="Pior Rodada" period={worstRound} variant="worst" />}
      </div>
    </div>
  );
}
