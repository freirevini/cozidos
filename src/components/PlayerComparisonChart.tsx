import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, ArrowLeftRight, Trophy, Target, Award, Equal, TrendingDown, X } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

interface PlayerRanking {
  id: string;
  player_id: string;
  nickname: string;
  avatar_url: string | null;
  gols: number;
  assistencias: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  pontos_totais: number;
}

interface PlayerComparisonChartProps {
  players: PlayerRanking[];
}

export default function PlayerComparisonChart({ players }: PlayerComparisonChartProps) {
  const [player1Id, setPlayer1Id] = useState<string>("");
  const [player2Id, setPlayer2Id] = useState<string>("");
  const [isComparing, setIsComparing] = useState(false);

  const player1 = useMemo(() => 
    players.find(p => p.player_id === player1Id), 
    [players, player1Id]
  );
  
  const player2 = useMemo(() => 
    players.find(p => p.player_id === player2Id), 
    [players, player2Id]
  );

  const comparisonData = useMemo(() => {
    if (!player1 || !player2) return [];
    
    return [
      { stat: "Gols", player1: player1.gols, player2: player2.gols },
      { stat: "Assistências", player1: player1.assistencias, player2: player2.assistencias },
      { stat: "Vitórias", player1: player1.vitorias, player2: player2.vitorias },
      { stat: "Empates", player1: player1.empates, player2: player2.empates },
      { stat: "Derrotas", player1: player1.derrotas, player2: player2.derrotas },
      { stat: "Pontos", player1: player1.pontos_totais, player2: player2.pontos_totais },
    ];
  }, [player1, player2]);

  const radarData = useMemo(() => {
    if (!player1 || !player2) return [];
    
    // Normalizar dados para radar chart (0-100)
    const maxGols = Math.max(...players.map(p => p.gols), 1);
    const maxAssists = Math.max(...players.map(p => p.assistencias), 1);
    const maxVitorias = Math.max(...players.map(p => p.vitorias), 1);
    const maxPontos = Math.max(...players.map(p => p.pontos_totais), 1);
    const maxPartidas = Math.max(...players.map(p => p.vitorias + p.empates + p.derrotas), 1);

    return [
      { 
        stat: "Gols", 
        player1: (player1.gols / maxGols) * 100, 
        player2: (player2.gols / maxGols) * 100,
        fullMark: 100 
      },
      { 
        stat: "Assists", 
        player1: (player1.assistencias / maxAssists) * 100, 
        player2: (player2.assistencias / maxAssists) * 100,
        fullMark: 100 
      },
      { 
        stat: "Vitórias", 
        player1: (player1.vitorias / maxVitorias) * 100, 
        player2: (player2.vitorias / maxVitorias) * 100,
        fullMark: 100 
      },
      { 
        stat: "Pontos", 
        player1: (player1.pontos_totais / maxPontos) * 100, 
        player2: (player2.pontos_totais / maxPontos) * 100,
        fullMark: 100 
      },
      { 
        stat: "Partidas", 
        player1: ((player1.vitorias + player1.empates + player1.derrotas) / maxPartidas) * 100, 
        player2: ((player2.vitorias + player2.empates + player2.derrotas) / maxPartidas) * 100,
        fullMark: 100 
      },
    ];
  }, [player1, player2, players]);

  const getWinner = (stat: string) => {
    if (!player1 || !player2) return null;
    
    const value1 = stat === "Gols" ? player1.gols :
                   stat === "Assistências" ? player1.assistencias :
                   stat === "Vitórias" ? player1.vitorias :
                   stat === "Empates" ? player1.empates :
                   stat === "Derrotas" ? player2.derrotas : // Menos derrotas é melhor
                   player1.pontos_totais;
    
    const value2 = stat === "Gols" ? player2.gols :
                   stat === "Assistências" ? player2.assistencias :
                   stat === "Vitórias" ? player2.vitorias :
                   stat === "Empates" ? player2.empates :
                   stat === "Derrotas" ? player1.derrotas :
                   player2.pontos_totais;

    if (stat === "Derrotas") {
      return player1.derrotas < player2.derrotas ? 1 : player1.derrotas > player2.derrotas ? 2 : 0;
    }
    
    return value1 > value2 ? 1 : value1 < value2 ? 2 : 0;
  };

  const handleStartComparison = () => {
    if (player1Id && player2Id) {
      setIsComparing(true);
    }
  };

  const handleClearComparison = () => {
    setIsComparing(false);
    setPlayer1Id("");
    setPlayer2Id("");
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (players.length < 2) {
    return null;
  }

  return (
    <Card className="card-glow bg-card border-border mb-6">
      <CardHeader>
        <CardTitle className="text-lg md:text-xl font-bold text-primary flex items-center gap-2">
          <Users className="h-5 w-5" />
          Comparar Jogadores
        </CardTitle>
      </CardHeader>

      <CardContent>
        {!isComparing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Seleção Jogador 1 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Jogador 1</label>
                <Select value={player1Id} onValueChange={setPlayer1Id}>
                  <SelectTrigger className="w-full h-12">
                    <SelectValue placeholder="Selecione o jogador" />
                  </SelectTrigger>
                  <SelectContent>
                    {players.map((player) => (
                      <SelectItem 
                        key={player.player_id} 
                        value={player.player_id}
                        disabled={player.player_id === player2Id}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            {player.avatar_url ? (
                              <AvatarImage src={player.avatar_url} alt={player.nickname} />
                            ) : (
                              <AvatarFallback className="text-xs">
                                {player.nickname.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <span>{player.nickname}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Seleção Jogador 2 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Jogador 2</label>
                <Select value={player2Id} onValueChange={setPlayer2Id}>
                  <SelectTrigger className="w-full h-12">
                    <SelectValue placeholder="Selecione o jogador" />
                  </SelectTrigger>
                  <SelectContent>
                    {players.map((player) => (
                      <SelectItem 
                        key={player.player_id} 
                        value={player.player_id}
                        disabled={player.player_id === player1Id}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            {player.avatar_url ? (
                              <AvatarImage src={player.avatar_url} alt={player.nickname} />
                            ) : (
                              <AvatarFallback className="text-xs">
                                {player.nickname.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <span>{player.nickname}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={handleStartComparison}
              disabled={!player1Id || !player2Id}
              className="w-full min-h-[44px]"
            >
              <ArrowLeftRight className="h-4 w-4 mr-2" />
              Comparar
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header com jogadores */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                {/* Jogador 1 */}
                <div className="flex items-center gap-2">
                  <Avatar className="h-10 w-10 ring-2 ring-primary">
                    {player1?.avatar_url ? (
                      <AvatarImage src={player1.avatar_url} alt={player1.nickname} />
                    ) : (
                      <AvatarFallback>
                        {player1?.nickname.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <span className="font-bold text-primary">{player1?.nickname}</span>
                </div>

                <span className="text-muted-foreground font-bold">VS</span>

                {/* Jogador 2 */}
                <div className="flex items-center gap-2">
                  <Avatar className="h-10 w-10 ring-2 ring-secondary">
                    {player2?.avatar_url ? (
                      <AvatarImage src={player2.avatar_url} alt={player2.nickname} />
                    ) : (
                      <AvatarFallback>
                        {player2?.nickname.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <span className="font-bold text-secondary-foreground">{player2?.nickname}</span>
                </div>
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleClearComparison}
                className="min-h-[44px]"
              >
                <X className="h-4 w-4 mr-2" />
                Nova Comparação
              </Button>
            </div>

            {/* Comparação lado a lado */}
            <div className="grid grid-cols-3 gap-2 md:gap-4">
              {comparisonData.map((item) => {
                const winner = getWinner(item.stat);
                return (
                  <div 
                    key={item.stat} 
                    className="bg-muted/20 rounded-lg p-3 text-center"
                  >
                    <div className="text-xs md:text-sm text-muted-foreground mb-2">
                      {item.stat}
                    </div>
                    <div className="flex items-center justify-center gap-2 md:gap-4">
                      <span className={`text-lg md:text-2xl font-bold ${winner === 1 ? 'text-green-500' : winner === 2 ? 'text-red-500' : 'text-foreground'}`}>
                        {item.player1}
                      </span>
                      <span className="text-muted-foreground">-</span>
                      <span className={`text-lg md:text-2xl font-bold ${winner === 2 ? 'text-green-500' : winner === 1 ? 'text-red-500' : 'text-foreground'}`}>
                        {item.player2}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Gráfico de Barras */}
            <div className="h-64 md:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                  <YAxis 
                    dataKey="stat" 
                    type="category" 
                    width={80}
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar 
                    dataKey="player1" 
                    name={player1?.nickname || "Jogador 1"} 
                    fill="hsl(var(--primary))" 
                    radius={[0, 4, 4, 0]}
                  />
                  <Bar 
                    dataKey="player2" 
                    name={player2?.nickname || "Jogador 2"} 
                    fill="hsl(var(--secondary))" 
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Radar Chart - Desktop only */}
            <div className="hidden md:block h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis 
                    dataKey="stat" 
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 12 }}
                  />
                  <PolarRadiusAxis 
                    angle={30} 
                    domain={[0, 100]} 
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Radar
                    name={player1?.nickname || "Jogador 1"}
                    dataKey="player1"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.3}
                  />
                  <Radar
                    name={player2?.nickname || "Jogador 2"}
                    dataKey="player2"
                    stroke="hsl(var(--secondary))"
                    fill="hsl(var(--secondary))"
                    fillOpacity={0.3}
                  />
                  <Legend />
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Resumo */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/10 rounded-lg">
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">Pontos Totais</div>
                <div className={`text-2xl md:text-3xl font-bold ${
                  (player1?.pontos_totais || 0) > (player2?.pontos_totais || 0) 
                    ? 'text-green-500' 
                    : (player1?.pontos_totais || 0) < (player2?.pontos_totais || 0)
                    ? 'text-red-500'
                    : 'text-foreground'
                }`}>
                  {player1?.pontos_totais || 0}
                </div>
                <div className="text-xs text-muted-foreground">{player1?.nickname}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">Pontos Totais</div>
                <div className={`text-2xl md:text-3xl font-bold ${
                  (player2?.pontos_totais || 0) > (player1?.pontos_totais || 0) 
                    ? 'text-green-500' 
                    : (player2?.pontos_totais || 0) < (player1?.pontos_totais || 0)
                    ? 'text-red-500'
                    : 'text-foreground'
                }`}>
                  {player2?.pontos_totais || 0}
                </div>
                <div className="text-xs text-muted-foreground">{player2?.nickname}</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
