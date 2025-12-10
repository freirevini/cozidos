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
  // Counter-transform to keep player nodes upright despite field rotation
  const counterTransformStyle = {
    transform: 'rotateX(-35deg)',
    transformOrigin: 'center center',
  };

  if (!player) {
    return (
      <div 
        className={cn("flex flex-col items-center gap-1", className)}
        style={counterTransformStyle}
      >
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center bg-black/20">
          <span className="text-white/40 text-xs">-</span>
        </div>
      </div>
    );
  }

  const displayName = player.nickname || player.name.split(" ")[0];
  const initials = getInitials(player.name);

  return (
    <div 
      className={cn("flex flex-col items-center gap-1.5 max-w-[80px] sm:max-w-[90px]", className)}
      style={counterTransformStyle}
    >
      <Avatar className="w-14 h-14 sm:w-16 sm:h-16 border-2 border-white/40 shadow-lg ring-2 ring-black/20">
        {player.avatar_url ? (
          <AvatarImage src={player.avatar_url} alt={player.name} className="object-cover" />
        ) : null}
        <AvatarFallback className="bg-primary/40 text-primary-foreground font-bold text-sm sm:text-base">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="text-[10px] sm:text-xs font-semibold text-white text-center truncate w-full leading-tight drop-shadow-md">
        {displayName}
      </span>
    </div>
  );
}

function FieldFormation({ players }: { players: Player[] }) {
  const { goalkeeper, defenders, midfielders, forwards } = distributePlayers(players);

  return (
    <div 
      className="relative w-full"
      style={{
        perspective: '1000px',
        perspectiveOrigin: 'center 90%',
      }}
    >
      {/* 3D Field Plane - gentler tilt like MLS reference */}
      <div 
        className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden"
        style={{
          transform: 'rotateX(35deg)',
          transformStyle: 'preserve-3d',
          transformOrigin: 'center bottom',
          background: 'linear-gradient(to bottom, #1a3d25 0%, #1e4a2d 30%, #234f32 60%, #2a5a3a 100%)',
        }}
      >
        {/* Field lines */}
        <div className="absolute inset-4 sm:inset-5 border-2 border-white/15 rounded-lg" />
        
        {/* Center line */}
        <div className="absolute top-[45%] left-4 right-4 sm:left-5 sm:right-5 h-0.5 bg-white/15" />
        
        {/* Center circle */}
        <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 sm:w-20 sm:h-20 border-2 border-white/15 rounded-full" />
        
        {/* Goal area */}
        <div className="absolute bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 w-32 sm:w-40 h-12 sm:h-14 border-2 border-white/15 border-b-0 rounded-t-lg" />
        
        {/* Penalty arc */}
        <div className="absolute bottom-[60px] sm:bottom-[70px] left-1/2 -translate-x-1/2 w-14 sm:w-16 h-6 sm:h-8 border-2 border-white/15 border-b-0 rounded-t-full" />

        {/* Subtle fade at top for depth */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 25%)',
          }}
        />

        {/* Semi-transparent goalkeeper zone */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-[22%] pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.25) 0%, transparent 100%)',
          }}
        />

        {/* Player positions - Formation 2-2-1 (outfield) + Goalkeeper */}
        
        {/* Atacante (1) - Top */}
        <div className="absolute top-[8%] left-1/2 -translate-x-1/2">
          <PlayerSlot player={forwards[0] || null} />
        </div>

        {/* Meio-campistas (2) */}
        <div className="absolute top-[32%] left-1/2 -translate-x-1/2 flex gap-20 sm:gap-28">
          <PlayerSlot player={midfielders[0] || null} />
          <PlayerSlot player={midfielders[1] || null} />
        </div>

        {/* Defensores (2) */}
        <div className="absolute top-[55%] left-1/2 -translate-x-1/2 flex gap-20 sm:gap-28">
          <PlayerSlot player={defenders[0] || null} />
          <PlayerSlot player={defenders[1] || null} />
        </div>

        {/* Goleiro (1) - Bottom */}
        <div className="absolute bottom-[4%] left-1/2 -translate-x-1/2">
          <PlayerSlot player={goalkeeper} />
        </div>
      </div>
    </div>
  );
}

export function MatchLineups({ teamHome, teamAway, homePlayers, awayPlayers, className }: MatchLineupsProps) {
  const [selectedTeam, setSelectedTeam] = useState<"home" | "away">("home");

  const currentPlayers = selectedTeam === "home" ? homePlayers : awayPlayers;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Team selector */}
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

      {/* Formation - showing only outfield players */}
      <div className="text-center">
        <span className="text-lg sm:text-xl font-bold text-foreground">2-2-1</span>
      </div>

      {/* 3D Field with players */}
      <div className="w-full max-w-sm mx-auto px-2">
        <FieldFormation players={currentPlayers} />
      </div>
    </div>
  );
}
