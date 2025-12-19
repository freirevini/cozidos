import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface PlayerRankItemProps {
  rank: number;
  nickname: string;
  avatarUrl: string | null;
  level: string | null;
  points: number;
  presence: number;
  onClick?: () => void;
}

const levelColors: Record<string, string> = {
  A: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  B: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  C: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  D: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  E: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function PlayerRankItem({
  rank,
  nickname,
  avatarUrl,
  level,
  points,
  presence,
  onClick,
}: PlayerRankItemProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 border-b border-border/30 hover:bg-muted/20 transition-colors",
        onClick && "cursor-pointer"
      )}
    >
      {/* Rank */}
      <span className="w-8 text-lg font-bold text-primary">{rank}</span>

      {/* Avatar */}
      <Avatar className="h-10 w-10 border-2 border-border/50 bg-muted">
        <AvatarImage src={avatarUrl || undefined} alt={nickname} />
        <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
          {nickname?.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* Name + Level Badge */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-foreground font-medium truncate">{nickname}</span>
          {level && (
            <span
              className={cn(
                "px-2 py-0.5 text-xs font-bold rounded-full border",
                levelColors[level] || "bg-muted/30 text-muted-foreground"
              )}
            >
              {level}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-right">
        <div className="text-center">
          <div className="text-lg font-bold text-foreground">{points}</div>
          <div className="text-[10px] text-muted-foreground uppercase">PTS</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-medium text-muted-foreground">{presence}</div>
          <div className="text-[10px] text-muted-foreground uppercase">PR</div>
        </div>
      </div>
    </div>
  );
}
