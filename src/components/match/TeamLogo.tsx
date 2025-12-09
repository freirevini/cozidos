import { cn } from "@/lib/utils";

import teamBranco from "@/assets/team-branco.png";
import teamVermelho from "@/assets/team-vermelho.png";
import teamAzul from "@/assets/team-azul.png";
import teamLaranja from "@/assets/team-laranja.png";

type TeamColor = "branco" | "vermelho" | "azul" | "laranja";

interface TeamLogoProps {
  teamColor: TeamColor;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const teamLogoMap: Record<TeamColor, string> = {
  branco: teamBranco,
  vermelho: teamVermelho,
  azul: teamAzul,
  laranja: teamLaranja,
};

const sizeMap = {
  xs: 24,
  sm: 36,
  md: 48,
  lg: 64,
  xl: 80,
};

export function TeamLogo({ teamColor, size = "md", className }: TeamLogoProps) {
  const logo = teamLogoMap[teamColor];
  const pixelSize = sizeMap[size];

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <img 
        src={logo} 
        alt={`Time ${teamColor}`}
        width={pixelSize}
        height={pixelSize}
        className="object-contain drop-shadow-lg"
      />
    </div>
  );
}
