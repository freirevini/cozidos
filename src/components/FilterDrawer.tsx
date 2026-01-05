import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Filter, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FilterState {
    season: number | null;
    month: number | null;
    level: string | null;
    roundId: string | null;
}

interface FilterDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (filters: FilterState) => void;
    currentFilters: FilterState;
    // Available options
    seasons: number[];
    availableMonths: number[];
    rounds?: Array<{ id: string; round_number: number; scheduled_date: string }>;
    // Control which filters to show
    showLevel?: boolean;
    showRounds?: boolean;
}

const LEVELS = ["A", "B", "C", "D", "E"];

const MONTH_NAMES: Record<number, string> = {
    1: "Jan", 2: "Fev", 3: "Mar", 4: "Abr",
    5: "Mai", 6: "Jun", 7: "Jul", 8: "Ago",
    9: "Set", 10: "Out", 11: "Nov", 12: "Dez"
};

export default function FilterDrawer({
    isOpen,
    onClose,
    onApply,
    currentFilters,
    seasons,
    availableMonths,
    rounds = [],
    showLevel = true,
    showRounds = true,
}: FilterDrawerProps) {
    // Local state for editing
    const [localFilters, setLocalFilters] = useState<FilterState>(currentFilters);

    // Reset local state when drawer opens
    useEffect(() => {
        if (isOpen) {
            setLocalFilters(currentFilters);
        }
    }, [isOpen, currentFilters]);

    const handleClearAll = () => {
        setLocalFilters({
            season: seasons[0] || new Date().getFullYear(),
            month: null,
            level: null,
            roundId: null,
        });
    };

    const handleApply = () => {
        onApply(localFilters);
        onClose();
    };

    const activeFiltersCount = [
        localFilters.month !== null,
        localFilters.level !== null,
        localFilters.roundId !== null,
    ].filter(Boolean).length;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-background z-50 flex flex-col shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <div className="flex items-center gap-2">
                                <Filter className="w-5 h-5 text-primary" />
                                <h2 className="text-lg font-bold text-foreground">Filtros</h2>
                                {activeFiltersCount > 0 && (
                                    <span className="px-2 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                                        {activeFiltersCount}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleClearAll}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <Trash2 className="w-4 h-4 mr-1" />
                                    Limpar
                                </Button>
                                <Button variant="ghost" size="icon" onClick={onClose}>
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>

                        {/* Filters Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {/* Temporada */}
                            <FilterSection title="Por temporada:">
                                <div className="flex flex-wrap gap-2">
                                    {seasons.map((year) => (
                                        <FilterChip
                                            key={year}
                                            label={String(year)}
                                            selected={localFilters.season === year}
                                            onClick={() => setLocalFilters(prev => ({ ...prev, season: year }))}
                                        />
                                    ))}
                                </div>
                            </FilterSection>

                            {/* Mês */}
                            <FilterSection title="Por mês:">
                                <div className="flex flex-wrap gap-2">
                                    <FilterChip
                                        label="Todos"
                                        selected={localFilters.month === null}
                                        onClick={() => setLocalFilters(prev => ({ ...prev, month: null }))}
                                    />
                                    {availableMonths.map((month) => (
                                        <FilterChip
                                            key={month}
                                            label={MONTH_NAMES[month]}
                                            selected={localFilters.month === month}
                                            onClick={() => setLocalFilters(prev => ({ ...prev, month }))}
                                        />
                                    ))}
                                </div>
                            </FilterSection>

                            {/* Nível */}
                            {showLevel && (
                                <FilterSection title="Por nível:">
                                    <div className="flex flex-wrap gap-2">
                                        <FilterChip
                                            label="Todos"
                                            selected={localFilters.level === null}
                                            onClick={() => setLocalFilters(prev => ({ ...prev, level: null }))}
                                        />
                                        {LEVELS.map((level) => (
                                            <FilterChip
                                                key={level}
                                                label={`Nível ${level}`}
                                                selected={localFilters.level === level}
                                                onClick={() => setLocalFilters(prev => ({ ...prev, level }))}
                                            />
                                        ))}
                                    </div>
                                </FilterSection>
                            )}

                            {/* Rodada */}
                            {showRounds && rounds.length > 0 && (
                                <FilterSection title="Por rodada:">
                                    <div className="flex flex-wrap gap-2">
                                        <FilterChip
                                            label="Todas"
                                            selected={localFilters.roundId === null}
                                            onClick={() => setLocalFilters(prev => ({ ...prev, roundId: null }))}
                                        />
                                        {rounds.map((round) => (
                                            <FilterChip
                                                key={round.id}
                                                label={`Rodada ${round.round_number}`}
                                                selected={localFilters.roundId === round.id}
                                                onClick={() => setLocalFilters(prev => ({ ...prev, roundId: round.id }))}
                                            />
                                        ))}
                                    </div>
                                </FilterSection>
                            )}
                        </div>

                        {/* Footer - Extra padding to avoid navbar overlap */}
                        <div className="p-4 pb-28 border-t border-border">
                            <Button
                                onClick={handleApply}
                                className="w-full rounded-full"
                                size="lg"
                            >
                                <Check className="w-4 h-4 mr-2" />
                                Aplicar Filtros
                            </Button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

// Helper Components
function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {children}
        </div>
    );
}

function FilterChip({
    label,
    selected,
    onClick,
}: {
    label: string;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border",
                selected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:border-primary hover:text-primary"
            )}
        >
            {label}
        </button>
    );
}

// Badge component to show active filters summary
export function FilterBadge({
    filters,
    seasons,
    rounds,
    showLevel = true,
}: {
    filters: FilterState;
    seasons: number[];
    rounds?: Array<{ id: string; round_number: number }>;
    showLevel?: boolean;
}) {
    const parts: string[] = [];

    if (filters.season) {
        parts.push(String(filters.season));
    }

    if (filters.month !== null) {
        parts.push(MONTH_NAMES[filters.month]);
    }

    if (showLevel && filters.level !== null) {
        parts.push(`Nível ${filters.level}`);
    }

    if (filters.roundId && rounds) {
        const round = rounds.find(r => r.id === filters.roundId);
        if (round) {
            parts.push(`Rodada ${round.round_number}`);
        }
    }

    if (parts.length === 0) return null;

    return (
        <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded-full">
            <span className="text-primary">📌</span>
            <span>{parts.join(" • ")}</span>
        </div>
    );
}
