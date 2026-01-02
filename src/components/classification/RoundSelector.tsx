import { cn } from "@/lib/utils";

interface Round {
    id: string;
    round_number: number;
    scheduled_date: string;
}

interface RoundSelectorProps {
    rounds: Round[];
    selectedRoundId: string | null;
    onRoundChange: (roundId: string | null) => void;
}

export default function RoundSelector({ rounds, selectedRoundId, onRoundChange }: RoundSelectorProps) {
    if (rounds.length === 0) return null;

    return (
        <div className="relative">
            {/* Fade left indicator */}
            <div className="absolute left-0 top-0 bottom-2 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />

            <div className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth pb-2 px-6">
                <button
                    onClick={() => onRoundChange(null)}
                    className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all min-h-[40px]",
                        selectedRoundId === null
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                    )}
                >
                    Todas
                </button>
                {rounds.map((round) => (
                    <button
                        key={round.id}
                        onClick={() => onRoundChange(round.id)}
                        className={cn(
                            "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all min-h-[40px] flex items-center justify-center",
                            selectedRoundId === round.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                        )}
                    >
                        Rodada {round.round_number}
                    </button>
                ))}
            </div>

            {/* Fade right indicator */}
            <div className="absolute right-0 top-0 bottom-2 w-6 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
        </div>
    );
}
