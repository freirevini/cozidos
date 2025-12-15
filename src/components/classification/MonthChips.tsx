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
    <div className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth pb-2 px-1">
      <button
        onClick={() => onMonthChange(null)}
        className={cn(
          "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all min-h-[40px]",
          selectedMonth === null
            ? "bg-primary text-primary-foreground"
            : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
        )}
      >
        Geral
      </button>
      {availableMonths.map((month) => (
        <button
          key={month}
          onClick={() => onMonthChange(month)}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all min-h-[40px]",
            selectedMonth === month
              ? "bg-primary text-primary-foreground"
              : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
          )}
        >
          {MONTH_NAMES[month - 1]}
        </button>
      ))}
    </div>
  );
}
