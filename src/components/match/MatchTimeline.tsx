import { cn } from "@/lib/utils";
import { Circle } from "lucide-react";
import { formatMinute } from "@/components/ui/event-item";

export type TimelineEventType = "goal" | "assist" | "amarelo" | "azul" | "match_start" | "match_end";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  minute: number;
  team_color?: string;
  player?: {
    name: string;
    nickname: string | null;
    avatar_url?: string | null;
  };
  assist?: {
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
}

// Circular badge goal icon - clean aesthetic
function GoalIcon() {
  return (
    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#1a1a1a] border-2 border-emerald-500 flex items-center justify-center z-10 shadow-lg shadow-emerald-500/30">
      <Circle className="w-5 h-5 sm:w-6 sm:h-6 text-white fill-white" strokeWidth={0} />
    </div>
  );
}

function CardIcon({ type }: { type: "amarelo" | "azul" }) {
  return (
    <div className={cn(
      "w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#1a1a1a] border-2 flex items-center justify-center z-10 shadow-lg",
      type === "amarelo" 
        ? "border-yellow-400 shadow-yellow-400/30" 
        : "border-blue-500 shadow-blue-500/30"
    )}>
      <div 
        className={cn(
          "w-4 h-6 sm:w-5 sm:h-7 rounded-sm transform rotate-6",
          type === "amarelo" ? "bg-yellow-400" : "bg-blue-500"
        )}
      />
    </div>
  );
}

function MatchEventIcon() {
  return (
    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center z-10">
      <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-primary" />
    </div>
  );
}

// Event content component with proper text alignment
function EventContent({ 
  event, 
  side,
  maxMinute = 12
}: { 
  event: TimelineEvent; 
  side: "home" | "away";
  maxMinute?: number;
}) {
  const playerName = event.player?.nickname || event.player?.name || "Jogador";
  const assistName = event.assist?.nickname || event.assist?.name;
  const formattedMinute = formatMinute(event.minute, maxMinute);

  if (event.type === "goal") {
    if (side === "home") {
      // Home: right-aligned towards center
      return (
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Names stacked, right-aligned */}
          <div className="flex flex-col items-end min-w-0">
            <span className="font-semibold text-foreground text-sm sm:text-base truncate max-w-[100px] sm:max-w-[160px]">
              {playerName}
            </span>
            {assistName && (
              <span className="text-xs text-gray-400 truncate max-w-[90px] sm:max-w-[140px]">
                {assistName}
              </span>
            )}
          </div>
          {/* Time */}
          <span className="text-xs sm:text-sm text-muted-foreground font-medium whitespace-nowrap">
            {formattedMinute}
          </span>
        </div>
      );
    } else {
      // Away: left-aligned from center
      return (
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Time */}
          <span className="text-xs sm:text-sm text-muted-foreground font-medium whitespace-nowrap">
            {formattedMinute}
          </span>
          {/* Names stacked, left-aligned */}
          <div className="flex flex-col items-start min-w-0">
            <span className="font-semibold text-foreground text-sm sm:text-base truncate max-w-[100px] sm:max-w-[160px]">
              {playerName}
            </span>
            {assistName && (
              <span className="text-xs text-gray-400 truncate max-w-[90px] sm:max-w-[140px]">
                {assistName}
              </span>
            )}
          </div>
        </div>
      );
    }
  }

  // Cards
  if (event.type === "amarelo" || event.type === "azul") {
    if (side === "home") {
      return (
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="font-medium text-foreground text-sm sm:text-base truncate max-w-[100px] sm:max-w-[160px]">
            {playerName}
          </span>
          <span className="text-xs sm:text-sm text-muted-foreground font-medium whitespace-nowrap">
            {formattedMinute}
          </span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-xs sm:text-sm text-muted-foreground font-medium whitespace-nowrap">
            {formattedMinute}
          </span>
          <span className="font-medium text-foreground text-sm sm:text-base truncate max-w-[100px] sm:max-w-[160px]">
            {playerName}
          </span>
        </div>
      );
    }
  }

  return null;
}

// Row component for timeline
function TimelineRow({ 
  event, 
  teamHome, 
  teamAway,
  maxMinute,
  isFirst,
  isLast
}: { 
  event: TimelineEvent; 
  teamHome: string;
  teamAway: string;
  maxMinute: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const isHome = event.team_color === teamHome;
  const isAway = event.team_color === teamAway;
  const isMatchEvent = event.type === "match_start" || event.type === "match_end";

  // For match start/end events
  if (isMatchEvent) {
    return (
      <div className="grid grid-cols-[1fr_auto_1fr] items-center py-3 sm:py-4 relative">
        {/* Left - Empty */}
        <div />
        
        {/* Center - Icon with vertical line segments */}
        <div className="flex flex-col items-center relative">
          {/* Line above (hidden for first) */}
          {!isFirst && (
            <div className="absolute bottom-full w-px h-6 sm:h-8 bg-border" />
          )}
          
          <MatchEventIcon />
          
          {/* Line below (hidden for last) */}
          {!isLast && (
            <div className="absolute top-full w-px h-6 sm:h-8 bg-border" />
          )}
        </div>
        
        {/* Right - Label */}
        <div className="pl-3 sm:pl-4">
          <span className="text-xs sm:text-sm text-muted-foreground">
            {event.type === "match_start" ? "Início da partida" : "Final da partida"}
          </span>
        </div>
      </div>
    );
  }

  // Regular events (goals, cards)
  const renderIcon = () => {
    if (event.type === "goal") return <GoalIcon />;
    if (event.type === "amarelo" || event.type === "azul") {
      return <CardIcon type={event.type} />;
    }
    return null;
  };

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center py-3 sm:py-4 relative">
      {/* Left Column - Home Team Events */}
      <div className="flex justify-end pr-3 sm:pr-4">
        {isHome && <EventContent event={event} side="home" maxMinute={maxMinute} />}
      </div>
      
      {/* Center Column - Icon with vertical line segments */}
      <div className="flex flex-col items-center relative">
        {/* Line above (hidden for first) */}
        {!isFirst && (
          <div className="absolute bottom-full w-px h-6 sm:h-8 bg-border" />
        )}
        
        {renderIcon()}
        
        {/* Line below (hidden for last) */}
        {!isLast && (
          <div className="absolute top-full w-px h-6 sm:h-8 bg-border" />
        )}
      </div>
      
      {/* Right Column - Away Team Events */}
      <div className="flex justify-start pl-3 sm:pl-4">
        {isAway && <EventContent event={event} side="away" maxMinute={maxMinute} />}
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
}: MatchTimelineProps) {
  // Sort events by minute (ascending - oldest first at top)
  const sortedEvents = [...events].sort((a, b) => a.minute - b.minute);

  if (sortedEvents.length === 0) {
    return (
      <div className={cn("py-8 text-center text-muted-foreground text-sm", className)}>
        Nenhum evento registrado ainda
      </div>
    );
  }

  return (
    <div className={cn("w-full py-2", className)}>
      {/* Timeline with vertical central line */}
      <div className="relative">
        {sortedEvents.map((event, index) => (
          <TimelineRow
            key={event.id}
            event={event}
            teamHome={teamHome}
            teamAway={teamAway}
            maxMinute={maxMinute}
            isFirst={index === 0}
            isLast={index === sortedEvents.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
