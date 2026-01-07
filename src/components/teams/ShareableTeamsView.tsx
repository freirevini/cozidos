import { forwardRef } from "react";
import logoCozidos from "@/assets/novo-logo.png";
import iconBall from "@/assets/icon-ball.png";

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

interface ShareableTeamsViewProps {
  roundNumber: number;
  scheduledDate: string;
  teamsByColor: Record<string, TeamPlayer[]>;
  matches: Match[];
}

// Team display names (capitalized)
const teamDisplayNames: Record<string, string> = {
  preto: "Preto",
  azul: "Azul",
  branco: "Branco",
  laranja: "Laranja",
};

// Modern gradient team styles
const teamStyles: Record<string, {
  headerBg: string;
  headerText: string;
  cardBg: string;
  badgeBg: string;
  badgeText: string;
  border?: string;
  glow?: string;
}> = {
  laranja: {
    headerBg: "bg-gradient-to-br from-orange-400 to-orange-500",
    headerText: "text-white",
    cardBg: "bg-gradient-to-b from-orange-950/40 to-orange-950/20",
    badgeBg: "bg-gradient-to-r from-orange-400 to-orange-500",
    badgeText: "text-white",
    glow: "shadow-orange-500/20"
  },
  preto: {
    headerBg: "bg-gradient-to-br from-zinc-700 to-zinc-800",
    headerText: "text-white",
    cardBg: "bg-gradient-to-b from-zinc-800/60 to-zinc-900/40",
    badgeBg: "bg-gradient-to-r from-zinc-600 to-zinc-700",
    badgeText: "text-white",
    border: "ring-1 ring-zinc-600/50"
  },
  branco: {
    headerBg: "bg-gradient-to-br from-zinc-100 to-zinc-200",
    headerText: "text-zinc-900",
    cardBg: "bg-gradient-to-b from-zinc-100/10 to-zinc-50/5",
    badgeBg: "bg-gradient-to-r from-zinc-100 to-zinc-200",
    badgeText: "text-zinc-900",
    border: "ring-1 ring-zinc-400/30"
  },
  azul: {
    headerBg: "bg-gradient-to-br from-blue-400 to-blue-500",
    headerText: "text-white",
    cardBg: "bg-gradient-to-b from-blue-950/40 to-blue-950/20",
    badgeBg: "bg-gradient-to-r from-blue-400 to-blue-500",
    badgeText: "text-white",
    glow: "shadow-blue-500/20"
  },
};

