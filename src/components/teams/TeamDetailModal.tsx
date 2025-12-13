import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface TeamDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamColor: TeamColor | null;
  players: TeamPlayer[];
}

const teamColorMap: Record<string, string> = {
  vermelho: "Vermelho",
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
  goleiro: "Goleiro",
  defensor: "Defensor",
  "meio-campista": "Meio-Campista",
  atacante: "Atacante",
};

export function TeamDetailModal({ open, onOpenChange, teamColor, players }: TeamDetailModalProps) {
  if (!teamColor) return null;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="items-center pb-4">
          <TeamLogo teamColor={teamColor} size="xl" />
          <DialogTitle className="text-2xl font-bold uppercase mt-2">
            Time {teamColorMap[teamColor]}
          </DialogTitle>
          <p className="text-muted-foreground">{players.length} jogadores</p>
        </DialogHeader>

        <div className="space-y-4">
          {Object.entries(playersByPosition).map(([position, posPlayers]) => (
            <div key={position}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-primary uppercase">
                  {positionLabels[position] || position}
                </h3>
                <div className="h-px flex-1 bg-border/50" />
                <span className="text-xs text-muted-foreground">
                  {posPlayers.length}
                </span>
              </div>
              <div className="space-y-2">
                {posPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        {player.profiles.nickname || player.profiles.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {player.profiles.name}
                      </p>
                    </div>
                    {player.profiles.level && (
                      <Badge variant="outline" className="ml-2 text-primary border-primary/30">
                        Nível {player.profiles.level.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
