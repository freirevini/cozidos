import * as React from "react";
import { cn } from "@/lib/utils";

interface RankingInputProps extends Omit<React.ComponentProps<"input">, 'type'> {
  onValueChange?: (value: number) => void;
}

const RankingInput = React.forwardRef<HTMLInputElement, RankingInputProps>(
  ({ className, onValueChange, onChange, onFocus, min = 0, ...props }, ref) => {
    const minValue = typeof min === 'string' ? parseInt(min) : (min as number);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // Selecionar todo o texto ao focar
      e.target.select();
      
      // Chamar onFocus original se existir
      if (onFocus) {
        onFocus(e);
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = parseInt(e.target.value) || 0;
      
      // Garantir que valor não seja menor que o mínimo
      if (value < minValue) {
        value = minValue;
        e.target.value = String(minValue);
      }
      
      // Chamar callback de mudança de valor
      if (onValueChange) {
        onValueChange(value);
      }
      
      // Chamar onChange original se existir
      if (onChange) {
        onChange(e);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Bloquear tecla de menos se min >= 0
      if (minValue >= 0 && e.key === '-') {
        e.preventDefault();
      }
    };

    return (
      <input
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        min={min}
        className={cn(
          "flex h-12 w-full rounded-md border border-input bg-background px-3 py-2",
          "text-base text-center font-medium",
          "ring-offset-background",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "md:h-10 md:text-sm",
          "active:scale-95 transition-transform",
          className,
        )}
        ref={ref}
        onFocus={handleFocus}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
  },
);
RankingInput.displayName = "RankingInput";

export { RankingInput };
