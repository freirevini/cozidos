import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SeasonSelectorProps {
  seasons: number[];
  selectedSeason: number | null; // null = "Todos"
  onSeasonChange: (season: number | null) => void;
}

export default function SeasonSelector({ seasons, selectedSeason, onSeasonChange }: SeasonSelectorProps) {
  return (
    <Select 
      value={selectedSeason?.toString() ?? "todos"} 
      onValueChange={(v) => onSeasonChange(v === "todos" ? null : parseInt(v))}
    >
      <SelectTrigger className="w-auto min-w-[100px] bg-muted/20 border-border/50 rounded-full px-4 py-2 h-10">
        <SelectValue placeholder="Temporada" />
      </SelectTrigger>
      <SelectContent className="bg-card border-border">
        {/* Anos ordenados: mais recente primeiro */}
        {seasons.map((year) => (
          <SelectItem key={year} value={year.toString()} className="cursor-pointer">
            {year}
          </SelectItem>
        ))}
        {/* "Todos" no final */}
        <SelectItem value="todos" className="cursor-pointer font-semibold text-primary">
          Todos
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
