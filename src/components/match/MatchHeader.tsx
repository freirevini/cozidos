import { TeamLogo } from "./TeamLogo";
import { formatMinute } from "@/components/ui/event-item";

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
  className,
}: MatchHeaderProps) {
  // Format scheduled time from ISO string to HH:MM
  const formatTime = (timeString?: string) => {
    if (!timeString) return "--:--";
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return timeString;
    }
  };

  // Get the status chip content
  const getStatusChipContent = () => {
    if (status === "finished") {
      return "Encerrado";
    }
    if (status === "in_progress" && currentMinute !== null) {
      return formatMinute(currentMinute, 12);
    }
    // Not started - show scheduled time
    return formatTime(scheduledTime);
  };

  // Get status chip styles
  const getStatusChipStyles = () => {
    if (status === "in_progress") {
      return "bg-primary/20 border-primary text-primary";
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
      <div className="flex items-center justify-center gap-3 sm:gap-6">
        {/* Home Team Logo */}
        <div className="flex items-center gap-2 sm:gap-4">
          <TeamLogo teamColor={teamHome as any} size="md" />
          <span className="text-3xl sm:text-4xl md:text-5xl font-bold tabular-nums text-foreground">
            {scoreHome}
          </span>
        </div>

        {/* Status Chip - Central */}
        <div 
          className={`
            px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border text-xs sm:text-sm font-semibold
            min-w-[70px] sm:min-w-[90px] text-center whitespace-nowrap
            ${getStatusChipStyles()}
          `}
        >
          {status === "in_progress" && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse mr-1.5" />
          )}
          {getStatusChipContent()}
        </div>

        {/* Away Team Logo */}
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="text-3xl sm:text-4xl md:text-5xl font-bold tabular-nums text-foreground">
            {scoreAway}
          </span>
          <TeamLogo teamColor={teamAway as any} size="md" />
        </div>
      </div>
    </div>
  );
}