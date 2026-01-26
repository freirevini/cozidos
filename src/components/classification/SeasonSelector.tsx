import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface SeasonSelectorProps {
    seasons: number[];
    selectedSeason: number | null;
    onChange: (value: number) => void;
}

export function SeasonSelector({ seasons, selectedSeason, onChange }: SeasonSelectorProps) {
    return (
        <Select
            value={selectedSeason ? String(selectedSeason) : ""}
            onValueChange={(value) => onChange(Number(value))}
        >
            <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Temporada" />
            </SelectTrigger>
            <SelectContent>
                {seasons.map((season) => (
                    <SelectItem key={season} value={String(season)}>
                        {season}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}