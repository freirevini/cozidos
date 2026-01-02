import { cn } from "@/lib/utils";
import { formatMinute } from "@/components/ui/event-item";
import { useNavigate } from "react-router-dom";

export type TimelineEventType = "goal" | "assist" | "amarelo" | "azul" | "substitution" | "match_start" | "match_end";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  minute: number;
  team_color?: string;
  player?: {
    id?: string;
    name: string;
    nickname: string | null;
    avatar_url?: string | null;
  };
  assist?: {
    id?: string;
    name: string;
    nickname: string | null;
    avatar_url?: string | null;
  };
  // For substitution events
  playerOut?: {
    id?: string;
    name: string;
    nickname: string | null;
    avatar_url?: string | null;
  };
  playerIn?: {
    id?: string;
    name: string;
    nickname: string | null;
    avatar_url?: string | null;
  };
  // For own goal events
  is_own_goal?: boolean;
}

interface MatchTimelineProps {
  events: TimelineEvent[];
  teamHome: string;
  teamAway: string;
  maxMinute?: number;
  className?: string;
  matchYear?: number;
}

// Soccer Ball PNG Icon
function GoalIcon() {
  return (
    <img
      src="/assets/icons/ball-icon.png"
      alt="Gol"
      className="w-5 h-5 sm:w-6 sm:h-6 object-contain flex-shrink-0"
    />
  );
}

// Card PNG Icon - Yellow or Blue
function CardIcon({ type }: { type: "amarelo" | "azul" }) {
  const isYellow = type === "amarelo";
  return (
    <img
      src={isYellow ? "/assets/icons/yellow-card.png" : "/assets/icons/blue-card.png"}
      alt={isYellow ? "Cartão Amarelo" : "Cartão Azul"}
      className="w-5 h-5 sm:w-6 sm:h-6 object-contain flex-shrink-0"
    />
  );
}

// Substitution icon - SVG arrows (no background)
function SubstitutionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12v6" className="text-red-500" />
      <path d="M4 18l-3-3" className="text-red-500" />
      <path d="M4 18l3-3" className="text-red-500" />

      <path d="M20 12V6" className="text-emerald-500" />
      <path d="M20 6l3 3" className="text-emerald-500" />
      <path d="M20 6l-3 3" className="text-emerald-500" />

      <path d="M8 12h8" className="text-muted-foreground opacity-50" />
    </svg>
  );
}

// Event text content with proper alignment
function EventContent({
  event,
  side,
  maxMinute = 12,
  onPlayerClick
}: {
  event: TimelineEvent;
  side: "home" | "away";
  maxMinute?: number;
  onPlayerClick?: (playerId: string) => void;
}) {
  const playerName = event.player?.nickname || event.player?.name || "Jogador";
  const assistName = event.assist?.nickname || event.assist?.name;
  const formattedMinute = formatMinute(event.minute, maxMinute);

  const isHome = side === "home";

  const handlePlayerClick = (playerId?: string) => {
    if (playerId && onPlayerClick) {
      onPlayerClick(playerId);
    }
  };

  // Goal event
  if (event.type === "goal") {
    const isOwnGoal = event.is_own_goal === true;
    const displayName = isOwnGoal ? "Gol Contra" : playerName;
    const ownGoalPlayerName = isOwnGoal ? playerName : null;

    return (
      <div className={cn(
        "flex items-center gap-4",
        isHome ? "flex-row justify-end" : "flex-row-reverse justify-end"
      )}>
        {/* Player info */}
        <div className={cn(
          "flex flex-col min-w-0",
          isHome ? "items-end text-right" : "items-start text-left"
        )}>
          <span
            className={cn(
              "font-bold text-base sm:text-lg leading-tight",
              isOwnGoal ? "text-destructive" : "text-white",
              !isOwnGoal && event.player?.id && "cursor-pointer hover:text-primary transition-colors"
            )}
            onClick={() => !isOwnGoal && handlePlayerClick(event.player?.id)}
          >
            {displayName}
          </span>
          {ownGoalPlayerName && (
            <span
              className={cn(
                "text-xs text-muted-foreground mt-0.5",
                event.player?.id && "cursor-pointer hover:text-primary/80 transition-colors"
              )}
              onClick={() => handlePlayerClick(event.player?.id)}
            >
              {ownGoalPlayerName}
            </span>
          )}
          {!isOwnGoal && assistName && (
            <span
              className={cn(
                "text-xs text-muted-foreground mt-0.5",
                event.assist?.id && "cursor-pointer hover:text-primary/80 transition-colors"
              )}
              onClick={() => handlePlayerClick(event.assist?.id)}
            >
              {assistName}
            </span>
          )}
        </div>

        {/* Minute */}
        <span className="text-base sm:text-lg text-white font-light whitespace-nowrap min-w-[24px]">
          {formattedMinute}
        </span>
      </div>
    );
  }

  // Card event
  if (event.type === "amarelo" || event.type === "azul") {
    return (
      <div className={cn(
        "flex items-center gap-4",
        isHome ? "flex-row justify-end" : "flex-row-reverse justify-end"
      )}>
        <span
          className={cn(
            "font-medium text-white text-base sm:text-lg",
            isHome ? "text-right" : "text-left",
            event.player?.id && "cursor-pointer hover:text-primary transition-colors"
          )}
          onClick={() => handlePlayerClick(event.player?.id)}
        >
          {playerName}
        </span>
        <span className="text-base sm:text-lg text-white font-light whitespace-nowrap min-w-[24px]">
          {formattedMinute}
        </span>
      </div>
    );
  }

  // Substitution event
  if (event.type === "substitution") {
    const playerOutName = event.playerOut?.nickname || event.playerOut?.name || "Saiu";
    const playerInName = event.playerIn?.nickname || event.playerIn?.name || "Entrou";

    return (
      <div className={cn(
        "flex items-center gap-4",
        isHome ? "flex-row justify-end" : "flex-row-reverse justify-end"
      )}>
        <div className={cn(
          "flex flex-col min-w-0",
          isHome ? "items-end text-right" : "items-start text-left"
        )}>
          <span
            className={cn(
              "font-bold text-white text-sm sm:text-base flex items-center gap-1.5",
              event.playerIn?.id && "cursor-pointer hover:text-primary transition-colors"
            )}
            onClick={() => handlePlayerClick(event.playerIn?.id)}
          >
            <span className="text-emerald-500 text-[10px]">▲</span>
            {playerInName}
          </span>
          <span
            className={cn(
              "text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5",
              event.playerOut?.id && "cursor-pointer hover:text-primary/80 transition-colors"
            )}
            onClick={() => handlePlayerClick(event.playerOut?.id)}
          >
            <span className="text-red-500 text-[10px]">▼</span>
            {playerOutName}
          </span>
        </div>
        <span className="text-base sm:text-lg text-white font-light whitespace-nowrap min-w-[24px]">
          {formattedMinute}
        </span>
      </div>
    );
  }

  return null;
}

