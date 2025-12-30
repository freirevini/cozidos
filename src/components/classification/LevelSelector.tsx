import { cn } from "@/lib/utils";

interface LevelSelectorProps {
  selectedLevel: string | null;
  onLevelChange: (level: string | null) => void;
}

const LEVELS = ["A", "B", "C", "D", "E"];

export default function LevelSelector({ selectedLevel, onLevelChange }: LevelSelectorProps) {
  return (
    <div className="relative">
      {/* Fade left indicator */}
      <div className="absolute left-0 top-0 bottom-2 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      
      <div className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth pb-2 px-6">
        <button
          onClick={() => onLevelChange(null)}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all min-h-[40px]",
            selectedLevel === null
              ? "bg-primary text-primary-foreground"
              : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
          )}
        >
          Todos
        </button>
        {LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => onLevelChange(level)}
            className={cn(
              "w-10 h-10 rounded-full text-sm font-bold whitespace-nowrap transition-all flex items-center justify-center",
              selectedLevel === level
                ? "bg-primary text-primary-foreground"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            )}
          >
            {level}
          </button>
        ))}
      </div>
      
      {/* Fade right indicator */}
      <div className="absolute right-0 top-0 bottom-2 w-6 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
    </div>
  );
}
