import { formatMinute } from "@/components/ui/event-item";
import { cn } from "@/lib/utils";

export type TimelineEventType = "goal" | "assist" | "amarelo" | "azul" | "match_start" | "match_end" | "substitution";

interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  minute: number;
  team_color?: string;
  player?: {
    name: string;
    nickname: string | null;
  };
  assist?: {
    name: string;
    nickname: string | null;
  };
  substitution?: {
    in: { name: string; nickname: string | null };
    out: { name: string; nickname: string | null };
  };
}

interface MatchTimelineProps {
  events: TimelineEvent[];
  teamHome: string;
  teamAway: string;
  maxMinute?: number;
  className?: string;
}

const EVENT_ICONS: Record<TimelineEventType, string> = {
  goal: "⚽",
  assist: "👟",
  amarelo: "🟨",
  azul: "💠",
  match_start: "🔵",
  match_end: "🔵",
  substitution: "🔄",
};

export function MatchTimeline({
  events,
  teamHome,
  teamAway,
  maxMinute = 12,
  className,
}: MatchTimelineProps) {
  // Separar eventos por time e ordenar por minuto
  const homeEvents = events
    .filter((e) => e.team_color === teamHome && e.type !== "match_start" && e.type !== "match_end")
    .sort((a, b) => a.minute - b.minute);

  const awayEvents = events
    .filter((e) => e.team_color === teamAway && e.type !== "match_start" && e.type !== "match_end")
    .sort((a, b) => a.minute - b.minute);

  const globalEvents = events
    .filter((e) => e.type === "match_start" || e.type === "match_end")
    .sort((a, b) => a.minute - b.minute);

  const allEventMinutes = [...homeEvents, ...awayEvents, ...globalEvents].map((e) => e.minute);
  const maxEventMinute = Math.max(...(allEventMinutes.length > 0 ? allEventMinutes : [0]), maxMinute);

  const renderEvent = (event: TimelineEvent, align: "left" | "right" | "center") => {
    const playerName = event.player?.nickname || event.player?.name || "Jogador";
    const assistName = event.assist?.nickname || event.assist?.name;

    if (event.type === "goal") {
      return (
        <div
          className={cn(
            "flex flex-col gap-1 max-w-[200px] sm:max-w-none",
            align === "left" && "items-start text-left",
            align === "right" && "items-end text-right",
            align === "center" && "items-center text-center"
          )}
        >
          <div
            className={cn(
              "flex items-center gap-1.5",
              align === "right" && "flex-row-reverse"
            )}
          >
            <span className="text-base sm:text-lg flex-shrink-0">{EVENT_ICONS.goal}</span>
            <span className="text-xs sm:text-sm font-medium">{playerName}</span>
          </div>
          {assistName && (
            <div
              className={cn(
                "flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground",
                align === "right" && "flex-row-reverse"
              )}
            >
              <span>{EVENT_ICONS.assist}</span>
              <span className="truncate">{assistName}</span>
            </div>
          )}
        </div>
      );
    }

    if (event.type === "amarelo" || event.type === "azul") {
      return (
        <div
          className={cn(
            "flex items-center gap-1.5 text-xs sm:text-sm max-w-[200px] sm:max-w-none",
            align === "right" && "flex-row-reverse"
          )}
        >
          <span className="text-base sm:text-lg flex-shrink-0">{EVENT_ICONS[event.type]}</span>
          <span className="font-medium truncate">{playerName}</span>
        </div>
      );
    }

    if (event.type === "substitution" && event.substitution) {
      return (
        <div
          className={cn(
            "flex flex-col gap-1 text-sm",
            align === "left" && "items-start text-left",
            align === "right" && "items-end text-right"
          )}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-lg">{EVENT_ICONS.substitution}</span>
            <span className="font-medium">{formatMinute(event.minute, maxMinute)}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="text-green-500">
              {event.substitution.in.nickname || event.substitution.in.name}
            </span>
            {" / "}
            <span className="text-red-500">
              {event.substitution.out.nickname || event.substitution.out.name}
            </span>
          </div>
        </div>
      );
    }

    if (event.type === "match_start" || event.type === "match_end") {
      return (
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
          <span className="text-base sm:text-lg flex-shrink-0">{EVENT_ICONS[event.type]}</span>
          <span className="whitespace-nowrap">
            {event.type === "match_start" ? "Início da partida" : "Final da partida"}
          </span>
        </div>
      );
    }

    return null;
  };

  // Combinar e ordenar todos os eventos
  const allEvents = [...homeEvents, ...awayEvents, ...globalEvents].sort(
    (a, b) => a.minute - b.minute
  );

  return (
    <div className={cn("space-y-6", className)}>
      {/* Timeline Visual */}
      <div className="relative">
        {/* Linha central vertical */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-primary/30 -translate-x-1/2" />

        {/* Eventos */}
        <div className="relative space-y-6 sm:space-y-8">
          {allEvents.map((event) => {
            const isHome = event.team_color === teamHome;
            const isAway = event.team_color === teamAway;
            const isGlobal = event.type === "match_start" || event.type === "match_end";

            return (
              <div
                key={event.id}
                className="relative flex items-start sm:items-center min-h-[50px] sm:min-h-[60px]"
              >
                {/* Evento do time da casa (esquerda) */}
                {isHome && (
                  <div className="flex-1 pr-2 sm:pr-4 text-right">
                    {renderEvent(event, "right")}
                  </div>
                )}

                {/* Marcador central */}
                <div className="relative z-10 flex-shrink-0 w-8 sm:w-12 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-primary border-2 border-background shadow-lg" />
                  <div className="absolute text-[10px] sm:text-xs text-muted-foreground -bottom-5 sm:-bottom-6 whitespace-nowrap">
                    {formatMinute(event.minute, maxMinute)}
                  </div>
                </div>

                {/* Evento do time visitante (direita) */}
                {isAway && (
                  <div className="flex-1 pl-2 sm:pl-4 text-left">
                    {renderEvent(event, "left")}
                  </div>
                )}

                {/* Eventos globais (centro) */}
                {isGlobal && (
                  <div className="flex-1 text-center px-2">
                    {renderEvent(event, "center")}
                  </div>
                )}

                {/* Espaço vazio quando evento é de um time só */}
                {isHome && <div className="flex-1 pl-2 sm:pl-4" />}
                {isAway && <div className="flex-1 pr-2 sm:pr-4" />}
              </div>
            );
          })}

          {allEvents.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum evento registrado ainda
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

