import { cn } from "@/lib/utils";

type TeamColor = "branco" | "vermelho" | "azul" | "laranja";

interface TeamLogoProps {
  teamColor: TeamColor;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Cores para cada time (substituindo o rosa do logo base)
const teamColorMap: Record<TeamColor, string> = {
  branco: "#FFFFFF",
  vermelho: "#DC2626", // red-600
  azul: "#2563EB", // blue-600
  laranja: "#F97316", // orange-500
};

// SVG do logo base (rosa em chamas) - será recolorido via CSS filter ou inline
const LogoBase = ({ color, size = 48 }: { color: string; size?: number }) => {
  // Ajustar cor para branco (usar borda preta)
  const isWhite = color === "#FFFFFF";
  const strokeColor = isWhite ? "#000000" : color;
  const fillColor = isWhite ? "#FFFFFF" : color;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-lg"
    >
      {/* Círculo externo com borda */}
      <circle cx="50" cy="50" r="48" fill="#000000" stroke={strokeColor} strokeWidth="2" />
      
      {/* Círculo interno branco */}
      <circle cx="50" cy="50" r="38" fill="#FFFFFF" />
      
      {/* Chama/Flame estilizada (adaptada do logo rosa) */}
      <path
        d="M30 60 Q35 45, 40 50 Q45 40, 50 45 Q55 40, 60 50 Q65 45, 70 60 Q65 70, 60 75 Q55 80, 50 75 Q45 80, 40 75 Q35 70, 30 60 Z"
        fill={fillColor}
        opacity="0.9"
      />
      
      {/* Bola de futebol sobreposta */}
      <circle cx="65" cy="45" r="12" fill="#000000" />
      <path
        d="M65 33 L65 57 M59 45 L71 45 M62 38 L68 52 M68 38 L62 52"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      
      {/* Estrelas no topo (simplificadas) */}
      <path
        d="M50 15 L52 20 L57 20 L53 23 L55 28 L50 25 L45 28 L47 23 L43 20 L48 20 Z"
        fill={fillColor}
      />
    </svg>
  );
};

export function TeamLogo({ teamColor, size = "md", className }: TeamLogoProps) {
  const color = teamColorMap[teamColor];
  const sizeMap = {
    sm: 32,
    md: 48,
    lg: 64,
  };

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <LogoBase color={color} size={sizeMap[size]} />
    </div>
  );
}

