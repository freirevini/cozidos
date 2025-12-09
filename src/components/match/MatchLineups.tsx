import { useState } from "react";
import { TeamLogo } from "./TeamLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Formation = "2-2-1" | "2-1-2";
type Position = "goleiro" | "defensor" | "meio-campista" | "atacante";

interface Player {
  id: string;
  name: string;
  nickname: string | null;
  position: Position;
  level?: string;
}

interface MatchLineupsProps {
  teamHome: string;
  teamAway: string;
  homePlayers: Player[];
  awayPlayers: Player[];
  substitutions?: Array<{
    minute: number;
    team_color: string;
    in: Player;
    out: Player;
  }>;
  className?: string;
}

const teamNames: Record<string, string> = {
  branco: "BRANCO",
  vermelho: "VERMELHO",
  azul: "AZUL",
  laranja: "LARANJA",
};

// Distribuir jogadores por posição na formação
function distributePlayers(players: Player[], formation: Formation): {
  goalkeeper: Player[];
  defenders: Player[];
  midfielders: Player[];
  forwards: Player[];
  reserves: Player[];
} {
  const byPosition = {
    goleiro: players.filter((p) => p.position === "goleiro"),
    defensor: players.filter((p) => p.position === "defensor"),
    "meio-campista": players.filter((p) => p.position === "meio-campista"),
    atacante: players.filter((p) => p.position === "atacante"),
  };

  const result = {
    goalkeeper: [] as Player[],
    defenders: [] as Player[],
    midfielders: [] as Player[],
    forwards: [] as Player[],
    reserves: [] as Player[],
  };

  // Goleiro (sempre 1)
  result.goalkeeper = byPosition.goleiro.slice(0, 1);
  const usedIds = new Set(result.goalkeeper.map((p) => p.id));

  if (formation === "2-2-1") {
    // 2 defensores
    result.defenders = byPosition.defensor.slice(0, 2);
    result.defenders.forEach((p) => usedIds.add(p.id));

    // Se faltar defensor, usar meio-campista
    while (result.defenders.length < 2) {
      const available = byPosition["meio-campista"].find((p) => !usedIds.has(p.id));
      if (available) {
        result.defenders.push(available);
        usedIds.add(available.id);
      } else break;
    }

    // 2 meio-campistas
    const availableMidfielders = byPosition["meio-campista"].filter((p) => !usedIds.has(p.id));
    result.midfielders = availableMidfielders.slice(0, 2);
    result.midfielders.forEach((p) => usedIds.add(p.id));

    // Se faltar meio-campista, usar defensor ou atacante
    while (result.midfielders.length < 2) {
      const available =
        byPosition.defensor.find((p) => !usedIds.has(p.id)) ||
        byPosition.atacante.find((p) => !usedIds.has(p.id));
      if (available) {
        result.midfielders.push(available);
        usedIds.add(available.id);
      } else break;
    }

    // 1 atacante
    const availableForwards = byPosition.atacante.filter((p) => !usedIds.has(p.id));
    result.forwards = availableForwards.slice(0, 1);
    result.forwards.forEach((p) => usedIds.add(p.id));

    // Se faltar atacante, usar meio-campista
    if (result.forwards.length === 0) {
      const available = byPosition["meio-campista"].find((p) => !usedIds.has(p.id));
      if (available) {
        result.forwards.push(available);
        usedIds.add(available.id);
      }
    }
  } else {
    // Formação 2-1-2
    // 2 defensores
    result.defenders = byPosition.defensor.slice(0, 2);
    result.defenders.forEach((p) => usedIds.add(p.id));

    while (result.defenders.length < 2) {
      const available = byPosition["meio-campista"].find((p) => !usedIds.has(p.id));
      if (available) {
        result.defenders.push(available);
        usedIds.add(available.id);
      } else break;
    }

    // 1 meio-campista
    const availableMidfielders = byPosition["meio-campista"].filter((p) => !usedIds.has(p.id));
    result.midfielders = availableMidfielders.slice(0, 1);
    result.midfielders.forEach((p) => usedIds.add(p.id));

    if (result.midfielders.length === 0) {
      const available =
        byPosition.defensor.find((p) => !usedIds.has(p.id)) ||
        byPosition.atacante.find((p) => !usedIds.has(p.id));
      if (available) {
        result.midfielders.push(available);
        usedIds.add(available.id);
      }
    }

    // 2 atacantes
    const availableForwards = byPosition.atacante.filter((p) => !usedIds.has(p.id));
    result.forwards = availableForwards.slice(0, 2);
    result.forwards.forEach((p) => usedIds.add(p.id));

    while (result.forwards.length < 2) {
      const available =
        byPosition["meio-campista"].find((p) => !usedIds.has(p.id)) ||
        byPosition.defensor.find((p) => !usedIds.has(p.id));
      if (available) {
        result.forwards.push(available);
        usedIds.add(available.id);
      } else break;
    }
  }

  // Reservas: jogadores não usados
  result.reserves = players.filter((p) => !usedIds.has(p.id));

  return result;
}

