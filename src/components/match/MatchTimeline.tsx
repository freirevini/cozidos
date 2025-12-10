import { cn } from "@/lib/utils";
import iconGoal from "@/assets/icon-goal.png";
import iconAssist from "@/assets/icon-assist.png";
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

// Icon components for the central axis
function GoalIcon() {
  return (
    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-background border-2 border-emerald-500 flex items-center justify-center z-10 shadow-lg shadow-emerald-500/20">
      <img src={iconGoal} alt="Gol" className="w-6 h-6 sm:w-7 sm:h-7" />
    </div>
  );
}

function CardIcon({ type }: { type: "amarelo" | "azul" }) {
  return (
    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-background border-2 border-border flex items-center justify-center z-10 shadow-lg">
      <div 
        className={cn(
          "w-5 h-7 sm:w-6 sm:h-8 rounded-sm transform rotate-6",
          type === "amarelo" ? "bg-yellow-400" : "bg-blue-500"
        )}
      />
    </div>
  );
}

function MatchEventIcon() {
  return (
    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center z-10">
      <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-primary" />
    </div>
  );
}

// Event content component for each side
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
      // Home: content on left, text aligned right
      return (
        <div className="flex items-center justify-end gap-2 sm:gap-3 text-right">
          <div className="flex flex-col items-end min-w-0">
            <span className="font-semibold text-foreground text-sm sm:text-base truncate max-w-[120px] sm:max-w-[180px]">
              {playerName}
            </span>
            {assistName && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <img src={iconAssist} alt="Assist" className="w-3 h-3 sm:w-4 sm:h-4 opacity-70" />
                <span className="text-xs sm:text-sm truncate max-w-[100px] sm:max-w-[140px]">
                  {assistName}
                </span>
              </div>
            )}
          </div>
          <span className="text-xs sm:text-sm text-muted-foreground font-medium whitespace-nowrap">
            {formattedMinute}
          </span>
        </div>
      );
    } else {
      // Away: content on right, text aligned left
      return (
        <div className="flex items-center justify-start gap-2 sm:gap-3 text-left">
          <span className="text-xs sm:text-sm text-muted-foreground font-medium whitespace-nowrap">
            {formattedMinute}
          </span>
          <div className="flex flex-col items-start min-w-0">
            <span className="font-semibold text-foreground text-sm sm:text-base truncate max-w-[120px] sm:max-w-[180px]">
              {playerName}
            </span>
            {assistName && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <img src={iconAssist} alt="Assist" className="w-3 h-3 sm:w-4 sm:h-4 opacity-70" />
                <span className="text-xs sm:text-sm truncate max-w-[100px] sm:max-w-[140px]">
                  {assistName}
                </span>
              </div>
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
        <div className="flex items-center justify-end gap-2 sm:gap-3 text-right">
          <span className="font-medium text-foreground text-sm sm:text-base truncate max-w-[120px] sm:max-w-[180px]">
            {playerName}
          </span>
          <span className="text-xs sm:text-sm text-muted-foreground font-medium whitespace-nowrap">
            {formattedMinute}
          </span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center justify-start gap-2 sm:gap-3 text-left">
          <span className="text-xs sm:text-sm text-muted-foreground font-medium whitespace-nowrap">
            {formattedMinute}
          </span>
          <span className="font-medium text-foreground text-sm sm:text-base truncate max-w-[120px] sm:max-w-[180px]">
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
