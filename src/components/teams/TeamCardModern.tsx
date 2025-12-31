import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { TeamLogo } from "@/components/match/TeamLogo";

type TeamColor = "branco" | "vermelho" | "azul" | "laranja";

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

interface TeamCardModernProps {
  teamColor: TeamColor;
  players: TeamPlayer[];
  onClick?: () => void;
  className?: string;
}

const teamColorMap: Record<string, string> = {
  vermelho: "Vermelho",
  azul: "Azul",
  branco: "Branco",
  laranja: "Laranja",
};

// Ordenar por nível (A, B, C, D, E) e depois goleiros
const levelOrder: Record<string, number> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
};

export function TeamCardModern({ teamColor, players, onClick, className }: TeamCardModernProps) {
  const navigate = useNavigate();

  // Separar goleiros dos jogadores de linha
  const goalkeepers = players.filter(p => p.profiles.position === "goleiro");
  const fieldPlayers = players.filter(p => p.profiles.position !== "goleiro");

  // Ordenar jogadores de linha por nível
  const sortedFieldPlayers = [...fieldPlayers].sort((a, b) => {
    const levelA = levelOrder[a.profiles.level || "E"] ?? 5;
    const levelB = levelOrder[b.profiles.level || "E"] ?? 5;
    return levelA - levelB;
  });

  // Todos os jogadores ordenados: linha primeiro, depois goleiros
  const allPlayers = [...sortedFieldPlayers, ...goalkeepers];

  const handlePlayerClick = (e: React.MouseEvent, playerId: string) => {
    e.stopPropagation();
    navigate(`/profile/${playerId}`);
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl bg-card/80 backdrop-blur-sm",
        "border border-border/20 shadow-lg",
        "transition-all duration-300",
        "hover:shadow-primary/10 hover:shadow-xl hover:border-primary/20",
        onClick && "cursor-pointer active:scale-[0.98]",
        "p-4",
        className
      )}
    >
      {/* Header compacto com logo e nome */}
      <div className="flex items-center gap-3 mb-4">
        <TeamLogo teamColor={teamColor} size="md" />
        <div>
          <h3 className="text-lg font-bold uppercase tracking-wide text-primary">
            {teamColorMap[teamColor] || teamColor}
          </h3>
          <span className="text-xs text-muted-foreground">
            {players.length} jogadores
          </span>
        </div>
      </div>

      {/* Lista compacta de jogadores */}
      <div className="space-y-1">
        {allPlayers.map((player) => {
          const isGoalkeeper = player.profiles.position === "goleiro";
          const level = player.profiles.level?.toUpperCase();

          return (
            <div
              key={player.id}
              onClick={(e) => handlePlayerClick(e, player.player_id)}
              className="group flex items-center justify-between py-2 px-3 rounded-lg hover:bg-primary/10 transition-all duration-200 cursor-pointer"
            >
              <span className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                {player.profiles.nickname || player.profiles.name}
              </span>

              {/* Badge único de nível - sempre em rosa/primary */}
              <span className={cn(
                "text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ml-2",
                isGoalkeeper
                  ? "bg-muted/30 text-muted-foreground"
                  : "bg-primary/20 text-primary"
              )}>
                {isGoalkeeper ? "GK" : level || "-"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
