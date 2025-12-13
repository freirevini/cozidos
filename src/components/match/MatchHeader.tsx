import { TeamLogo } from "./TeamLogo";
import { formatMatchTimer, formatEventMinute } from "@/lib/matchTimer";

interface MatchTimerData {
  match_timer_started_at: string | null;
  match_timer_paused_at: string | null;
  match_timer_total_paused_seconds: number | null;
  status: string;
}

interface MatchHeaderProps {
  teamHome: string;
  teamAway: string;
  scoreHome: number;
  scoreAway: number;
  roundNumber?: number;
  matchNumber?: number;
  status: "not_started" | "in_progress" | "finished";
  scheduledTime?: string;
  currentMinute?: number | null;
  matchTimerData?: MatchTimerData;
  className?: string;
}

export function MatchHeader({
  teamHome,
  teamAway,
  scoreHome,
  scoreAway,
  roundNumber,
  matchNumber,
  status,
  scheduledTime,
  currentMinute,
  matchTimerData,
  className,
}: MatchHeaderProps) {
  // Safe time formatting - handles both ISO strings and time-only strings
  const formatTime = (timeString?: string): string => {
    if (!timeString) return "--:--";
    
    try {
      // If it's a time-only string (HH:MM:SS or HH:MM), extract hours and minutes
      if (timeString.match(/^\d{2}:\d{2}(:\d{2})?$/)) {
        return timeString.substring(0, 5);
      }
      
      // Try parsing as ISO date
      const date = new Date(timeString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      }
      
      return "--:--";
    } catch {
      return "--:--";
    }
  };

  // Get the status chip content - now supports MM:SS format
  const getStatusChipContent = () => {
    if (status === "finished") {
      return "Encerrado";
    }
    
    // Use matchTimerData for MM:SS format if available
    if (status === "in_progress" && matchTimerData) {
      return formatMatchTimer(matchTimerData);
    }
    
    // Fallback to legacy minute format (X' or 12' + Y)
    if (status === "in_progress" && currentMinute !== null && currentMinute !== undefined) {
      return formatEventMinute(currentMinute, 12);
    }
    
    // Not started - show scheduled time
    return formatTime(scheduledTime);
  };

  // Get status chip styles
  const getStatusChipStyles = () => {
    if (status === "in_progress") {
      return "bg-primary/20 border-primary/50 text-foreground";
    }
    if (status === "finished") {
      return "bg-muted border-border text-foreground";
    }
    return "bg-muted/50 border-border text-muted-foreground";
  };

  return (
    <div className={`space-y-4 ${className || ""}`}>
      {/* Rodada info - centered */}
      {(roundNumber || matchNumber) && (
        <div className="text-center text-sm text-muted-foreground">
          {roundNumber && `Rodada ${roundNumber}`}
          {roundNumber && matchNumber && " - "}
          {matchNumber && `Jogo ${matchNumber}`}
        </div>
      )}

      {/* Main Score Layout - MLS Style */}
      <div className="flex items-center justify-center gap-2 sm:gap-4">
        {/* Home Team Logo + Score */}
        <div className="flex items-center gap-2 sm:gap-3">
          <TeamLogo teamColor={teamHome as any} size="md" />
          <span className="text-3xl sm:text-4xl md:text-5xl font-bold tabular-nums text-primary">
            {scoreHome}
          </span>
        </div>

        {/* Status Chip - Central with MM:SS timer */}
        <div 
          className={`
            px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border text-xs sm:text-sm font-medium
            min-w-[70px] sm:min-w-[90px] text-center whitespace-nowrap flex items-center justify-center gap-1.5
            ${getStatusChipStyles()}
          `}
        >
          {status === "in_progress" && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          )}
          <span>{getStatusChipContent()}</span>
        </div>

        {/* Away Team Score + Logo */}
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-3xl sm:text-4xl md:text-5xl font-bold tabular-nums text-primary">
            {scoreAway}
          </span>
          <TeamLogo teamColor={teamAway as any} size="md" />
        </div>
      </div>
    </div>
  );
}
