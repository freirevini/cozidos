import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProfileFiltersProps {
  availableYears: string[];
  selectedYear: number | null;
  selectedMonth: number | null;
  onYearChange: (year: number | null) => void;
  onMonthChange: (month: number | null) => void;
}

const months = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

export function ProfileFilters({
  availableYears,
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
}: ProfileFiltersProps) {
  return (
    <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-background/95 backdrop-blur border-b border-border/50">
      {/* Year filter */}
      <Select
        value={selectedYear?.toString() || "all"}
        onValueChange={(v) => onYearChange(v === "all" ? null : Number(v))}
      >
        <SelectTrigger className="w-[120px] h-10 bg-muted/30 border-border/50">
          <SelectValue placeholder="Ano" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {availableYears.map((year) => (
            <SelectItem key={year} value={year.toString()}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Month filter */}
      <Select
        value={selectedMonth?.toString() || "all"}
        onValueChange={(v) => onMonthChange(v === "all" ? null : Number(v))}
      >
        <SelectTrigger className="w-[140px] h-10 bg-muted/30 border-border/50">
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os meses</SelectItem>
          {months.map((month) => (
            <SelectItem key={month.value} value={month.value.toString()}>
              {month.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
