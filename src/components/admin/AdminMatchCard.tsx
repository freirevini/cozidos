import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TeamLogo } from "@/components/match/TeamLogo";
import { PlayCircle, Edit3, Trash2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Match {
  id: string;
  match_number: number;
  team_home: string;
  team_away: string;
  score_home: number;
  score_away: number;
  scheduled_time: string;
  status: string;
  match_timer_started_at?: string | null;
  match_timer_paused_at?: string | null;
  match_timer_total_paused_seconds?: number | null;
}

interface AdminMatchCardProps {
  match: Match;
  isSelected?: boolean;
  onSelect?: () => void;
  onStart?: () => void;
  onManage?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  compact?: boolean;
}

const teamNames: Record<string, string> = {
  branco: "Branco",
  vermelho: "Vermelho",
  azul: "Azul",
  laranja: "Laranja",
};

function formatTime(scheduledTime: string): string {
  if (!scheduledTime) return "--:--";
  try {
    const parts = scheduledTime.split(":");
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }
    return scheduledTime.substring(0, 5);
  } catch {
    return "--:--";
  }
}

function getCurrentMinute(match: Match): number {
  if (!match.match_timer_started_at) return 0;
  try {
    const startTime = new Date(match.match_timer_started_at).getTime();
    if (isNaN(startTime)) return 0;
    const now = Date.now();
    let pausedSeconds = match.match_timer_total_paused_seconds || 0;
    if (match.match_timer_paused_at) {
      const pausedAt = new Date(match.match_timer_paused_at).getTime();
      if (!isNaN(pausedAt)) {
        pausedSeconds += Math.floor((now - pausedAt) / 1000);
      }
    }
    const elapsedSeconds = Math.max(0, Math.floor((now - startTime) / 1000) - pausedSeconds);
    return Math.floor(elapsedSeconds / 60);
  } catch {
    return 0;
  }
}

function formatMinuteDisplay(minute: number, maxMinute: number = 12): string {
  if (minute <= maxMinute) {
    return `${minute}'`;
  }
  const extra = minute - maxMinute;
  return `${maxMinute}' + ${extra}`;
}

function getStatusDisplay(match: Match): { text: string; variant: "live" | "scheduled" | "finished" } {
  if (match.status === "in_progress") {
    const minute = getCurrentMinute(match);
    return { 
      text: minute > 0 ? formatMinuteDisplay(minute) : "Ao Vivo", 
      variant: "live" 
    };
  }
  if (match.status === "finished") {
    return { text: "Encerrado", variant: "finished" };
  }
  return { text: formatTime(match.scheduled_time), variant: "scheduled" };
}

export function AdminMatchCard({
  match,
  isSelected,
  onSelect,
  onStart,
  onManage,
  onEdit,
  onDelete,
  compact = false,
}: AdminMatchCardProps) {
  const status = getStatusDisplay(match);

  // Compact version for mini-card navigation
  if (compact) {
    return (
      <button
        onClick={onSelect}
        className={cn(
          "flex flex-col items-center p-3 rounded-lg border-2 transition-all min-w-[80px] snap-center",
          isSelected
            ? "border-primary bg-primary/20 shadow-lg shadow-primary/20"
            : "border-border bg-card hover:border-primary/50 hover:bg-muted/30"
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <TeamLogo teamColor={match.team_home as any} size="sm" />
          <span className="text-xs text-muted-foreground">×</span>
          <TeamLogo teamColor={match.team_away as any} size="sm" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {match.score_home} - {match.score_away}
        </span>
        <span className={cn(
          "text-[10px] mt-1 font-medium",
          status.variant === "live" ? "text-primary" :
          status.variant === "finished" ? "text-green-500" : "text-muted-foreground"
        )}>
          {status.text}
        </span>
      </button>
    );
  }

  // Full card version
  return (
    <Card className={cn(
      "bg-card border-border transition-all overflow-hidden",
      isSelected && "ring-2 ring-primary shadow-lg shadow-primary/20"
    )}>
      <CardContent className="p-0">
        {/* Header: Horário / Data */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock size={14} />
            <span>{formatTime(match.scheduled_time)}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            Jogo {match.match_number}
          </span>
        </div>

        {/* Main content: Placar central */}
        <div className="px-4 py-5">
          <div className="flex items-center justify-center gap-4">
            {/* Time Casa */}
            <div className="flex flex-col items-center flex-1">
              <TeamLogo teamColor={match.team_home as any} size="lg" />
              <span className="text-sm font-medium text-foreground mt-2">
                {teamNames[match.team_home]}
              </span>
            </div>

            {/* Placar */}
            <div className="flex flex-col items-center px-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl sm:text-5xl font-bold text-white">
                  {match.score_home}
                </span>
                <span className="text-2xl text-muted-foreground">×</span>
                <span className="text-4xl sm:text-5xl font-bold text-white">
                  {match.score_away}
                </span>
              </div>
              
              {/* Status pill centered */}
              <div className={cn(
                "mt-3 px-4 py-1.5 rounded-full text-sm font-medium",
                status.variant === "live" 
                  ? "bg-primary/20 text-primary border border-primary/40" 
                  : status.variant === "finished"
                  ? "bg-green-500/20 text-green-400 border border-green-500/40"
                  : "bg-muted text-muted-foreground border border-border"
              )}>
                {status.variant === "live" && (
                  <span className="inline-block w-2 h-2 rounded-full bg-primary mr-2 animate-pulse" />
                )}
                {status.text}
              </div>
            </div>

            {/* Time Visitante */}
            <div className="flex flex-col items-center flex-1">
              <TeamLogo teamColor={match.team_away as any} size="lg" />
              <span className="text-sm font-medium text-foreground mt-2">
                {teamNames[match.team_away]}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t border-border/50 bg-muted/10">
          <div className="flex gap-2">
            {match.status === "not_started" && (
              <Button
                onClick={onStart}
                className="flex-1 min-h-[48px] gap-2 bg-primary hover:bg-primary/90"
              >
                <PlayCircle size={18} />
                Iniciar Partida
              </Button>
            )}

            {match.status === "in_progress" && (
              <Button
                onClick={onManage}
                className="flex-1 min-h-[48px] gap-2 bg-primary hover:bg-primary/90"
              >
                <PlayCircle size={18} />
                Gerenciar Ao Vivo
              </Button>
            )}

            {match.status === "finished" && (
              <Button
                onClick={onEdit}
                variant="secondary"
                className="flex-1 min-h-[48px] gap-2"
              >
                <Edit3 size={18} />
                Editar
              </Button>
            )}

            <Button
              onClick={onDelete}
              variant="outline"
              className="min-h-[48px] px-4 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 size={18} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminMatchMiniNav({
  matches,
  selectedMatchId,
  onSelectMatch,
}: {
  matches: Match[];
  selectedMatchId: string | null;
  onSelectMatch: (matchId: string) => void;
}) {
  return (
    <div className="w-full overflow-x-auto scrollbar-hide">
      <div className="flex gap-2 p-2 snap-x snap-mandatory">
        {matches.map((match) => (
          <AdminMatchCard
            key={match.id}
            match={match}
            isSelected={match.id === selectedMatchId}
            onSelect={() => onSelectMatch(match.id)}
            compact
          />
        ))}
      </div>
    </div>
  );
}
