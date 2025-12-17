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

// Soccer ball emoji icon - clean on dark circle with green border
function GoalIcon() {
  return (
    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#1a1a1a] border-2 border-emerald-500 flex items-center justify-center z-10 shadow-lg shadow-emerald-500/30">
      <span 
        role="img" 
        aria-label="gol"
        className="text-xl sm:text-2xl leading-none"
        style={{ fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif' }}
      >
        ⚽
      </span>
    </div>
  );
}

// Card icon - rectangular card tilted
function CardIcon({ type }: { type: "amarelo" | "azul" }) {
  const isYellow = type === "amarelo";
  return (
    <div className={cn(
      "w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#1a1a1a] border-2 flex items-center justify-center z-10 shadow-lg",
      isYellow 
        ? "border-yellow-400 shadow-yellow-400/30" 
        : "border-blue-500 shadow-blue-500/30"
    )}>
      <div 
        className={cn(
          "w-4 h-5 sm:w-4.5 sm:h-6 rounded-sm transform rotate-6",
          isYellow ? "bg-yellow-400" : "bg-blue-500"
        )}
      />
    </div>
  );
}

// Match start/end icon - simple dot
function MatchEventIcon() {
  return (
    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary/10 border-2 border-primary/40 flex items-center justify-center z-10">
      <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-primary/60" />
    </div>
  );
}

// Substitution icon - circular with arrows (green in, red out)
function SubstitutionIcon() {
  return (
    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#1a1a1a] border-2 border-gray-500 flex items-center justify-center z-10 shadow-lg shadow-gray-500/20">
      <svg 
        viewBox="0 0 24 24" 
        className="w-5 h-5 sm:w-6 sm:h-6"
        fill="none"
      >
        {/* Arrow up (green - player in) */}
        <path 
          d="M8 16 L8 10 L5 10 L9 5 L13 10 L10 10 L10 16 Z" 
          fill="#22c55e"
        />
        {/* Arrow down (red - player out) */}
        <path 
          d="M16 8 L16 14 L19 14 L15 19 L11 14 L14 14 L14 8 Z" 
          fill="#ef4444"
        />
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
        "flex items-center gap-2 sm:gap-3",
        isHome ? "flex-row" : "flex-row-reverse"
      )}>
        {/* Player info - stacked */}
        <div className={cn(
          "flex flex-col min-w-0",
          isHome ? "items-end text-right" : "items-start text-left"
        )}>
          <span 
            className={cn(
              "font-bold text-white text-sm sm:text-base truncate max-w-[110px] sm:max-w-[150px]",
              event.player?.id && "cursor-pointer hover:text-primary transition-colors"
            )}
            onClick={() => handlePlayerClick(event.player?.id)}
          >
            {playerName}
          </span>
          {assistName && (
            <span 
              className={cn(
                "text-xs text-gray-400 truncate max-w-[100px] sm:max-w-[130px]",
                event.assist?.id && "cursor-pointer hover:text-primary/80 transition-colors"
              )}
              onClick={() => handlePlayerClick(event.assist?.id)}
            >
              {assistName}
            </span>
          )}
        </div>
        {/* Minute */}
        <span className="text-sm sm:text-base text-gray-400 font-medium whitespace-nowrap">
          {formattedMinute}
        </span>
      </div>
    );
  }

  // Card event
  if (event.type === "amarelo" || event.type === "azul") {
    return (
      <div className={cn(
        "flex items-center gap-2 sm:gap-3",
        isHome ? "flex-row" : "flex-row-reverse"
      )}>
        <span 
          className={cn(
            "font-medium text-white text-sm sm:text-base truncate max-w-[110px] sm:max-w-[150px]",
            isHome ? "text-right" : "text-left",
            event.player?.id && "cursor-pointer hover:text-primary transition-colors"
          )}
          onClick={() => handlePlayerClick(event.player?.id)}
        >
          {playerName}
        </span>
        <span className="text-sm sm:text-base text-gray-400 font-medium whitespace-nowrap">
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
        "flex items-center gap-2 sm:gap-3",
        isHome ? "flex-row" : "flex-row-reverse"
      )}>
        {/* Player info - stacked with in/out */}
        <div className={cn(
          "flex flex-col min-w-0",
          isHome ? "items-end text-right" : "items-start text-left"
        )}>
          <span 
            className={cn(
              "font-bold text-white text-sm sm:text-base truncate max-w-[110px] sm:max-w-[150px] flex items-center gap-1",
              event.playerIn?.id && "cursor-pointer hover:text-primary transition-colors"
            )}
            onClick={() => handlePlayerClick(event.playerIn?.id)}
          >
            <span className="text-green-500 text-xs">▲</span>
            {playerInName}
          </span>
          <span 
            className={cn(
              "text-xs text-gray-400 truncate max-w-[100px] sm:max-w-[130px] flex items-center gap-1",
              event.playerOut?.id && "cursor-pointer hover:text-primary/80 transition-colors"
            )}
            onClick={() => handlePlayerClick(event.playerOut?.id)}
          >
            <span className="text-red-500 text-xs">▼</span>
            {playerOutName}
          </span>
        </div>
        {/* Minute */}
        <span className="text-sm sm:text-base text-gray-400 font-medium whitespace-nowrap">
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

  // Match start/end events - centered
  if (isMatchEvent) {
    return (
      <div className="flex items-center justify-center py-4 sm:py-5 relative">
        {/* Vertical line above */}
        {!isFirst && (
          <div className="absolute bottom-1/2 left-1/2 -translate-x-1/2 w-px h-8 sm:h-10 border-l border-dashed border-border" />
        )}
        
        <div className="flex items-center gap-3">
          <MatchEventIcon />
          <span className="text-xs sm:text-sm text-muted-foreground">
            {event.type === "match_start" ? "Início da partida" : "Final da partida"}
          </span>
        </div>
        
        {/* Vertical line below */}
        {!isLast && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-px h-8 sm:h-10 border-l border-dashed border-border" />
        )}
      </div>
    );
  }

  // Regular events
  const renderIcon = () => {
    if (event.type === "goal") return <GoalIcon />;
    if (event.type === "amarelo" || event.type === "azul") {
      return <CardIcon type={event.type} />;
    }
    if (event.type === "substitution") return <SubstitutionIcon />;
    return null;
  };

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center py-3 sm:py-4 relative">
      {/* Left Column - Home Team Events */}
      <div className="flex justify-end pr-3 sm:pr-4">
        {isHome && <EventContent event={event} side="home" maxMinute={maxMinute} onPlayerClick={onPlayerClick} />}
      </div>
      
      {/* Center Column - Icon */}
      <div className="flex flex-col items-center relative">
        {/* Dashed line above */}
        {!isFirst && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-px h-6 sm:h-8 border-l border-dashed border-border" />
        )}
        
        {renderIcon()}
        
        {/* Dashed line below */}
        {!isLast && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-px h-6 sm:h-8 border-l border-dashed border-border" />
        )}
      </div>
      
      {/* Right Column - Away Team Events */}
      <div className="flex justify-start pl-3 sm:pl-4">
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
      <div className={cn("py-8 text-center text-muted-foreground text-sm", className)}>
        Nenhum evento registrado ainda
      </div>
    );
  }

  return (
    <div className={cn("w-full py-2", className)}>
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