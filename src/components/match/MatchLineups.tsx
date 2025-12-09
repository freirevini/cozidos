import { useState } from "react";
import { TeamLogo } from "./TeamLogo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Position = "goleiro" | "defensor" | "meio-campista" | "atacante";

interface Player {
  id: string;
  name: string;
  nickname: string | null;
  position: Position | null;
  level?: string;
  avatar_url?: string;
}

interface MatchLineupsProps {
  teamHome: string;
  teamAway: string;
  homePlayers: Player[];
  awayPlayers: Player[];
  className?: string;
}

const teamNames: Record<string, string> = {
  branco: "BRA",
  vermelho: "VER",
  azul: "AZU",
  laranja: "LAR",
};

const teamFullNames: Record<string, string> = {
  branco: "BRANCO",
  vermelho: "VERMELHO",
  azul: "AZUL",
  laranja: "LARANJA",
};

// Formação fixa 3-2-1 (1 goleiro, 2 defesa, 2 meio, 1 ataque)
function distributePlayers(players: Player[]): {
  goalkeeper: Player | null;
  defenders: Player[];
  midfielders: Player[];
  forwards: Player[];
} {
  const byPosition = {
    goleiro: players.filter((p) => p.position === "goleiro"),
    defensor: players.filter((p) => p.position === "defensor"),
    "meio-campista": players.filter((p) => p.position === "meio-campista"),
    atacante: players.filter((p) => p.position === "atacante"),
    outros: players.filter((p) => !p.position),
  };

  const usedIds = new Set<string>();

  // 1 Goleiro
  const goalkeeper = byPosition.goleiro[0] || null;
  if (goalkeeper) usedIds.add(goalkeeper.id);

  // 2 Defensores
  const defenders: Player[] = [];
  byPosition.defensor.forEach((p) => {
    if (defenders.length < 2 && !usedIds.has(p.id)) {
      defenders.push(p);
      usedIds.add(p.id);
    }
  });
  // Preencher com meio-campistas se necessário
  if (defenders.length < 2) {
    byPosition["meio-campista"].forEach((p) => {
      if (defenders.length < 2 && !usedIds.has(p.id)) {
        defenders.push(p);
        usedIds.add(p.id);
      }
    });
  }

  // 2 Meio-campistas
  const midfielders: Player[] = [];
  byPosition["meio-campista"].forEach((p) => {
    if (midfielders.length < 2 && !usedIds.has(p.id)) {
      midfielders.push(p);
      usedIds.add(p.id);
    }
  });
  // Preencher com defensores ou atacantes se necessário
  if (midfielders.length < 2) {
    [...byPosition.defensor, ...byPosition.atacante].forEach((p) => {
      if (midfielders.length < 2 && !usedIds.has(p.id)) {
        midfielders.push(p);
        usedIds.add(p.id);
      }
    });
  }

  // 1 Atacante
  const forwards: Player[] = [];
  byPosition.atacante.forEach((p) => {
    if (forwards.length < 1 && !usedIds.has(p.id)) {
      forwards.push(p);
      usedIds.add(p.id);
    }
  });
  // Preencher com meio-campistas se necessário
  if (forwards.length < 1) {
    byPosition["meio-campista"].forEach((p) => {
      if (forwards.length < 1 && !usedIds.has(p.id)) {
        forwards.push(p);
        usedIds.add(p.id);
      }
    });
  }

  return { goalkeeper, defenders, midfielders, forwards };
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function PlayerSlot({ player, className }: { player: Player | null; className?: string }) {
  if (!player) {
    return (
      <div className={cn("flex flex-col items-center gap-1", className)}>
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
          <span className="text-muted-foreground text-xs">-</span>
        </div>
      </div>
    );
  }

  const displayName = player.nickname || player.name.split(" ")[0];
  const initials = getInitials(player.name);

  return (
    <div className={cn("flex flex-col items-center gap-1 max-w-[70px] sm:max-w-[80px]", className)}>
      <Avatar className="w-12 h-12 sm:w-14 sm:h-14 border-2 border-primary/50">
        {player.avatar_url ? (
          <AvatarImage src={player.avatar_url} alt={player.name} />
        ) : null}
        <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm sm:text-base">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="text-[10px] sm:text-xs font-medium text-foreground text-center truncate w-full leading-tight">
        {displayName}
      </span>
    </div>
  );
}

function FieldFormation({ players }: { players: Player[] }) {
  const { goalkeeper, defenders, midfielders, forwards } = distributePlayers(players);

  return (
    <div className="relative w-full aspect-[3/4] bg-gradient-to-b from-green-700 to-green-900 rounded-xl overflow-hidden">
      {/* Linhas do campo */}
      <div className="absolute inset-2 sm:inset-3 border-2 border-white/20 rounded-lg" />
      <div className="absolute top-1/2 left-2 right-2 sm:left-3 sm:right-3 h-0.5 bg-white/20" />
      
      {/* Círculo central */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 sm:w-20 sm:h-20 border-2 border-white/20 rounded-full" />
      
      {/* Área do gol */}
      <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 w-24 sm:w-32 h-8 sm:h-10 border-2 border-white/20 border-b-0 rounded-t-lg" />

      {/* Posições dos jogadores - Formação 1-2-2-1 */}
      
      {/* Atacante (1) - Topo */}
      <div className="absolute top-6 sm:top-8 left-1/2 -translate-x-1/2">
        <PlayerSlot player={forwards[0] || null} />
      </div>

      {/* Meio-campistas (2) */}
      <div className="absolute top-[35%] left-1/2 -translate-x-1/2 flex gap-8 sm:gap-12">
        <PlayerSlot player={midfielders[0] || null} />
        <PlayerSlot player={midfielders[1] || null} />
      </div>

      {/* Defensores (2) */}
      <div className="absolute top-[60%] left-1/2 -translate-x-1/2 flex gap-8 sm:gap-12">
        <PlayerSlot player={defenders[0] || null} />
        <PlayerSlot player={defenders[1] || null} />
      </div>

      {/* Goleiro (1) - Base */}
      <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2">
        <PlayerSlot player={goalkeeper} />
      </div>
    </div>
  );
}

export function MatchLineups({ teamHome, teamAway, homePlayers, awayPlayers, className }: MatchLineupsProps) {
  const [selectedTeam, setSelectedTeam] = useState<"home" | "away">("home");

  const currentPlayers = selectedTeam === "home" ? homePlayers : awayPlayers;
  const currentTeam = selectedTeam === "home" ? teamHome : teamAway;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Seletor de times estilo NSH/MTL */}
      <div className="flex justify-center">
        <div className="inline-flex bg-muted/30 rounded-full p-1">
          <button
            onClick={() => setSelectedTeam("home")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full transition-all min-h-[44px]",
              selectedTeam === "home"
                ? "bg-primary text-primary-foreground shadow-lg"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <TeamLogo teamColor={teamHome as any} size="xs" />
            <span className="font-bold text-sm">{teamNames[teamHome]}</span>
          </button>
          <button
            onClick={() => setSelectedTeam("away")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full transition-all min-h-[44px]",
              selectedTeam === "away"
                ? "bg-primary text-primary-foreground shadow-lg"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <TeamLogo teamColor={teamAway as any} size="xs" />
            <span className="font-bold text-sm">{teamNames[teamAway]}</span>
          </button>
        </div>
      </div>

      {/* Formação */}
      <div className="text-center">
        <span className="text-lg sm:text-xl font-bold text-foreground">1-2-2-1</span>
      </div>

      {/* Campo com jogadores */}
      <div className="w-full max-w-sm mx-auto">
        <FieldFormation players={currentPlayers} />
      </div>

      {/* Nome do time */}
      <div className="text-center">
        <span className="text-sm text-muted-foreground">{teamFullNames[currentTeam]}</span>
      </div>
    </div>
  );
}
