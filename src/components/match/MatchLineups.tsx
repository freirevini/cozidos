import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { TeamLogo } from "./TeamLogo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { PlayerEventBadges } from "./PlayerEventBadges";
import { useMatchPlayerEvents, PlayerEventCounts } from "@/hooks/useMatchPlayerEvents";
import { useMatchSubstitutions } from "@/hooks/useMatchSubstitutions";
import { Skeleton } from "@/components/ui/skeleton";
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
  matchId?: string;
  matchYear?: number;
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

  // 2 Defenders
  const defenders: Player[] = [];
  byPosition.defensor.forEach((p) => {
    if (defenders.length < 2 && !usedIds.has(p.id)) {
      defenders.push(p);
      usedIds.add(p.id);
    }
  });
  if (defenders.length < 2) {
    byPosition["meio-campista"].forEach((p) => {
      if (defenders.length < 2 && !usedIds.has(p.id)) {
        defenders.push(p);
        usedIds.add(p.id);
      }
    });
  }

  // 2 Midfielders
  const midfielders: Player[] = [];
  byPosition["meio-campista"].forEach((p) => {
    if (midfielders.length < 2 && !usedIds.has(p.id)) {
      midfielders.push(p);
      usedIds.add(p.id);
    }
  });
  if (midfielders.length < 2) {
    [...byPosition.defensor, ...byPosition.atacante].forEach((p) => {
      if (midfielders.length < 2 && !usedIds.has(p.id)) {
        midfielders.push(p);
        usedIds.add(p.id);
      }
    });
  }

  // 1 Forward
  const forwards: Player[] = [];
  byPosition.atacante.forEach((p) => {
    if (forwards.length < 1 && !usedIds.has(p.id)) {
      forwards.push(p);
      usedIds.add(p.id);
    }
  });
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

// Player positions (percentage from top/left) - MLS style layout
const positions = {
  forward: { x: 50, y: 12 },
  midLeft: { x: 30, y: 35 },
  midRight: { x: 70, y: 35 },
  defLeft: { x: 30, y: 58 },
  defRight: { x: 70, y: 58 },
  goalkeeper: { x: 50, y: 82 },
};

interface PlayerNodeProps {
  player: Player | null;
  position: { x: number; y: number };
  eventData?: PlayerEventCounts | null;
  onPlayerClick?: (playerId: string) => void;
}