function FieldFormation({
  players,
  formation,
  teamColor,
}: {
  players: Player[];
  formation: Formation;
  teamColor: string;
}) {
  const { goalkeeper, defenders, midfielders, forwards } = distributePlayers(players, formation);

    const PlayerSlot = ({ player, className }: { player?: Player; className?: string }) => {
      if (!player) {
        return (
          <div
            className={cn(
              "w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-xs text-muted-foreground",
              className
            )}
          >
            -
          </div>
        );
      }

      return (
        <div
          className={cn(
            "w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/20 border-2 border-primary flex flex-col items-center justify-center text-[10px] sm:text-xs font-medium text-foreground p-1",
            className
          )}
          title={player.nickname || player.name}
        >
          <span className="truncate w-full text-center leading-tight">
            {player.nickname || player.name}
          </span>
        </div>
      );
    };

  return (
    <div className="relative w-full aspect-[3/4] bg-gradient-to-b from-green-600 to-green-800 rounded-lg border-4 border-green-700 p-4">
      {/* Linhas do campo */}
      <div className="absolute inset-0 border-2 border-white/20 rounded-lg" />
      <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/20" />
      <div className="absolute top-1/3 left-0 right-0 h-0.5 bg-white/10" />
      <div className="absolute bottom-1/3 left-0 right-0 h-0.5 bg-white/10" />

      {/* Área do goleiro */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
        <PlayerSlot player={goalkeeper[0]} />
      </div>

      {/* Linha de defesa */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-8">
        <PlayerSlot player={defenders[0]} />
        <PlayerSlot player={defenders[1]} />
      </div>

      {/* Linha de meio (varia conforme formação) */}
      {formation === "2-2-1" ? (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-8">
          <PlayerSlot player={midfielders[0]} />
          <PlayerSlot player={midfielders[1]} />
        </div>
      ) : (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <PlayerSlot player={midfielders[0]} />
        </div>
      )}

      {/* Linha de ataque */}
      {formation === "2-2-1" ? (
        <div className="absolute top-16 left-1/2 -translate-x-1/2">
          <PlayerSlot player={forwards[0]} />
        </div>
      ) : (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 flex gap-8">
          <PlayerSlot player={forwards[0]} />
          <PlayerSlot player={forwards[1]} />
        </div>
      )}
    </div>
  );
}

export function MatchLineups({
  teamHome,
  teamAway,
  homePlayers,
  awayPlayers,
  substitutions = [],
  className,
}: MatchLineupsProps) {
  const [homeFormation, setHomeFormation] = useState<Formation>("2-2-1");
  const [awayFormation, setAwayFormation] = useState<Formation>("2-2-1");

  const homeSubs = substitutions.filter((s) => s.team_color === teamHome);
  const awaySubs = substitutions.filter((s) => s.team_color === teamAway);

  return (
    <div className={cn("space-y-8 sm:space-y-12", className)}>
      {/* Time Casa */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <TeamLogo teamColor={teamHome as any} size="sm" />
            <h3 className="text-base sm:text-lg font-bold uppercase">{teamNames[teamHome] || teamHome}</h3>
          </div>
          <div className="flex gap-2">
            <Button
              variant={homeFormation === "2-2-1" ? "default" : "outline"}
              size="sm"
              onClick={() => setHomeFormation("2-2-1")}
              className="min-h-[40px] text-xs sm:text-sm"
            >
              2-2-1
            </Button>
            <Button
              variant={homeFormation === "2-1-2" ? "default" : "outline"}
              size="sm"
              onClick={() => setHomeFormation("2-1-2")}
              className="min-h-[40px] text-xs sm:text-sm"
            >
              2-1-2
            </Button>
          </div>
        </div>

        <div className="w-full max-w-md mx-auto">
          <FieldFormation players={homePlayers} formation={homeFormation} teamColor={teamHome} />
        </div>

        {/* Substituições */}
        {homeSubs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">Substituições</h4>
            {homeSubs.map((sub, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{sub.minute}'</span>
                <span className="text-green-500">
                  {sub.in.nickname || sub.in.name}
                </span>
                <span className="text-muted-foreground">/</span>
                <span className="text-red-500">
                  {sub.out.nickname || sub.out.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Time Visitante */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <TeamLogo teamColor={teamAway as any} size="sm" />
            <h3 className="text-base sm:text-lg font-bold uppercase">{teamNames[teamAway] || teamAway}</h3>
          </div>
          <div className="flex gap-2">
            <Button
              variant={awayFormation === "2-2-1" ? "default" : "outline"}
              size="sm"
              onClick={() => setAwayFormation("2-2-1")}
              className="min-h-[40px] text-xs sm:text-sm"
            >
              2-2-1
            </Button>
            <Button
              variant={awayFormation === "2-1-2" ? "default" : "outline"}
              size="sm"
              onClick={() => setAwayFormation("2-1-2")}
              className="min-h-[40px] text-xs sm:text-sm"
            >
              2-1-2
            </Button>
          </div>
        </div>

        <div className="w-full max-w-md mx-auto">
          <FieldFormation players={awayPlayers} formation={awayFormation} teamColor={teamAway} />
        </div>

        {/* Substituições */}
        {awaySubs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">Substituições</h4>
            {awaySubs.map((sub, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{sub.minute}'</span>
                <span className="text-green-500">
                  {sub.in.nickname || sub.in.name}
                </span>
                <span className="text-muted-foreground">/</span>
                <span className="text-red-500">
                  {sub.out.nickname || sub.out.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

