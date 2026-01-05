import { forwardRef } from "react";
import logoCozidos from "@/assets/logo-cozidos-novo.png";

type TeamColor = "branco" | "preto" | "azul" | "laranja";

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
  preto: "preto",
  azul: "AZUL",
  branco: "BRANCO",
  laranja: "LARANJA",
};

const teamBgColors: Record<string, string> = {
  branco: "#f5f5f5",
  preto: "#1a1a1a",
  azul: "#2563eb",
  laranja: "#ea580c",
};

const teamTextColors: Record<string, string> = {
  branco: "#1a1a1a",
  preto: "#ffffff",
  azul: "#ffffff",
  laranja: "#ffffff",
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

    return (
      <div
        ref={ref}
        className="p-6 min-w-[600px]"
        style={{ 
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          backgroundColor: "#0a0a0a",
          color: "#ffffff"
        }}
      >
        {/* Header com logo, nome e data */}
        <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white/10">
          <img 
            src={logoCozidos} 
            alt="Cozidos FC" 
            className="h-16 w-auto object-contain"
          />
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">
              COZIDOS FC
            </h1>
            <p className="text-sm text-white/60">
              Pelada organizada
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold" style={{ color: "#d946ef" }}>
              Rodada {roundNumber}
            </div>
            <div className="text-sm text-white/70">
              {formatDate(scheduledDate)}
            </div>
          </div>
        </div>

        {/* Grid de times - Header */}
        <div className="mb-6">
          <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0" }}>
            <thead>
              <tr>
                <th className="w-16 p-2 text-left text-white/50 text-xs font-medium"></th>
                {teamColors.map(color => (
                  <th 
                    key={color}
                    className="p-3 text-center font-bold text-sm"
                    style={{ 
                      backgroundColor: teamBgColors[color],
                      color: teamTextColors[color],
                      borderRadius: "8px 8px 0 0"
                    }}
                  >
                    {teamColorMap[color]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Linhas por nível */}
              {[...levelOrder, "GK"].map((level, levelIdx) => {
                // Verificar se algum time tem jogador nesse nível
                const hasPlayers = teamColors.some(color => {
                  const byLevel = getPlayersByLevel(teamsByColor[color]);
                  return byLevel[level] && byLevel[level].length > 0;
                });
                
                if (!hasPlayers) return null;
                
                const isLast = levelIdx === [...levelOrder, "GK"].filter(l => {
                  return teamColors.some(color => {
                    const byLevel = getPlayersByLevel(teamsByColor[color]);
                    return byLevel[l] && byLevel[l].length > 0;
                  });
                }).length - 1;
                
                return (
                  <tr key={level}>
                    <td 
                      className="p-2 text-center font-bold text-xs"
                      style={{ 
                        backgroundColor: "#d946ef", 
                        color: "#ffffff",
                        borderRadius: isLast ? "0 0 0 8px" : "0"
                      }}
                    >
                      {level === "GK" ? "GK" : level}
                    </td>
                    {teamColors.map((color, colIdx) => {
                      const byLevel = getPlayersByLevel(teamsByColor[color]);
                      const players = byLevel[level] || [];
                      
                      return (
                        <td 
                          key={`${level}-${color}`}
                          className="p-2 text-center text-sm align-top"
                          style={{ 
                            backgroundColor: "#1a1a1a",
                            borderRadius: isLast && colIdx === teamColors.length - 1 ? "0 0 8px 0" : "0"
                          }}
                        >
                          {players.map((p, idx) => (
                            <div key={p.id} className={idx > 0 ? "mt-1" : ""} style={{ color: "#ffffff" }}>
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
        <div className="h-6" />

        {/* Título Jogos */}
        {matches.length > 0 && (
          <>
            <div className="text-center mb-4">
              <span 
                className="text-sm font-semibold px-4 py-1 rounded-full"
                style={{ backgroundColor: "#d946ef", color: "#ffffff" }}
              >
                JOGOS
              </span>
            </div>
            
            {/* Tabela de jogos */}
            <div className="space-y-2">
              {matches.map((match) => (
                <div 
                  key={match.id}
                  className="flex items-center justify-center gap-4 p-3 rounded-lg"
                  style={{ backgroundColor: "#1a1a1a" }}
                >
                  <span className="text-white/60 text-sm font-medium w-14">
                    {formatTime(match.scheduled_time)}
                  </span>
                  <div className="flex items-center gap-3">
                    <span 
                      className="px-3 py-1 rounded font-bold text-sm"
                      style={{ 
                        backgroundColor: teamBgColors[match.team_home],
                        color: teamTextColors[match.team_home]
                      }}
                    >
                      {teamColorMap[match.team_home]}
                    </span>
                    <span className="text-white/40 font-bold">×</span>
                    <span 
                      className="px-3 py-1 rounded font-bold text-sm"
                      style={{ 
                        backgroundColor: teamBgColors[match.team_away],
                        color: teamTextColors[match.team_away]
                      }}
                    >
                      {teamColorMap[match.team_away]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Rodapé */}
        <div className="mt-6 pt-4 border-t border-white/10 text-center">
          <p className="text-xs text-white/40">
            ⚽ Cozidos FC • {formatDate(scheduledDate)}
          </p>
        </div>
      </div>
    );
  }
);

ShareableTeamsGrid.displayName = "ShareableTeamsGrid";
