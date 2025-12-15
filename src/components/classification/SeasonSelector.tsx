import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown } from "lucide-react";

interface SeasonSelectorProps {
  seasons: number[];
  selectedSeason: number;
  onSeasonChange: (season: number) => void;
}

export default function SeasonSelector({ seasons, selectedSeason, onSeasonChange }: SeasonSelectorProps) {
  return (
    <Select value={selectedSeason.toString()} onValueChange={(v) => onSeasonChange(parseInt(v))}>
      <SelectTrigger className="w-auto min-w-[100px] bg-muted/20 border-border/50 rounded-full px-4 py-2 h-10">
        <SelectValue placeholder="Temporada" />
      </SelectTrigger>
      <SelectContent className="bg-card border-border">
        {seasons.map((year) => (
          <SelectItem key={year} value={year.toString()} className="cursor-pointer">
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
