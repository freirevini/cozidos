import { cn } from "@/lib/utils";
import { TeamLogo } from "@/components/match/TeamLogo";
import { Badge } from "@/components/ui/badge";

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

// Organizar por nível (A, B, C, D, E) e depois goleiros
const levelOrder: Record<string, number> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
};

const levelColors: Record<string, string> = {
  A: "bg-primary/20 text-primary border-primary/30",
  B: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  C: "bg-green-500/20 text-green-400 border-green-500/30",
  D: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  E: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

export function TeamCardModern({ teamColor, players, onClick, className }: TeamCardModernProps) {
  // Separar goleiros dos jogadores de linha
  const goalkeepers = players.filter(p => p.profiles.position === "goleiro");
  const fieldPlayers = players.filter(p => p.profiles.position !== "goleiro");
  
  // Ordenar jogadores de linha por nível
  const sortedFieldPlayers = [...fieldPlayers].sort((a, b) => {
    const levelA = levelOrder[a.profiles.level || "E"] ?? 5;
    const levelB = levelOrder[b.profiles.level || "E"] ?? 5;
    return levelA - levelB;
  });

  // Agrupar por nível
  const playersByLevel = sortedFieldPlayers.reduce((acc, player) => {
    const level = player.profiles.level || "E";
    if (!acc[level]) acc[level] = [];
    acc[level].push(player);
    return acc;
  }, {} as Record<string, TeamPlayer[]>);

  const renderPlayer = (player: TeamPlayer) => (
    <div
      key={player.id}
      className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/10 hover:bg-muted/20 transition-colors"
    >
      <span className="text-sm font-medium text-foreground truncate">
        {player.profiles.nickname || player.profiles.name}
      </span>
      {player.profiles.level && (
        <Badge 
          variant="outline" 
          className={cn(
            "text-xs font-bold ml-2 shrink-0",
            levelColors[player.profiles.level] || "bg-muted/20 text-muted-foreground"
          )}
        >
          {player.profiles.level}
        </Badge>
      )}
    </div>
  );

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl bg-card/80 backdrop-blur-sm",
        "border border-border/20 shadow-lg",
        "transition-all duration-300",
        "hover:shadow-primary/10 hover:shadow-xl hover:border-primary/20",
        onClick && "cursor-pointer active:scale-[0.98]",
        "p-5",
        className
      )}
    >
      {/* Header com logo e nome */}
      <div className="flex flex-col items-center mb-5">
        <TeamLogo teamColor={teamColor} size="lg" />
        <h3 className="text-xl font-bold uppercase tracking-wide text-primary mt-3">
          {teamColorMap[teamColor] || teamColor}
        </h3>
        <span className="text-sm text-muted-foreground">
          {players.length} jogadores
        </span>
      </div>

      {/* Lista de jogadores por nível */}
      <div className="space-y-4">
        {/* Jogadores de linha por nível */}
        {["A", "B", "C", "D", "E"].map((level) => {
          const levelPlayers = playersByLevel[level];
          if (!levelPlayers || levelPlayers.length === 0) return null;
          
          return (
            <div key={level} className="space-y-1.5">
              <div className="flex items-center gap-2 mb-2">
                <Badge 
                  variant="outline" 
                  className={cn("text-xs font-bold", levelColors[level])}
                >
                  {level}
                </Badge>
                <div className="h-px flex-1 bg-border/30" />
              </div>
              <div className="space-y-1.5">
                {levelPlayers.map(renderPlayer)}
              </div>
            </div>
          );
        })}

        {/* Goleiros */}
        {goalkeepers.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2 py-0.5 rounded bg-muted/20">
                GK
              </span>
              <div className="h-px flex-1 bg-border/30" />
            </div>
            <div className="space-y-1.5">
              {goalkeepers.map(renderPlayer)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
