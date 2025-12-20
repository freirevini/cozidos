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
}

interface MatchTimelineProps {
  events: TimelineEvent[];
  teamHome: string;
  teamAway: string;
  maxMinute?: number;
  className?: string;
  matchYear?: number;
}

// Realistic Soccer Ball SVG Icon
function GoalIcon() {
  return (
    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black border-2 border-emerald-500/20 flex items-center justify-center z-10 shadow-lg shadow-emerald-500/10 relative overflow-hidden">
      <svg viewBox="0 0 512 512" className="w-full h-full text-white bg-white">
        <path d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256 256-114.6 256-256S397.4 0 256 0zM37.5 256c0-43 12.4-83.3 33.7-117.8L163.6 254l-53.9 105.7C70.3 328.1 37.5 293 37.5 256zm148.5 210.5l56.8-111.4 87.8 77.3-39.7 18.6c-29.8 14-63.8 21.5-99.2 21.5-1.9 0-3.8-.1-5.7-.3zm153.2-30.8l-72.3-63.6 86.8-67.4 56.6 62.1c-19.1 27.5-44.4 50.8-74.1 68.9zm80-108.6l-67.6-74.1 33.1-99.3c35.4 33.7 58.1 80.2 59.8 132.3l-25.3 41.1zm-84.5-194.9l-54.8 107.5-102.3-39.4 55.4-90.8c30.1-13.3 63.6-20.8 98.7-20.8 1.1 0 2.1 0 3.2.1l-.2 43.4zM77.4 121.2l61.7 82.3L237 172l-25.1-105.4C179.3 75.8 152.1 94.7 121.9 119l-44.5 2.2z" fill="#1a1a1a" />
      </svg>
    </div>
  );
}

// Angled Card Icon (CSS only)
function CardIcon({ type }: { type: "amarelo" | "azul" }) {
  const isYellow = type === "amarelo";
  return (
    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#1e1e1e] flex items-center justify-center z-10 shadow-lg relative border border-white/10">
      <div
        className={cn(
          "w-5 h-7 rounded-[2px] shadow-sm transform rotate-12",
          isYellow
            ? "bg-yellow-400 shadow-yellow-400/20"
            : "bg-blue-600 shadow-blue-600/20"
        )}
        style={{
          boxShadow: "2px 2px 4px rgba(0,0,0,0.5)"
        }}
      />
    </div>
  );
}

// Substitution icon - circular with arrows
function SubstitutionIcon() {
  return (
    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#1e1e1e] border border-white/10 flex items-center justify-center z-10 shadow-lg">
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5 sm:w-6 sm:h-6"
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
    </div>
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
              "font-bold text-white text-base sm:text-lg leading-tight",
              event.player?.id && "cursor-pointer hover:text-primary transition-colors"
            )}
            onClick={() => handlePlayerClick(event.player?.id)}
          >
            {playerName}
          </span>
          {assistName && (
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