import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface LevelSelectorProps {
    selectedLevel: string | null;
    onChange: (value: string | null) => void;
}

const levels = ["A", "B", "C", "D", "E"];

export function LevelSelector({ selectedLevel, onChange }: LevelSelectorProps) {
    return (
        <Select
            value={selectedLevel ?? ""}
            onValueChange={(value) => onChange(value === "all" ? null : value)}
        >
            <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Nível" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {levels.map((level) => (
                    <SelectItem key={level} value={level}>
                        Nível {level}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}