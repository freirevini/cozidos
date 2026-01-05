import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { TeamLogo } from "@/components/match/TeamLogo";

type TeamColor = "branco" | "preto" | "azul" | "laranja";

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

interface TeamCardProps {
  teamColor: TeamColor;
  players: TeamPlayer[];
  onClick?: () => void;
  compact?: boolean;
  className?: string;
}

const teamColorMap: Record<string, string> = {
  preto: "preto",
  azul: "Azul",
  branco: "Branco",
  laranja: "Laranja",
};

const positionOrder: Record<string, number> = {
  goleiro: 0,
  defensor: 1,
  "meio-campista": 2,
  atacante: 3,
};

const positionLabels: Record<string, string> = {
  goleiro: "GK",
  defensor: "DEF",
  "meio-campista": "MID",
  atacante: "ATK",
};

export function TeamCard({ teamColor, players, onClick, compact = false, className }: TeamCardProps) {
  // Ordenar jogadores por posição
  const sortedPlayers = [...players].sort((a, b) => {
    const posA = positionOrder[a.profiles.position || ""] ?? 99;
    const posB = positionOrder[b.profiles.position || ""] ?? 99;
    return posA - posB;
  });

  // Agrupar por posição
  const playersByPosition = sortedPlayers.reduce((acc, player) => {
    const position = player.profiles.position || "outro";
    if (!acc[position]) acc[position] = [];
    acc[position].push(player);
    return acc;
  }, {} as Record<string, TeamPlayer[]>);

  const navigate = useNavigate();

  const handlePlayerClick = (e: React.MouseEvent, playerId: string) => {
    e.stopPropagation();
    navigate(`/profile/${playerId}`);
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-2xl bg-gradient-to-b from-card/90 to-card/50 backdrop-blur-sm",
        "border border-border/30 shadow-lg transition-all duration-300",
        "hover:shadow-primary/20 hover:shadow-xl hover:border-primary/30",
        onClick && "cursor-pointer active:scale-[0.98]",
        compact ? "p-4 min-w-[280px]" : "p-6",
        className
      )}
    >
      {/* Header com logo e nome */}
      <div className="flex flex-col items-center mb-4">
        <TeamLogo teamColor={teamColor} size={compact ? "lg" : "xl"} />
        <h3 className={cn(
          "font-bold uppercase tracking-wide text-foreground mt-2",
          compact ? "text-lg" : "text-xl"
        )}>
          {teamColorMap[teamColor] || teamColor}
        </h3>
        <span className="text-sm text-muted-foreground">
          {players.length} jogadores
        </span>
      </div>

      {/* Lista de jogadores por posição */}
      <div className="space-y-3">
        {Object.entries(playersByPosition).map(([position, posPlayers]) => (
          <div key={position} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                {positionLabels[position] || position}
              </span>
              <div className="h-px flex-1 bg-border/50" />
            </div>
            <div className="space-y-1">
              {posPlayers.map((player) => (
                <div
                  key={player.id}
                  onClick={(e) => handlePlayerClick(e, player.player_id)}
                  className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-muted/20 hover:bg-muted/40 hover:text-primary transition-colors cursor-pointer"
                >
                  <span className="text-sm font-medium text-foreground truncate">
                    {player.profiles.nickname || player.profiles.name}
                  </span>
                  {player.profiles.level && (
                    <span className="text-xs text-primary font-bold ml-2">
                      {player.profiles.level.toUpperCase()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