export const ShareableTeamsView = forwardRef<HTMLDivElement, ShareableTeamsViewProps>(
  ({ roundNumber, scheduledDate, teamsByColor, matches }, ref) => {
    const teamColors: TeamColor[] = ["laranja", "preto", "branco", "azul"];

    const formatShortDate = (dateString: string) => {
      const date = new Date(dateString + "T00:00:00");
      const weekday = date.toLocaleDateString("pt-BR", { weekday: "short" });
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      // Format: "Qua., 07/01"
      return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1, 3)}., ${day}/${month}`;
    };

    const formatTime = (timeString: string) => {
      if (!timeString) return "--:--";
      const [hours, minutes] = timeString.split(":");
      return `${hours}:${minutes}`;
    };

    // Get first match time for header
    const firstMatchTime = matches.length > 0 ? formatTime(matches[0].scheduled_time) : "19:00";

    // Sort players by position for display
    const sortPlayers = (players: TeamPlayer[]) => {
      const positionOrder = ["atacante", "meio-campista", "defensor", "goleiro"];
      return [...players].sort((a, b) => {
        const posA = positionOrder.indexOf(a.profiles.position || "");
        const posB = positionOrder.indexOf(b.profiles.position || "");
        return posA - posB;
      });
    };

    // Get display name for player - full nickname or first name
    const getPlayerDisplay = (player: TeamPlayer) => {
      return player.profiles.nickname || player.profiles.name?.split(" ")[0] || "Jogador";
    };

    // Get position label
    const getPositionLabel = (player: TeamPlayer, index: number) => {
      if (player.profiles.position === "goleiro") return "GK";
      const letters = ["A", "B", "C", "D", "E", "F", "G"];
      return letters[index] || String.fromCharCode(65 + index);
    };

    const activeTeams = teamColors.filter(color => teamsByColor[color]?.length > 0);

    return (
      <div
        ref={ref}
        className="w-[400px] flex flex-col relative overflow-hidden"
        style={{
          fontFamily: "'Inter', sans-serif",
          aspectRatio: "9/16",
          background: "linear-gradient(180deg, #0f0f0f 0%, #1a1a1a 50%, #0f0f0f 100%)"
        }}
      >
        {/* Subtle gradient overlay */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: "radial-gradient(ellipse at 50% 0%, rgba(236, 72, 153, 0.15) 0%, transparent 50%)"
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full">
          {/* Header: Logo + Rodada Info - COMPACT */}
          <div className="flex items-center justify-between px-4 py-3">
            <img
              src={logoCozidos}
              alt="Cozidos FC"
              className="h-12 w-auto object-contain"
            />
            <div className="text-right">
              <h1 className="text-xl font-bold text-white tracking-tight">
                Rodada {roundNumber}
              </h1>
              <p className="text-zinc-400 text-[10px] font-light">
                {formatShortDate(scheduledDate)}
              </p>
              <p className="text-pink-400 text-xs font-semibold">
                {firstMatchTime}
              </p>
            </div>
          </div>

          {/* Teams Grid - Modern Cards - COMPACT */}
          <div
            className="grid gap-1.5 px-2 mb-2"
            style={{ gridTemplateColumns: `repeat(${activeTeams.length}, minmax(0, 1fr))` }}
          >
            {activeTeams.map((color) => {
              const style = teamStyles[color];
              const players = sortPlayers(teamsByColor[color] || []);
              const fieldPlayers = players.filter(p => p.profiles.position !== "goleiro");
              const goalkeepers = players.filter(p => p.profiles.position === "goleiro");

              return (
                <div
                  key={color}
                  className={`rounded-lg overflow-hidden backdrop-blur-sm ${style.border || ""} ${style.glow ? `shadow-lg ${style.glow}` : ""}`}
                >
                  {/* Team Header - Gradient */}
                  <div className={`${style.headerBg} ${style.headerText} py-1.5 px-1.5 text-center`}>
                    <span className="font-bold text-[11px] tracking-wide drop-shadow-sm">
                      {teamDisplayNames[color]}
                    </span>
                  </div>

                  {/* Players List - Glass effect - COMPACT with full names */}
                  <div className={`${style.cardBg} px-1.5 py-1.5 space-y-0.5 backdrop-blur-sm`}>
                    {fieldPlayers.map((player, idx) => (
                      <div key={player.id} className="flex items-center gap-1">
                        <span className="font-bold text-zinc-500 w-4 text-center text-[8px] shrink-0">
                          {getPositionLabel(player, idx)}
                        </span>
                        <span className="text-white/90 text-[10px] font-medium leading-tight">
                          {getPlayerDisplay(player)}
                        </span>
                      </div>
                    ))}
                    {goalkeepers.map((player) => (
                      <div key={player.id} className="flex items-center gap-1 mt-1 pt-1 border-t border-white/10">
                        <span className="font-bold text-zinc-500 w-4 text-center text-[8px] shrink-0">GK</span>
                        <span className="text-white/90 text-[10px] font-medium leading-tight">
                          {getPlayerDisplay(player)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Divider - COMPACT */}
          <div className="px-4 mb-2">
            <div className="h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
          </div>

          {/* Jogos Section - Modern - COMPACT - CENTERED */}
          <div className="flex-1 px-6">
            {/* Centered title without pink bar */}
            <h2 className="text-white text-sm font-semibold mb-2 tracking-tight text-center">

            </h2>

            {/* Centered container for compact cards */}
            <div className="flex flex-col items-center space-y-1.5">
              {matches.map((match) => {
                const homeStyle = teamStyles[match.team_home];
                const awayStyle = teamStyles[match.team_away];

                return (
                  <div
                    key={match.id}
                    className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-white/5"
                  >
                    {/* Time */}
                    <div className="flex flex-col items-center min-w-[30px]">
                      <span className="text-white text-xs font-semibold tabular-nums">
                        {formatTime(match.scheduled_time)}
                      </span>
                      <span className="text-zinc-500 text-[8px] uppercase tracking-wider">
                        Jogo {match.match_number}
                      </span>
                    </div>

                    {/* Divider */}
                    <div className="w-px h-6 bg-zinc-700/50" />

                    {/* Match badges - Aumentado e Centralizado */}
                    <div className="flex items-center gap-3">
                      {/* Home Team Badge */}
                      <span className={`${homeStyle.badgeBg} ${homeStyle.badgeText} w-[75px] text-center py-1 rounded-md text-[10px] font-bold shadow-sm`}>
                        {teamDisplayNames[match.team_home]}
                      </span>

                      {/* X centralizado */}
                      <span className="text-zinc-600 text-[10px] font-medium w-4 text-center">×</span>

                      {/* Away Team Badge */}
                      <span className={`${awayStyle.badgeBg} ${awayStyle.badgeText} w-[75px] text-center py-1 rounded-md text-[10px] font-bold shadow-sm`}>
                        {teamDisplayNames[match.team_away]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer - Modern - COMPACT - Swapped text styles */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-center gap-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-zinc-700/50" />
              {/* Soccer ball image instead of emoji */}
              <img src={iconBall} alt="⚽" className="w-4 h-4 object-contain opacity-80" />
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-zinc-700/50" />
            </div>
            <div className="text-center mt-1.5">
              {/* Swapped: Top text now has white/medium style, bottom has smaller/muted style */}
              <p className="text-zinc-400 text-[10px] font-medium tracking-wide">
                Temporada 2026
              </p>
              <p className="text-zinc-500 text-[8px] font-light tracking-[0.15em] uppercase">
                Cozidos Futebol Clube
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ShareableTeamsView.displayName = "ShareableTeamsView";