function PlayerNode({ player, position, eventData, onPlayerClick }: PlayerNodeProps) {
  if (!player) {
    return (
      <div
        className="absolute flex flex-col items-center gap-1 transition-transform duration-200 hover:scale-110 active:scale-105"
        style={{
          left: `${position.x}%`,
          top: `${position.y}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div
          className="rounded-full border-2 border-dashed border-white/20 flex items-center justify-center bg-black/30"
          style={{ width: 'clamp(44px, 12vw, 64px)', height: 'clamp(44px, 12vw, 64px)' }}
        >
          <span className="text-white/30 text-xs">-</span>
        </div>
      </div>
    );
  }

  const displayName = player.nickname || player.name.split(" ")[0];
  const initials = getInitials(player.name);

  const hasEvents = eventData && (
    eventData.goals_count > 0 ||
    eventData.yellow_count > 0 ||
    eventData.blue_count > 0 ||
    eventData.sub_in_minute !== null
  );

  const handleClick = () => {
    if (onPlayerClick && player.id) {
      onPlayerClick(player.id);
    }
  };

  return (
    <div
      className="absolute flex flex-col items-center gap-1.5 transition-transform duration-200 hover:scale-110 active:scale-105 cursor-pointer z-10"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
        width: 'clamp(60px, 15vw, 80px)',
      }}
      role="button"
      tabIndex={0}
      aria-label={`Jogador: ${player.name}`}
      onClick={handleClick}
    >
      <div className="relative">
        <Avatar
          className="border-2 border-primary/60 shadow-lg shadow-black/40 bg-muted"
          style={{ width: 'clamp(44px, 12vw, 64px)', height: 'clamp(44px, 12vw, 64px)' }}
        >
          {player.avatar_url ? (
            <AvatarImage src={player.avatar_url} alt={player.name} className="object-cover" />
          ) : null}
          <AvatarFallback className="bg-primary/50 text-primary-foreground font-bold text-sm">
            {initials}
          </AvatarFallback>
        </Avatar>
        {hasEvents && (
          <PlayerEventBadges
            goals={eventData.goals_count}
            yellowCards={eventData.yellow_count}
            blueCards={eventData.blue_count}
            subInMinute={eventData.sub_in_minute}
          />
        )}
      </div>
      <span
        className="text-[11px] sm:text-xs font-medium text-white text-center truncate w-full leading-tight drop-shadow-md"
      >
        {displayName}
      </span>
    </div>
  );
}

interface FieldFormationProps {
  players: Player[];
  getPlayerEvents: (playerId: string) => PlayerEventCounts | null;
  onPlayerClick?: (playerId: string) => void;
}

function FieldFormation({ players, getPlayerEvents, onPlayerClick }: FieldFormationProps) {
  const { goalkeeper, defenders, midfielders, forwards } = distributePlayers(players);

  return (
    <div
      className="relative w-full mx-auto"
      style={{
        perspective: '1200px',
        maxWidth: '420px',
      }}
    >
      {/* 3D Field with subtle MLS-style inclination */}
      <div
        className="relative w-full rounded-2xl overflow-hidden"
        style={{
          transform: 'rotateX(18deg) scaleY(0.95)',
          transformOrigin: 'center center',
          height: 'clamp(340px, 60vw, 480px)',
        }}
      >
        {/* Base dark charcoal background - MLS style */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, #0f1112 0%, #1a1d1f 50%, #1f2224 100%)',
          }}
        />

        {/* Subtle spotlight effect */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 90% 70% at 50% 70%, rgba(50,55,60,0.5) 0%, transparent 70%)',
          }}
        />

        {/* Field lines - SVG style clean lines */}
        <div className="absolute inset-0 p-4 sm:p-5">
          {/* Outer border */}
          <div className="absolute inset-4 sm:inset-5 border border-white/15 rounded-lg" />

          {/* Center line */}
          <div className="absolute top-[42%] left-4 right-4 sm:left-5 sm:right-5 h-px bg-white/15" />

          {/* Center circle */}
          <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 sm:w-16 sm:h-16 border border-white/15 rounded-full" />

          {/* Center dot */}
          <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/20 rounded-full" />

          {/* Goal area bottom */}
          <div className="absolute bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 w-28 sm:w-32 h-10 sm:h-12 border border-white/15 border-b-0 rounded-t-md" />

          {/* Penalty arc bottom */}
          <div className="absolute bottom-[52px] sm:bottom-[60px] left-1/2 -translate-x-1/2 w-12 sm:w-14 h-5 sm:h-6 border border-white/15 border-b-0 rounded-t-full" />

          {/* Goal area top (subtle) */}
          <div className="absolute top-4 sm:top-5 left-1/2 -translate-x-1/2 w-28 sm:w-32 h-10 sm:h-12 border border-white/10 border-t-0 rounded-b-md" />
        </div>

        {/* Bottom shadow for depth */}
        <div
          className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)',
          }}
        />

        {/* Player nodes - positioned by percentage */}
        <PlayerNode
          player={forwards[0] || null}
          position={positions.forward}
          eventData={forwards[0] ? getPlayerEvents(forwards[0].id) : null}
          onPlayerClick={onPlayerClick}
        />
        <PlayerNode
          player={midfielders[0] || null}
          position={positions.midLeft}
          eventData={midfielders[0] ? getPlayerEvents(midfielders[0].id) : null}
          onPlayerClick={onPlayerClick}
        />
        <PlayerNode
          player={midfielders[1] || null}
          position={positions.midRight}
          eventData={midfielders[1] ? getPlayerEvents(midfielders[1].id) : null}
          onPlayerClick={onPlayerClick}
        />
        <PlayerNode
          player={defenders[0] || null}
          position={positions.defLeft}
          eventData={defenders[0] ? getPlayerEvents(defenders[0].id) : null}
          onPlayerClick={onPlayerClick}
        />
        <PlayerNode
          player={defenders[1] || null}
          position={positions.defRight}
          eventData={defenders[1] ? getPlayerEvents(defenders[1].id) : null}
          onPlayerClick={onPlayerClick}
        />
        <PlayerNode
          player={goalkeeper}
          position={positions.goalkeeper}
          eventData={goalkeeper ? getPlayerEvents(goalkeeper.id) : null}
          onPlayerClick={onPlayerClick}
        />
      </div>

      {/* Drop shadow below field for 3D effect */}
      <div
        className="absolute -bottom-3 left-4 right-4 h-6 rounded-b-2xl pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), transparent)',
          filter: 'blur(8px)',
        }}
      />
    </div>
  );
}

export function MatchLineups({ teamHome, teamAway, homePlayers, awayPlayers, matchId, matchYear, className }: MatchLineupsProps) {
  const navigate = useNavigate();
  const [selectedTeam, setSelectedTeam] = useState<"home" | "away">("home");
  const { getPlayerEvents } = useMatchPlayerEvents(matchId);
  const { substitutions, loading: subsLoading } = useMatchSubstitutions(matchId);

  // Mapa de jogadores que entraram via substituição -> minuto de entrada
  const subInMinuteMap = useMemo(() => {
    const map = new Map<string, number>();
    substitutions.forEach(s => {
      map.set(s.player_in_id, s.minute);
    });
    console.log('[MatchLineups] subInMinuteMap:', Array.from(map.entries()));
    return map;
  }, [substitutions]);

  // Função que combina eventos do hook com dados de substituição
  const getPlayerEventsWithSub = useCallback((playerId: string): PlayerEventCounts | null => {
    const baseEvents = getPlayerEvents(playerId);
    const subMinute = subInMinuteMap.get(playerId);

    if (baseEvents) {
      return {
        ...baseEvents,
        sub_in_minute: baseEvents.sub_in_minute ?? subMinute ?? null
      };
    }

    // Se não tem eventos mas entrou via substituição, cria objeto mínimo com badge
    if (subMinute !== undefined) {
      console.log(`[MatchLineups] Creating sub badge for player ${playerId}, minute: ${subMinute}`);
      return {
        player_id: playerId,
        goals_count: 0,
        yellow_count: 0,
        blue_count: 0,
        sub_in_minute: subMinute,
        is_starter: false
      };
    }

    return null;
  }, [getPlayerEvents, subInMinuteMap]);

  // Calcula jogadores em campo considerando substituições - usando useCallback
  const getPlayersOnField = useCallback((originalPlayers: Player[], teamColor: string): Player[] => {
    // IDs dos jogadores que saíram
    const playersOutIds = new Set(
      substitutions
        .filter(s => s.team_color === teamColor)
        .map(s => s.player_out_id)
    );

    // Jogadores que entraram (com dados completos)
    const playersIn = substitutions
      .filter(s => s.team_color === teamColor && s.player_in)
      .map(s => ({
        id: s.player_in!.id,
        name: s.player_in!.name,
        nickname: s.player_in!.nickname,
        position: s.player_in!.position as Position | null,
        level: s.player_in!.level,
        avatar_url: s.player_in!.avatar_url,
      }));

    // Titulares que não saíram + jogadores que entraram
    const onField = [
      ...originalPlayers.filter(p => !playersOutIds.has(p.id)),
      ...playersIn
    ];

    console.log(`[MatchLineups] ${teamColor} - Out: ${Array.from(playersOutIds)}, In: ${playersIn.map(p => p.nickname || p.name)}, OnField: ${onField.map(p => p.nickname || p.name)}`);

    return onField;
  }, [substitutions]);

  // Jogadores em campo calculados com useMemo usando a função callback
  const homeOnField = useMemo(() =>
    getPlayersOnField(homePlayers, teamHome),
    [homePlayers, teamHome, getPlayersOnField]
  );

  const awayOnField = useMemo(() =>
    getPlayersOnField(awayPlayers, teamAway),
    [awayPlayers, teamAway, getPlayersOnField]
  );

  const currentPlayers = selectedTeam === "home" ? homeOnField : awayOnField;

  const handlePlayerClick = (playerId: string) => {
    const params = new URLSearchParams();
    if (matchYear) {
      params.set("year", matchYear.toString());
    }
    navigate(`/profile/${playerId}?${params.toString()}`);
  };

  // Loading state enquanto carrega substituições
  if (subsLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex justify-center">
          <Skeleton className="h-12 w-48 rounded-full" />
        </div>
        <div className="flex justify-center">
          <Skeleton className="h-8 w-16" />
        </div>
        <div className="w-full px-2 flex justify-center">
          <Skeleton className="w-full max-w-[420px] h-[340px] rounded-2xl" />
        </div>
      </div>
    );
  }

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

      {/* Formation label */}
      <div className="text-center">
        <span className="text-lg sm:text-xl font-bold text-foreground">2-2-1</span>
      </div>

      {/* 3D Field with players */}
      <div className="w-full px-2">
        <FieldFormation
          players={currentPlayers}
          getPlayerEvents={getPlayerEventsWithSub}
          onPlayerClick={handlePlayerClick}
        />
      </div>
    </div>
  );
}
