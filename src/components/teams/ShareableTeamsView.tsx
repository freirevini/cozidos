import { forwardRef } from "react";
import { TeamLogo } from "@/components/match/TeamLogo";
import logoCozidos from "@/assets/logo-cozidos.png";

type TeamColor = "branco" | "vermelho" | "azul" | "laranja";

interface Match {
  id: string;
  match_number: number;
  team_home: TeamColor;
  team_away: TeamColor;
  scheduled_time: string;
}

interface TeamPlayer {
  id: string;
  player_id: string;
  team_color: string;
  profiles: {
    name: string;
    nickname: string | null;
    position: string | null;
    level: string | null;
  };
}

interface ShareableTeamsViewProps {
  roundNumber: number;
  scheduledDate: string;
  teamsByColor: Record<string, TeamPlayer[]>;
  matches: Match[];
}

const teamColorMap: Record<string, string> = {
  vermelho: "Vermelho",
  azul: "Azul",
  branco: "Branco",
  laranja: "Laranja",
};

export const ShareableTeamsView = forwardRef<HTMLDivElement, ShareableTeamsViewProps>(
  ({ roundNumber, scheduledDate, teamsByColor, matches }, ref) => {
    const teamColors = Object.keys(teamsByColor) as TeamColor[];
    
    const formatDate = (dateString: string) => {
      const date = new Date(dateString + "T00:00:00");
      return date.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      });
    };

    const formatTime = (timeString: string) => {
      if (!timeString) return "--:--";
      const [hours, minutes] = timeString.split(":");
      return `${hours}:${minutes}`;
    };

    return (
      <div
        ref={ref}
        className="bg-background p-6 rounded-2xl min-w-[360px] max-w-[600px] mx-auto"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {/* Header com logo */}
        <div className="flex flex-col items-center mb-6">
          <img 
            src={logoCozidos} 
            alt="Cozidos FC" 
            className="h-16 w-auto object-contain mb-2"
          />
          <h1 className="text-2xl font-bold text-primary">Rodada {roundNumber}</h1>
          <p className="text-muted-foreground capitalize">{formatDate(scheduledDate)}</p>
        </div>

        {/* Logos dos times */}
        <div className="flex justify-center gap-4 mb-6">
          {teamColors.map((color) => (
            <div key={color} className="flex flex-col items-center">
              <TeamLogo teamColor={color} size="lg" />
              <span className="text-xs text-muted-foreground mt-1 uppercase">
                {teamColorMap[color]}
              </span>
            </div>
          ))}
        </div>

        {/* Separador */}
        <div className="h-px bg-border/50 mb-6" />

        {/* Partidas */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground text-center mb-4">
            Jogos da Rodada
          </h2>
          {matches.length > 0 ? (
            matches.map((match) => (
              <div
                key={match.id}
                className="flex items-center justify-between bg-muted/30 rounded-xl p-3"
              >
                <div className="flex items-center gap-3 flex-1">
                  <TeamLogo teamColor={match.team_home} size="sm" />
                  <span className="font-medium text-foreground">
                    {teamColorMap[match.team_home]}
                  </span>
                </div>
                
                <div className="flex flex-col items-center px-4">
                  <span className="text-xs text-muted-foreground">Jogo {match.match_number}</span>
                  <span className="text-lg font-bold text-primary">
                    {formatTime(match.scheduled_time)}
                  </span>
                </div>
                
                <div className="flex items-center gap-3 flex-1 justify-end">
                  <span className="font-medium text-foreground">
                    {teamColorMap[match.team_away]}
                  </span>
                  <TeamLogo teamColor={match.team_away} size="sm" />
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-4">
              Partidas ainda não definidas
            </p>
          )}
        </div>

        {/* Rodapé */}
        <div className="mt-6 pt-4 border-t border-border/30 text-center">
          <p className="text-xs text-muted-foreground">
            ⚽ Cozidos FC • Pelada organizada
          </p>
        </div>
      </div>
    );
  }
);

ShareableTeamsView.displayName = "ShareableTeamsView";
