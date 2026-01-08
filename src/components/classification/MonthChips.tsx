import { cn } from "@/lib/utils";

interface MonthChipsProps {
  availableMonths: number[];
  selectedMonth: number | null;
  onMonthChange: (month: number | null) => void;
}

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

export default function MonthChips({ availableMonths, selectedMonth, onMonthChange }: MonthChipsProps) {
  return (
    <div className="relative">
      {/* Fade left indicator */}
      <div className="absolute left-0 top-0 bottom-2 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />

      {/* Snap scroll container */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth pb-2 px-6 snap-x snap-mandatory">
        <button
          onClick={() => onMonthChange(null)}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all h-11 snap-start",
            selectedMonth === null
              ? "bg-primary text-primary-foreground"
              : "bg-muted/30 text-muted-foreground hover:bg-muted/50 active:bg-muted/70"
          )}
        >
          Todos
        </button>
        {availableMonths.map((month) => (
          <button
            key={month}
            onClick={() => onMonthChange(month)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all h-11 snap-start",
              selectedMonth === month
                ? "bg-primary text-primary-foreground"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50 active:bg-muted/70"
            )}
          >
            {MONTH_NAMES[month - 1]}
          </button>
        ))}
      </div>

      {/* Fade right indicator */}
      <div className="absolute right-0 top-0 bottom-2 w-6 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
    </div>
  );
}
