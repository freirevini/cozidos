import { useRef, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TeamLogo } from "@/components/match/TeamLogo";
import { PlayCircle, Edit3, Trash2, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMatchTimer, formatEventMinute, getMatchCurrentMinute } from "@/lib/matchTimer";

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

function getStatusDisplay(match: Match): { text: string; variant: "live" | "scheduled" | "finished" } {
  if (match.status === "in_progress") {
    // Use centralized MM:SS timer format
    const timerData = {
      match_timer_started_at: match.match_timer_started_at || null,
      match_timer_paused_at: match.match_timer_paused_at || null,
      match_timer_total_paused_seconds: match.match_timer_total_paused_seconds || null,
      status: match.status,
    };
    const timerText = formatMatchTimer(timerData);
    return {
      text: timerText !== '--:--' ? timerText : "Ao Vivo",
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
          "flex flex-col items-center p-2.5 rounded-xl border-2 transition-all min-w-[72px] snap-center shrink-0",
          isSelected
            ? "border-primary bg-primary/20 shadow-lg shadow-primary/30 scale-105"
            : "border-border/60 bg-card/80 hover:border-primary/50 hover:bg-muted/40"
        )}
      >
        <span className="text-[10px] font-semibold text-muted-foreground mb-1.5">
          Jogo {match.match_number}
        </span>
        <div className="flex items-center gap-1.5">
          <TeamLogo teamColor={match.team_home as any} size="xs" />
          <span className="text-sm font-bold text-foreground">
            {match.score_home}-{match.score_away}
          </span>
          <TeamLogo teamColor={match.team_away as any} size="xs" />
        </div>
        <span className={cn(
          "text-[9px] mt-1 font-semibold uppercase tracking-wide",
          status.variant === "live" ? "text-primary" :
            status.variant === "finished" ? "text-emerald-400" : "text-muted-foreground"
        )}>
          {status.variant === "live" && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary mr-1 animate-pulse" />
          )}
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
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
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
                className="flex-1 min-h-[48px] gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                <PlayCircle size={18} />
                Gerenciar Ao Vivo
              </Button>
            )}

            {match.status === "finished" && (
              <Button
                onClick={onEdit}
                className="flex-1 min-h-[48px] gap-2 bg-black hover:bg-black/90 text-white"
              >
                <Edit3 size={18} />
                Editar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Hook for swipe gesture detection
function useSwipeGesture(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  threshold: number = 50
) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;

    // Only trigger swipe if horizontal movement is greater than vertical
    // This prevents conflicts with vertical scrolling
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > threshold) {
      if (deltaX > 0) {
        onSwipeRight();
      } else {
        onSwipeLeft();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  return { handleTouchStart, handleTouchEnd };
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const navigateMatch = (direction: 'prev' | 'next') => {
    if (!selectedMatchId) {
      if (matches.length > 0) {
        onSelectMatch(matches[0].id);
      }
      return;
    }
    const currentIndex = matches.findIndex(m => m.id === selectedMatchId);
    const newIndex = direction === 'prev'
      ? Math.max(0, currentIndex - 1)
      : Math.min(matches.length - 1, currentIndex + 1);

    if (newIndex !== currentIndex) {
      onSelectMatch(matches[newIndex].id);
    }
  };

  // Swipe gesture handlers for full card area
  const { handleTouchStart, handleTouchEnd } = useSwipeGesture(
    () => navigateMatch('next'),  // Swipe left = next match
    () => navigateMatch('prev')   // Swipe right = previous match
  );

  // Check scroll position and update arrow states
  const checkScrollPosition = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setCanScrollLeft(container.scrollLeft > 10);
    setCanScrollRight(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 10
    );
  };

  // Auto-scroll to selected item
  useEffect(() => {
    if (!selectedMatchId || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const selectedIndex = matches.findIndex(m => m.id === selectedMatchId);
    if (selectedIndex === -1) return;

    const items = container.querySelectorAll('[data-match-item]');
    const selectedItem = items[selectedIndex] as HTMLElement;

    if (selectedItem) {
      const containerRect = container.getBoundingClientRect();
      const itemRect = selectedItem.getBoundingClientRect();

      // Check if item is not fully visible
      if (itemRect.left < containerRect.left || itemRect.right > containerRect.right) {
        selectedItem.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }

    // Check scroll position after animation
    setTimeout(checkScrollPosition, 350);
  }, [selectedMatchId, matches]);

  // Initial scroll check
  useEffect(() => {
    checkScrollPosition();
    window.addEventListener('resize', checkScrollPosition);
    return () => window.removeEventListener('resize', checkScrollPosition);
  }, [matches]);

  const scrollBy = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = direction === 'left' ? -160 : 160;
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' });

    setTimeout(checkScrollPosition, 350);
  };

  const currentIndex = matches.findIndex(m => m.id === selectedMatchId);
  const isFirstMatch = currentIndex === 0;
  const isLastMatch = currentIndex === matches.length - 1;

  return (
    <div
      className="relative bg-muted/30 rounded-xl p-2 border border-border/50"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Navigation Arrows - Desktop */}
      <div className="hidden sm:block">
        {canScrollLeft && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => scrollBy('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-full w-10 rounded-l-xl bg-gradient-to-r from-muted via-muted/80 to-transparent hover:from-muted hover:via-muted/90"
          >
            <ChevronLeft size={20} className="text-foreground" />
          </Button>
        )}
        {canScrollRight && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => scrollBy('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-full w-10 rounded-r-xl bg-gradient-to-l from-muted via-muted/80 to-transparent hover:from-muted hover:via-muted/90"
          >
            <ChevronRight size={20} className="text-foreground" />
          </Button>
        )}
      </div>

      {/* Mini Cards Container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory px-1 py-1"
        onScroll={checkScrollPosition}
      >
        {matches.map((match) => (
          <div key={match.id} data-match-item>
            <AdminMatchCard
              match={match}
              isSelected={match.id === selectedMatchId}
              onSelect={() => onSelectMatch(match.id)}
              compact
            />
          </div>
        ))}
      </div>

      {/* Quick Navigation Footer with swipe hint on mobile */}
      <div className="flex items-center justify-between mt-2 px-1 pt-2 border-t border-border/30">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateMatch('prev')}
          disabled={isFirstMatch}
          className="h-8 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronLeft size={14} />
          <span className="hidden xs:inline">Anterior</span>
        </Button>

        <div className="flex flex-col items-center">
          <span className="text-xs font-medium text-muted-foreground">
            {currentIndex + 1} / {matches.length}
          </span>
          <span className="text-[10px] text-muted-foreground/60 sm:hidden">
            ← Deslize para navegar →
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateMatch('next')}
          disabled={isLastMatch}
          className="h-8 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <span className="hidden xs:inline">Próximo</span>
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}

// Export hook for use in parent components (for card swipe area)
export { useSwipeGesture };