// Single timeline row
function TimelineRow({
  event,
  teamHome,
  teamAway,
  maxMinute,
  isFirst,
  isLast,
  onPlayerClick
}: {
  event: TimelineEvent;
  teamHome: string;
  teamAway: string;
  maxMinute: number;
  isFirst: boolean;
  isLast: boolean;
  onPlayerClick?: (playerId: string) => void;
}) {
  const isHome = event.team_color === teamHome;
  const isAway = event.team_color === teamAway;
  const isMatchEvent = event.type === "match_start" || event.type === "match_end";

  // Match start/end events - JUST TEXT, no icons, no circles
  if (isMatchEvent) {
    return (
      <div className="flex items-center justify-center py-6 relative">
        {/* Vertical line above (only if not first) */}
        {!isFirst && (
          <div className="absolute top-0 bottom-1/2 left-1/2 -translate-x-1/2 w-px bg-white/10" />
        )}

        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest bg-background px-3 z-20">
          {event.type === "match_start" ? "Início da partida" : "Final da partida"}
        </span>

        {/* Vertical line below (only if not last) */}
        {!isLast && (
          <div className="absolute top-1/2 bottom-0 left-1/2 -translate-x-1/2 w-px bg-white/10" />
        )}
      </div>
    );
  }

  const renderIcon = () => {
    if (event.type === "goal") return <GoalIcon />;
    if (event.type === "amarelo" || event.type === "azul") {
      return <CardIcon type={event.type} />;
    }
    if (event.type === "substitution") return <SubstitutionIcon />;
    return <div className="w-3 h-3 rounded-full bg-white/20" />; // Fallback small dot
  };

  return (
    <div className="grid grid-cols-[1fr_48px_1fr] sm:grid-cols-[1fr_64px_1fr] items-center min-h-[60px] relative">
      {/* Left Column - Home Team Events */}
      <div className="flex justify-end pr-4">
        {isHome && <EventContent event={event} side="home" maxMinute={maxMinute} onPlayerClick={onPlayerClick} />}
      </div>

      {/* Center Column - Icon & Line */}
      <div className="flex flex-col items-center justify-center relative h-full">
        {/* Full height vertical line behind icon */}
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-white/10" />

        {/* The Icon */}
        <div className="z-10 bg-background p-1">
          {renderIcon()}
        </div>
      </div>

      {/* Right Column - Away Team Events */}
      <div className="flex justify-start pl-4">
        {isAway && <EventContent event={event} side="away" maxMinute={maxMinute} onPlayerClick={onPlayerClick} />}
      </div>
    </div>
  );
}

export function MatchTimeline({
  events,
  teamHome,
  teamAway,
  maxMinute = 12,
  className,
  matchYear,
}: MatchTimelineProps) {
  const navigate = useNavigate();

  // Sort events by minute
  const sortedEvents = [...events].sort((a, b) => a.minute - b.minute);

  const handlePlayerClick = (playerId: string) => {
    const params = new URLSearchParams();
    if (matchYear) {
      params.set("year", matchYear.toString());
    }
    navigate(`/profile/${playerId}?${params.toString()}`);
  };

  if (sortedEvents.length === 0) {
    return (
      <div className={cn("py-12 text-center text-muted-foreground text-sm", className)}>
        Nenhum evento registrado ainda
      </div>
    );
  }

  return (
    <div className={cn("w-full py-4 bg-background/50 rounded-lg", className)}>
      {sortedEvents.map((event, index) => (
        <TimelineRow
          key={event.id}
          event={event}
          teamHome={teamHome}
          teamAway={teamAway}
          maxMinute={maxMinute}
          isFirst={index === 0}
          isLast={index === sortedEvents.length - 1}
          onPlayerClick={handlePlayerClick}
        />
      ))}
    </div>
  );
}