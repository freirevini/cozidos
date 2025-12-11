import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PlayerFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterStatus: string;
  onStatusChange: (value: string) => void;
  filterPosition: string;
  onPositionChange: (value: string) => void;
  totalCount: number;
  filteredCount: number;
}

const statusChips = [
  { value: "all", label: "Todos" },
  { value: "aprovado", label: "Aprovados" },
  { value: "pendente", label: "Pendentes" },
  { value: "congelado", label: "Congelados" },
  { value: "rejeitado", label: "Rejeitados" },
];

const positionChips = [
  { value: "all", label: "Todas", icon: "👥" },
  { value: "goleiro", label: "GOL", icon: "🧤" },
  { value: "defensor", label: "DEF", icon: "🛡️" },
  { value: "meio-campista", label: "MEI", icon: "⚙️" },
  { value: "atacante", label: "ATA", icon: "⚡" },
];

export function PlayerFilters({
  searchTerm,
  onSearchChange,
  filterStatus,
  onStatusChange,
  filterPosition,
  onPositionChange,
  totalCount,
  filteredCount,
}: PlayerFiltersProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3">
      {/* Barra de busca */}
      <div className={cn(
        "relative flex items-center rounded-xl border bg-background/50 transition-all duration-200",
        isFocused ? "border-primary shadow-sm shadow-primary/20" : "border-border/50"
      )}>
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Buscar por nome, email, posição..."
          className="pl-9 pr-9 h-11 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        {searchTerm && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 p-1 rounded-full hover:bg-muted/50 transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Chips de Status */}
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
        <div className="flex gap-2 pb-1">
          {statusChips.map((chip) => (
            <button
              key={chip.value}
              onClick={() => onStatusChange(chip.value)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                filterStatus === chip.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chips de Posição */}
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
        <div className="flex gap-2 pb-1">
          {positionChips.map((chip) => (
            <button
              key={chip.value}
              onClick={() => onPositionChange(chip.value === filterPosition ? "all" : chip.value)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1",
                filterPosition === chip.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              <span>{chip.icon}</span>
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Contador */}
      <div className="text-xs text-muted-foreground text-center">
        {filteredCount === totalCount
          ? `${totalCount} jogadores`
          : `${filteredCount} de ${totalCount} jogadores`}
      </div>
    </div>
  );
}
