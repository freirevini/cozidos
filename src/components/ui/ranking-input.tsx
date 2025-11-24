import * as React from "react";
import { cn } from "@/lib/utils";

interface RankingInputProps extends Omit<React.ComponentProps<"input">, 'type'> {
  onValueChange?: (value: number) => void;
}

const RankingInput = React.forwardRef<HTMLInputElement, RankingInputProps>(
  ({ className, onValueChange, onChange, onFocus, ...props }, ref) => {
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // Selecionar todo o texto ao focar
      e.target.select();
      
      // Chamar onFocus original se existir
      if (onFocus) {
        onFocus(e);
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value) || 0;
      
      // Chamar callback de mudança de valor
      if (onValueChange) {
        onValueChange(value);
      }
      
      // Chamar onChange original se existir
      if (onChange) {
        onChange(e);
      }
    };

    return (
      <input
        type="number"
        inputMode="numeric" // Melhor teclado no mobile
        pattern="[0-9]*" // iOS numeric keyboard
        className={cn(
          // Aumentar área de toque para mobile
          "flex h-12 w-full rounded-md border border-input bg-background px-3 py-2",
          "text-base text-center font-medium",
          "ring-offset-background",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Responsivo
          "md:h-10 md:text-sm",
          // Touch feedback
          "active:scale-95 transition-transform",
          className,
        )}
        ref={ref}
        onFocus={handleFocus}
        onChange={handleChange}
        {...props}
      />
    );
  },
);
RankingInput.displayName = "RankingInput";

export { RankingInput };
