import { cn } from "@/lib/utils";

export type EventType = "goal" | "amarelo" | "azul" | "match_start" | "match_end";

export interface EventItemProps {
  type: EventType;
  minute: number;
  playerName?: string;
  assistName?: string;
  isOwnGoal?: boolean;
  size?: "sm" | "md" | "lg";
  showMinute?: boolean;
  className?: string;
}

// Ícones padronizados para todos os eventos
export const EVENT_ICONS: Record<EventType, string> = {
  goal: "⚽",
  amarelo: "🟨",
  azul: "🟦",
  match_start: "🔵",
  match_end: "🔵",
};

// Nomes legíveis para tipos de evento
export const EVENT_LABELS: Record<EventType, string> = {
  goal: "Gol",
  amarelo: "Cartão Amarelo",
  azul: "Cartão Azul",
  match_start: "Início da partida",
  match_end: "Final da partida",
};

// Formatar minuto com acréscimos (partidas de 12 min)
export const formatMinute = (minute: number, matchDuration: number = 12): string => {
  if (minute > matchDuration) {
    return `${matchDuration}'+${minute - matchDuration}`;
  }
  return `${minute}'`;
};

// Tamanhos de ícone por variante
const iconSizes: Record<"sm" | "md" | "lg", string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
};

// Tamanhos de texto por variante
const textSizes: Record<"sm" | "md" | "lg", string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

const assistSizes: Record<"sm" | "md" | "lg", string> = {
  sm: "text-[10px]",
  md: "text-xs",
  lg: "text-sm",
};

export function EventItem({
  type,
  minute,
  playerName,
  assistName,
  isOwnGoal = false,
  size = "md",
  showMinute = true,
  className,
}: EventItemProps) {
  const icon = EVENT_ICONS[type];
  const formattedMinute = formatMinute(minute);

  // Conteúdo para eventos de partida (início/fim)
  if (type === "match_start" || type === "match_end") {
    return (
      <div className={cn("flex items-center gap-2", textSizes[size], className)}>
        <span className={iconSizes[size]}>{icon}</span>
        <span className="font-medium text-muted-foreground">
          {EVENT_LABELS[type]}
        </span>
        {showMinute && (
          <span className="text-muted-foreground ml-auto">{formattedMinute}</span>
        )}
      </div>
    );
  }

  // Conteúdo para gols
  if (type === "goal") {
    return (
      <div className={cn("flex items-start gap-1.5", className)}>
        <span className={iconSizes[size]}>{icon}</span>
        <div className="flex-1 min-w-0">
          <div className={cn("font-medium truncate", textSizes[size])}>
            {showMinute && `${formattedMinute} `}
            {isOwnGoal ? "Gol Contra" : playerName || "Jogador"}
          </div>
          {assistName && !isOwnGoal && (
            <div className={cn("text-muted-foreground truncate", assistSizes[size])}>
              Assist: {assistName}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Conteúdo para cartões
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className={iconSizes[size]}>{icon}</span>
      <div className={cn("flex-1 min-w-0 font-medium truncate", textSizes[size])}>
        {showMinute && `${formattedMinute} `}
        {playerName || "Jogador"}
      </div>
    </div>
  );
}

// Componente para exibir apenas o ícone do evento (para timelines, etc)
export function EventIcon({ type, size = "md" }: { type: EventType; size?: "sm" | "md" | "lg" }) {
  return <span className={iconSizes[size]}>{EVENT_ICONS[type]}</span>;
}

// Componente para card de evento completo (usado em listagens)
export function EventCard({
  type,
  minute,
  playerName,
  assistName,
  isOwnGoal = false,
  className,
}: Omit<EventItemProps, "size" | "showMinute">) {
  const icon = EVENT_ICONS[type];
  const formattedMinute = formatMinute(minute);

  return (
    <div className={cn("flex items-center gap-2 text-sm bg-muted/10 p-2 rounded", className)}>
      <span className="text-lg">{icon}</span>
      <span className="flex-1 truncate font-medium">
        {formattedMinute} {type === "goal" && isOwnGoal ? "Gol Contra" : playerName}
        {type === "goal" && assistName && !isOwnGoal && (
          <span className="text-muted-foreground text-xs">
            {" "}(Ass: {assistName})
          </span>
        )}
      </span>
    </div>
  );
}
