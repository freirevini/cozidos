import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeamCard } from "./TeamCard";
import { cn } from "@/lib/utils";

type TeamColor = "branco" | "preto" | "azul" | "laranja";

interface TeamPlayer {
  id: string;
  player_id: string;
  team_color: string;
  profiles: {
    name: string;
    nickname: string | null;
    position: string | null;
    level: string | null;
  };
}

interface TeamsCarouselProps {
  teamsByColor: Record<string, TeamPlayer[]>;
  onTeamClick?: (teamColor: TeamColor) => void;
  className?: string;
}

export function TeamsCarousel({ teamsByColor, onTeamClick, className }: TeamsCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const teamColors = Object.keys(teamsByColor) as TeamColor[];

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = 300;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (teamColors.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum time definido
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Botões de navegação - Desktop */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => scroll("left")}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex bg-background/80 hover:bg-background shadow-lg rounded-full h-10 w-10"
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => scroll("right")}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex bg-background/80 hover:bg-background shadow-lg rounded-full h-10 w-10"
      >
        <ChevronRight className="h-6 w-6" />
      </Button>

      {/* Carrossel horizontal - Mobile */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-smooth pb-4 px-1 md:hidden"
      >
        {teamColors.map((color) => (
          <div key={color} className="snap-center shrink-0">
            <TeamCard
              teamColor={color}
              players={teamsByColor[color] || []}
              onClick={() => onTeamClick?.(color)}
              compact
            />
          </div>
        ))}
      </div>

      {/* Grid - Desktop */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-12">
        {teamColors.map((color) => (
          <TeamCard
            key={color}
            teamColor={color}
            players={teamsByColor[color] || []}
            onClick={() => onTeamClick?.(color)}
          />
        ))}
      </div>
    </div>
  );
}
