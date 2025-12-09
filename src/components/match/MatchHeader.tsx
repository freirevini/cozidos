import { TeamLogo } from "./TeamLogo";

interface MatchHeaderProps {
  teamHome: string;
  teamAway: string;
  scoreHome: number;
  scoreAway: number;
  roundNumber?: number;
  status: "not_started" | "in_progress" | "finished";
  scheduledDate?: string;
  className?: string;
}

const teamNames: Record<string, string> = {
  branco: "BRANCO",
  vermelho: "VERMELHO",
  azul: "AZUL",
  laranja: "LARANJA",
};

export function MatchHeader({
  teamHome,
  teamAway,
  scoreHome,
  scoreAway,
  roundNumber,
  status,
  scheduledDate,
  className,
}: MatchHeaderProps) {
  const getStatusText = () => {
    if (status === "finished") return "Encerrada";
    if (status === "in_progress") return "Em andamento";
    return "A iniciar";
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  return (
    <div className={`space-y-4 ${className || ""}`}>
      {/* Rodada e Status */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-primary font-semibold">
          {roundNumber ? `Rodada ${roundNumber}` : ""}
        </div>
        <div className="text-muted-foreground">
          {status === "finished" && scheduledDate ? formatDate(scheduledDate) : getStatusText()}
        </div>
      </div>

      {/* Placar Central */}
      <div className="flex items-center justify-center gap-4 sm:gap-8">
        {/* Time Casa */}
        <div className="flex flex-col items-center gap-2 flex-1">
          <TeamLogo teamColor={teamHome as any} size="md" />
          <div className="text-sm sm:text-base font-bold uppercase text-center">
            {teamNames[teamHome] || teamHome}
          </div>
        </div>

        {/* Placar */}
        <div className="flex flex-col items-center gap-1">
          <div className="text-4xl sm:text-5xl md:text-6xl font-bold tabular-nums text-primary">
            {scoreHome} : {scoreAway}
          </div>
        </div>

        {/* Time Visitante */}
        <div className="flex flex-col items-center gap-2 flex-1">
          <TeamLogo teamColor={teamAway as any} size="md" />
          <div className="text-sm sm:text-base font-bold uppercase text-center">
            {teamNames[teamAway] || teamAway}
          </div>
        </div>
      </div>
    </div>
  );
}

