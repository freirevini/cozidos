import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Round {
    id: string;
    round_number: number;
    scheduled_date: string;
    status: string;
}

interface RoundCarouselProps {
    rounds: Round[];
    selectedRoundId: string | null;
    onSelectRound: (roundId: string) => void;
}

export function RoundCarousel({ rounds, selectedRoundId, onSelectRound }: RoundCarouselProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkScrollPosition = () => {
        const container = scrollContainerRef.current;
        if (!container) return;

        setCanScrollLeft(container.scrollLeft > 10);
        setCanScrollRight(
            container.scrollLeft < container.scrollWidth - container.clientWidth - 10
        );
    };

    const scrollBy = (direction: 'left' | 'right') => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const scrollAmount = direction === 'left' ? -120 : 120;
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });

        setTimeout(checkScrollPosition, 350);
    };

    // Auto-scroll to selected item
    useEffect(() => {
        if (!selectedRoundId || !scrollContainerRef.current) return;

        const container = scrollContainerRef.current;
        const selectedIndex = rounds.findIndex(r => r.id === selectedRoundId);
        if (selectedIndex === -1) return;

        const items = container.querySelectorAll('[data-round-item]');
        const selectedItem = items[selectedIndex] as HTMLElement;

        if (selectedItem) {
            selectedItem.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }

        setTimeout(checkScrollPosition, 350);
    }, [selectedRoundId, rounds]);

    useEffect(() => {
        checkScrollPosition();
        window.addEventListener('resize', checkScrollPosition);
        return () => window.removeEventListener('resize', checkScrollPosition);
    }, [rounds]);

    const formatShortDate = (dateString: string) => {
        try {
            const date = new Date(dateString + "T00:00:00");
            return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        } catch {
            return "";
        }
    };

    return (
        <div className="relative bg-muted/30 rounded-xl p-2 border border-border/50 mb-4">
            {/* Desktop Arrows */}
            <div className="hidden sm:block">
                {canScrollLeft && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => scrollBy('left')}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-full w-10 rounded-l-xl bg-gradient-to-r from-muted via-muted/80 to-transparent"
                    >
                        <ChevronLeft size={20} />
                    </Button>
                )}
                {canScrollRight && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => scrollBy('right')}
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-full w-10 rounded-r-xl bg-gradient-to-l from-muted via-muted/80 to-transparent"
                    >
                        <ChevronRight size={20} />
                    </Button>
                )}
            </div>

            {/* Rounds Container */}
            <div
                ref={scrollContainerRef}
                className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory px-1 py-1"
                onScroll={checkScrollPosition}
            >
                {rounds.map((round) => (
                    <button
                        key={round.id}
                        data-round-item
                        onClick={() => onSelectRound(round.id)}
                        className={cn(
                            "flex flex-col items-center justify-center min-w-[70px] p-2.5 rounded-xl border-2 transition-all snap-center shrink-0",
                            round.id === selectedRoundId
                                ? "border-primary bg-primary/20 shadow-lg shadow-primary/30 scale-105"
                                : "border-border/60 bg-card/80 hover:border-primary/50 hover:bg-muted/40"
                        )}
                    >
                        <span className={cn(
                            "text-lg font-bold",
                            round.id === selectedRoundId ? "text-primary" : "text-foreground"
                        )}>
                            {round.round_number}
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                            {formatShortDate(round.scheduled_date)}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}
