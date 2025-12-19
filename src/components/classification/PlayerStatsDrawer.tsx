import { useNavigate } from "react-router-dom";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

interface PlayerStats {
  player_id: string;
  nickname: string;
  avatar_url: string | null;
  level: string | null;
  presencas: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  atrasos: number;
  faltas: number;
  punicoes: number;
  cartoes_amarelos: number;
  cartoes_azuis: number;
  gols: number;
  assistencias: number;
  pontos_totais: number;
}

interface PlayerStatsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: PlayerStats | null;
  selectedYear?: number | null;
  selectedMonth?: number | null;
}

const levelColors: Record<string, string> = {
  A: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  B: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  C: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  D: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  E: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function PlayerStatsDrawer({ open, onOpenChange, player, selectedYear, selectedMonth }: PlayerStatsDrawerProps) {
  const navigate = useNavigate();

  if (!player) return null;

  const handleViewFullProfile = () => {
    onOpenChange(false);
    const params = new URLSearchParams();
    if (selectedYear) params.set("year", String(selectedYear));
    if (selectedMonth) params.set("month", String(selectedMonth));
    const queryString = params.toString();
    navigate(`/profile/${player.player_id}${queryString ? `?${queryString}` : ""}`);
  };

  const statItems = [
    { label: "Pontos Totais", value: player.pontos_totais, icon: "🏆", highlight: true },
    { label: "Presenças", value: player.presencas, icon: "✅" },
    { label: "Vitórias", value: player.vitorias, icon: "🥇" },
    { label: "Empates", value: player.empates, icon: "🤝" },
    { label: "Derrotas", value: player.derrotas, icon: "📉" },
    { label: "Gols", value: player.gols, icon: "⚽" },
    { label: "Assistências", value: player.assistencias, icon: "🎯" },
    { label: "Atrasos", value: player.atrasos, icon: "⏰" },
    { label: "Faltas", value: player.faltas, icon: "❌" },
    { label: "Punições", value: player.punicoes, icon: "⚠️" },
    { label: "Cartões Amarelos", value: player.cartoes_amarelos, icon: "🟨" },
    { label: "Cartões Azuis", value: player.cartoes_azuis, icon: "🟦" },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-border bg-background max-h-[85vh]">
        <div className="mx-auto w-full max-w-md">
          <DrawerHeader className="pb-2">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-primary/50 bg-muted">
                <AvatarImage src={player.avatar_url || undefined} alt={player.nickname} />
                <AvatarFallback className="bg-primary/20 text-primary font-bold text-xl">
                  {player.nickname?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <DrawerTitle className="text-xl text-foreground flex items-center gap-2">
                  {player.nickname}
                  {player.level && (
                    <span
                      className={cn(
                        "px-2 py-0.5 text-xs font-bold rounded-full border",
                        levelColors[player.level] || "bg-muted/30"
                      )}
                    >
                      {player.level}
                    </span>
                  )}
                </DrawerTitle>
                <DrawerDescription className="text-muted-foreground">
                  Estatísticas do jogador
                </DrawerDescription>
              </div>
            </div>
          </DrawerHeader>

          <div className="px-4 pb-6 overflow-y-auto max-h-[60vh]">
            <div className="grid grid-cols-2 gap-3">
              {statItems.map((stat) => (
                <div
                  key={stat.label}
                  className={cn(
                    "rounded-xl p-4 border transition-colors",
                    stat.highlight
                      ? "bg-primary/10 border-primary/30 col-span-2"
                      : "bg-muted/20 border-border/30"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{stat.icon}</span>
                    <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
                  </div>
                  <div
                    className={cn(
                      "font-bold",
                      stat.highlight ? "text-3xl text-primary" : "text-2xl text-foreground"
                    )}
                  >
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Performance summary */}
            <div className="mt-4 p-4 rounded-xl bg-muted/10 border border-border/20">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Resumo de Desempenho</h4>
              <div className="flex justify-between items-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-400">{player.vitorias}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Vitórias</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">{player.empates}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Empates</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">{player.derrotas}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Derrotas</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border/20">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxa de Aproveitamento</span>
                  <span className="font-bold text-foreground">
                    {player.vitorias + player.empates + player.derrotas > 0
                      ? Math.round(
                        ((player.vitorias * 3 + player.empates) /
                          ((player.vitorias + player.empates + player.derrotas) * 3)) *
                        100
                      )
                      : 0}
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* View Full Profile Button */}
            <Button
              onClick={handleViewFullProfile}
              className="w-full mt-4"
              variant="outline"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Ver Perfil Completo
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
