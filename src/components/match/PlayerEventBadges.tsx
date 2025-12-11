import { cn } from "@/lib/utils";

interface PlayerEventBadgesProps {
  goals: number;
  yellowCards: number;
  blueCards: number;
  subInMinute?: number | null;
  className?: string;
}

export function PlayerEventBadges({
  goals,
  yellowCards,
  blueCards,
  subInMinute,
  className,
}: PlayerEventBadgesProps) {
  // Build list of icons to display
  const icons: { type: string; count: number }[] = [];

  // Add goals (show individual icons up to count)
  if (goals > 0) {
    icons.push({ type: "goal", count: goals });
  }

  // Add yellow cards
  if (yellowCards > 0) {
    icons.push({ type: "yellow", count: yellowCards });
  }

  // Add blue cards
  if (blueCards > 0) {
    icons.push({ type: "blue", count: blueCards });
  }

  // Add substitution indicator
  if (subInMinute !== null && subInMinute !== undefined) {
    icons.push({ type: "sub", count: 1 });
  }

  if (icons.length === 0) return null;

  // Flatten icons for display (max 3 individual, then +N)
  const flatIcons: string[] = [];
  icons.forEach(({ type, count }) => {
    for (let i = 0; i < count; i++) {
      flatIcons.push(type);
    }
  });

  const displayIcons = flatIcons.slice(0, 3);
  const extraCount = flatIcons.length - 3;

  // Generate aria-label for accessibility
  const ariaLabel = [
    goals > 0 && `${goals} gol${goals > 1 ? "s" : ""}`,
    yellowCards > 0 && `${yellowCards} cartão${yellowCards > 1 ? "ões" : ""} amarelo${yellowCards > 1 ? "s" : ""}`,
    blueCards > 0 && `${blueCards} cartão${blueCards > 1 ? "ões" : ""} azul${blueCards > 1 ? "is" : ""}`,
    subInMinute && `substituição min ${subInMinute}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className={cn(
        "absolute flex items-center gap-0.5 z-20",
        className
      )}
      style={{
        top: "-4px",
        right: "-6px",
      }}
      aria-label={ariaLabel}
      role="img"
    >
      {displayIcons.map((type, idx) => (
        <span
          key={`${type}-${idx}`}
          className="flex items-center justify-center"
          style={{ width: "14px", height: "14px" }}
        >
          {type === "goal" && (
            <span 
              role="img" 
              aria-hidden="true"
              className="text-[14px] leading-none drop-shadow-sm"
              style={{ fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif' }}
            >
              ⚽
            </span>
          )}
          {type === "yellow" && (
            <span 
              className="w-2 h-2.5 rounded-[1px] bg-yellow-400 shadow-sm"
              style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
            />
          )}
          {type === "blue" && (
            <span 
              className="w-2 h-2.5 rounded-[1px] bg-blue-500 shadow-sm"
              style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
            />
          )}
          {type === "sub" && (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-3 h-3"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path
                d="M7 17L17 7M17 7V17M17 7H7"
                stroke="#22c55e"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
      ))}
      {extraCount > 0 && (
        <span
          className="flex items-center justify-center bg-primary text-primary-foreground text-[8px] font-bold rounded-full"
          style={{ 
            minWidth: "14px", 
            height: "14px",
            padding: "0 2px",
          }}
        >
          +{extraCount}
        </span>
      )}
    </div>
  );
}
