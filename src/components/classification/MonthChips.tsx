import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MonthChipsProps {
    availableMonths: number[];
    selectedMonth: number | null;
    onChange: (value: number | null) => void;
}

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function MonthChips({ availableMonths, selectedMonth, onChange }: MonthChipsProps) {
    return (
        <div className="flex space-x-2">
            <Button
                size="sm"
                variant={selectedMonth === null ? "secondary" : "ghost"}
                onClick={() => onChange(null)}
            >
                Todos
            </Button>
            {availableMonths.map((month) => (
                <Button
                    key={month}
                    size="sm"
                    variant={selectedMonth === month ? "secondary" : "ghost"}
                    onClick={() => onChange(month)}
                >
                    {monthNames[month - 1]}
                </Button>
            ))}
        </div>
    );
}