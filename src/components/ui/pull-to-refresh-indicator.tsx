import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold = 60,
}: PullToRefreshIndicatorProps) {
  if (pullDistance <= 0 && !isRefreshing) return null;

  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = progress * 180;

  return (
    <div
      className="fixed top-0 left-0 right-0 flex justify-center items-center z-50 pointer-events-none"
      style={{
        transform: `translateY(${Math.min(pullDistance, threshold)}px)`,
        opacity: Math.min(pullDistance / 40, 1),
      }}
    >
      <div
        className={cn(
          "bg-primary text-primary-foreground px-4 py-2.5 rounded-full shadow-lg",
          "flex items-center gap-2.5 backdrop-blur-sm",
          "border border-primary-foreground/20"
        )}
      >
        <RefreshCw
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            isRefreshing && "animate-spin"
          )}
          style={{
            transform: !isRefreshing ? `rotate(${rotation}deg)` : undefined,
          }}
        />
        <span className="text-sm font-medium">
          {isRefreshing
            ? "Atualizando..."
            : pullDistance >= threshold
            ? "Solte para atualizar"
            : "Puxe para atualizar"}
        </span>
      </div>
    </div>
  );
}
