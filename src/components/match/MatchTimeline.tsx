import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import iconBall from "@/assets/icon-ball.png";
import iconBoot from "@/assets/icon-boot.png";
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

export function MatchTimeline({
  events,
  teamHome,
  teamAway,
  maxMinute = 12,
  className,
}: MatchTimelineProps) {
  // Filtrar e ordenar eventos (excluindo match_start/match_end do layout principal)
  const matchEvents = events
    .filter((e) => e.type !== "match_start" && e.type !== "match_end")
    .sort((a, b) => b.minute - a.minute); // Mais recente primeiro (de cima para baixo)

  const homeEvents = matchEvents.filter((e) => e.team_color === teamHome);
  const awayEvents = matchEvents.filter((e) => e.team_color === teamAway);

  // Combinar todos os eventos ordenados por minuto (descendente)
  const allEventsSorted = matchEvents.sort((a, b) => b.minute - a.minute);

  const renderEventContent = (event: TimelineEvent) => {
    const playerName = event.player?.nickname || event.player?.name || "Jogador";
    const assistName = event.assist?.nickname || event.assist?.name;
    const playerInitials = playerName.substring(0, 2).toUpperCase();

    if (event.type === "goal") {
      return (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <img 
              src={iconBall} 
              alt="Gol" 
              className="w-4 h-4 sm:w-5 sm:h-5 brightness-0 invert flex-shrink-0" 
            />
            <Avatar className="h-5 w-5 sm:h-6 sm:w-6">
              <AvatarImage src={event.player?.avatar_url || undefined} />
              <AvatarFallback className="text-[8px] sm:text-[10px] bg-primary/20 text-primary">
                {playerInitials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm sm:text-base font-medium text-foreground truncate">
              {playerName}
            </span>
          </div>
          {assistName && (
            <div className="flex items-center gap-2 ml-6 sm:ml-7">
              <img 
                src={iconBoot} 
                alt="Assistência" 
                className="w-3 h-3 sm:w-4 sm:h-4 brightness-0 invert opacity-70 flex-shrink-0" 
              />
              <span className="text-xs sm:text-sm text-muted-foreground truncate">
                {assistName}
              </span>
            </div>
          )}
        </div>
      );
    }

    if (event.type === "amarelo" || event.type === "azul") {
      const cardIcon = event.type === "amarelo" ? "🟨" : "🟦";
      return (
        <div className="flex items-center gap-2">
          <span className="text-base sm:text-lg flex-shrink-0">{cardIcon}</span>
          <Avatar className="h-5 w-5 sm:h-6 sm:w-6">
            <AvatarImage src={event.player?.avatar_url || undefined} />
            <AvatarFallback className="text-[8px] sm:text-[10px] bg-primary/20 text-primary">
              {playerInitials}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm sm:text-base font-medium text-foreground truncate">
            {playerName}
          </span>
        </div>
      );
    }

    return null;
  };

  if (allEventsSorted.length === 0) {
    return (
      <div className={cn("py-8 text-center text-muted-foreground text-sm", className)}>
        Nenhum evento registrado ainda
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Timeline no estilo ESPN/OneFootball */}
      <div className="space-y-4">
        {allEventsSorted.map((event) => {
          const isHome = event.team_color === teamHome;
          const isAway = event.team_color === teamAway;

          return (
            <div
              key={event.id}
              className="flex items-start gap-2 sm:gap-4 min-h-[48px]"
            >
              {/* Coluna Esquerda - Time Casa */}
              <div className="flex-1 flex justify-end">
                {isHome && (
                  <div className="text-right pr-2 sm:pr-4">
                    {renderEventContent(event)}
                  </div>
                )}
              </div>

              {/* Minuto Central */}
              <div className="flex-shrink-0 w-12 sm:w-16 flex items-center justify-center">
                <span className="text-xs sm:text-sm font-bold text-primary bg-primary/10 px-2 py-1 rounded">
                  {formatMinute(event.minute, maxMinute)}
                </span>
              </div>

              {/* Coluna Direita - Time Visitante */}
              <div className="flex-1 flex justify-start">
                {isAway && (
                  <div className="text-left pl-2 sm:pl-4">
                    {renderEventContent(event)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Indicador de início/fim */}
      {events.some((e) => e.type === "match_start") && (
        <div className="mt-6 pt-4 border-t border-border">
          <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span>Início da partida</span>
          </div>
        </div>
      )}
    </div>
  );
}
