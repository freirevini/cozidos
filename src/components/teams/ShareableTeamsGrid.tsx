import { forwardRef } from "react";
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

interface ShareableTeamsGridProps {
  roundNumber: number;
  scheduledDate: string;
  teamsByColor: Record<string, TeamPlayer[]>;
  matches: Match[];
}

const teamColorMap: Record<string, string> = {
  vermelho: "VERMELHO",
  azul: "AZUL",
  branco: "BRANCO",
  laranja: "LARANJA",
};

const teamBgColors: Record<string, string> = {
  branco: "#e5e5e5",
  vermelho: "#e5e5e5",
  azul: "#60a5fa",
  laranja: "#fb923c",
};

const teamTextColors: Record<string, string> = {
  branco: "#1a1a1a",
  vermelho: "#1a1a1a",
  azul: "#1a1a1a",
  laranja: "#1a1a1a",
};

const levelOrder = ["A", "B", "C", "D", "E"];

export const ShareableTeamsGrid = forwardRef<HTMLDivElement, ShareableTeamsGridProps>(
  ({ roundNumber, scheduledDate, teamsByColor, matches }, ref) => {
    const teamColors = Object.keys(teamsByColor) as TeamColor[];
    
    const formatDate = (dateString: string) => {
      if (!dateString) return "";
      const date = new Date(dateString + "T00:00:00");
      return date.toLocaleDateString("pt-BR");
    };

    const formatTime = (timeString: string) => {
      if (!timeString) return "--:--";
      const [hours, minutes] = timeString.split(":");
      return `${hours}:${minutes}`;
    };

    // Organizar jogadores por nível para cada time
    const getPlayersByLevel = (players: TeamPlayer[]) => {
      const goalkeepers = players.filter(p => p.profiles.position === "goleiro");
      const fieldPlayers = players.filter(p => p.profiles.position !== "goleiro");
      
      const byLevel: Record<string, TeamPlayer[]> = {};
      levelOrder.forEach(level => {
        byLevel[level] = fieldPlayers.filter(p => p.profiles.level === level);
      });
      byLevel["GK"] = goalkeepers;
      
      return byLevel;
    };

    // Determinar quantas linhas precisamos
    const allLevelCounts: Record<string, number> = {};
    levelOrder.forEach(level => allLevelCounts[level] = 0);
    allLevelCounts["GK"] = 0;

    teamColors.forEach(color => {
      const byLevel = getPlayersByLevel(teamsByColor[color]);
      [...levelOrder, "GK"].forEach(level => {
        allLevelCounts[level] = Math.max(allLevelCounts[level], byLevel[level]?.length || 0);
      });
    });

    return (
      <div
        ref={ref}
        className="p-6 min-w-[600px]"
        style={{ 
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          backgroundColor: "#ffffff",
          color: "#1a1a1a"
        }}
      >
        {/* Header com logo, nome e data */}
        <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-gray-200">
          <img 
            src={logoCozidos} 
            alt="Cozidos FC" 
            className="h-20 w-auto object-contain"
          />
          <div className="flex-1">
            <h1 className="text-2xl font-bold" style={{ color: "#d946ef" }}>
              COZIDOS FC
            </h1>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold" style={{ color: "#d946ef" }}>
              {formatDate(scheduledDate)}
            </div>
            <div className="text-sm text-gray-500">
              Rodada {roundNumber}
            </div>
          </div>
        </div>

        {/* Grid de times - Header */}
        <div className="mb-6">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="w-20 p-2 text-left"></th>
                {teamColors.map(color => (
                  <th 
                    key={color}
                    className="p-3 text-center font-bold text-base border border-gray-300"
                    style={{ 
                      backgroundColor: teamBgColors[color],
                      color: teamTextColors[color]
                    }}
                  >
                    {teamColorMap[color]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Linhas por nível */}
              {[...levelOrder, "GK"].map(level => {
                // Verificar se algum time tem jogador nesse nível
                const hasPlayers = teamColors.some(color => {
                  const byLevel = getPlayersByLevel(teamsByColor[color]);
                  return byLevel[level] && byLevel[level].length > 0;
                });
                
                if (!hasPlayers) return null;
                
                return (
                  <tr key={level}>
                    <td 
                      className="p-2 text-center font-bold text-sm border border-gray-300"
                      style={{ backgroundColor: "#d946ef", color: "#ffffff" }}
                    >
                      {level === "GK" ? "GOLEIROS" : level}
                    </td>
                    {teamColors.map(color => {
                      const byLevel = getPlayersByLevel(teamsByColor[color]);
                      const players = byLevel[level] || [];
                      
                      return (
                        <td 
                          key={`${level}-${color}`}
                          className="p-2 text-center text-sm border border-gray-300 align-top"
                          style={{ backgroundColor: "#ffffff" }}
                        >
                          {players.map((p, idx) => (
                            <div key={p.id} className={idx > 0 ? "mt-1" : ""}>
                              {(p.profiles.nickname || p.profiles.name).toUpperCase()}
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Separador */}
        <div className="h-4" />

        {/* Tabela de jogos */}
        {matches.length > 0 && (
          <table className="w-full border-collapse">
            <tbody>
              {matches.map((match) => (
                <tr key={match.id}>
                  <td className="p-2 text-center font-medium border border-gray-300 w-20">
                    {formatTime(match.scheduled_time)}
                  </td>
                  <td className="p-2 border border-gray-300" />
                  <td 
                    className="p-2 text-center font-bold border border-gray-300"
                    style={{ 
                      backgroundColor: teamBgColors[match.team_home],
                      color: teamTextColors[match.team_home]
                    }}
                  >
                    {teamColorMap[match.team_home]}
                  </td>
                  <td className="p-2 text-center font-bold border border-gray-300 w-10">
                    X
                  </td>
                  <td 
                    className="p-2 text-center font-bold border border-gray-300"
                    style={{ 
                      backgroundColor: teamBgColors[match.team_away],
                      color: teamTextColors[match.team_away]
                    }}
                  >
                    {teamColorMap[match.team_away]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Rodapé */}
        <div className="mt-6 pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            ⚽ Cozidos FC • Pelada organizada
          </p>
        </div>
      </div>
    );
  }
);

ShareableTeamsGrid.displayName = "ShareableTeamsGrid";
