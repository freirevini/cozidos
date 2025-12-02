import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";
import { TrendingUp, Trophy, Target, Users } from "lucide-react";

interface RoundStats {
  round_id: string;
  round_number: number;
  scheduled_date: string;
  total_points: number;
  victories: number;
  draws: number;
  defeats: number;
  goals: number;
  assists: number;
  presence: boolean;
  yellow_cards: number;
  blue_cards: number;
}

interface PlayerPerformanceChartProps {
  playerId: string;
  playerEmail?: string;
}

export default function PlayerPerformanceChart({ playerId, playerEmail }: PlayerPerformanceChartProps) {
  const [roundStats, setRoundStats] = useState<RoundStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("points");

  useEffect(() => {
    if (playerId || playerEmail) {
      loadRoundStats();
    }
  }, [playerId, playerEmail]);

  const loadRoundStats = async () => {
    setLoading(true);
    try {
      // First, get player profile ID if we have email
      let profileId = playerId;
      
      if (!profileId && playerEmail) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", playerEmail.toLowerCase())
          .maybeSingle();
        
        if (profileData) {
          profileId = profileData.id;
        }
      }

      if (!profileId) {
        setLoading(false);
        return;
      }

      // Get all round stats for this player
      const { data: statsData, error: statsError } = await supabase
        .from("player_round_stats")
        .select(`
          round_id,
          total_points,
          victories,
          draws,
          defeats,
          yellow_cards,
          blue_cards,
          presence_points,
          goal_points
        `)
        .eq("player_id", profileId)
        .order("created_at", { ascending: true });

      if (statsError) throw statsError;

      if (!statsData || statsData.length === 0) {
        setRoundStats([]);
        setLoading(false);
        return;
      }

      // Get round details
      const roundIds = statsData.map(s => s.round_id);
      const { data: roundsData, error: roundsError } = await supabase
        .from("rounds")
        .select("id, round_number, scheduled_date")
        .in("id", roundIds)
        .order("round_number", { ascending: true });

      if (roundsError) throw roundsError;

      // Get goals count per round
      const { data: goalsData } = await supabase
        .from("goals")
        .select("match_id, matches!inner(round_id)")
        .eq("player_id", profileId)
        .eq("is_own_goal", false);

      // Get assists count per round
      const { data: assistsData } = await supabase
        .from("assists")
        .select("goal_id, goals!inner(match_id, matches!inner(round_id))")
        .eq("player_id", profileId);

      // Count goals per round
      const goalsPerRound: Record<string, number> = {};
      goalsData?.forEach(g => {
        const roundId = (g.matches as any)?.round_id;
        if (roundId) {
          goalsPerRound[roundId] = (goalsPerRound[roundId] || 0) + 1;
        }
      });

      // Count assists per round
      const assistsPerRound: Record<string, number> = {};
      assistsData?.forEach(a => {
        const roundId = (a.goals as any)?.matches?.round_id;
        if (roundId) {
          assistsPerRound[roundId] = (assistsPerRound[roundId] || 0) + 1;
        }
      });

      // Combine data
      const roundsMap = new Map(roundsData?.map(r => [r.id, r]) || []);
      
      const combinedStats: RoundStats[] = statsData
        .filter(s => roundsMap.has(s.round_id))
        .map(s => {
          const round = roundsMap.get(s.round_id)!;
          return {
            round_id: s.round_id,
            round_number: round.round_number,
            scheduled_date: round.scheduled_date,
            total_points: s.total_points || 0,
            victories: s.victories || 0,
            draws: s.draws || 0,
            defeats: s.defeats || 0,
            goals: goalsPerRound[s.round_id] || 0,
            assists: assistsPerRound[s.round_id] || 0,
            presence: (s.presence_points || 0) > 0,
            yellow_cards: s.yellow_cards || 0,
            blue_cards: s.blue_cards || 0,
          };
        })
        .sort((a, b) => a.round_number - b.round_number);

      setRoundStats(combinedStats);
    } catch (error) {
      console.error("Erro ao carregar estatísticas por rodada:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate cumulative stats for trend chart
  const cumulativeData = useMemo(() => {
    let cumPoints = 0;
    let cumGoals = 0;
    let cumAssists = 0;
    let cumVictories = 0;
    let cumDraws = 0;
    let cumDefeats = 0;
    let cumPresences = 0;

    return roundStats.map(stat => {
      cumPoints += stat.total_points;
      cumGoals += stat.goals;
      cumAssists += stat.assists;
      cumVictories += stat.victories;
      cumDraws += stat.draws;
      cumDefeats += stat.defeats;
      cumPresences += stat.presence ? 1 : 0;

      return {
        name: `R${stat.round_number}`,
        roundNumber: stat.round_number,
        date: stat.scheduled_date,
        // Per round values
        pontos: stat.total_points,
        gols: stat.goals,
        assistencias: stat.assists,
        vitorias: stat.victories,
        empates: stat.draws,
        derrotas: stat.defeats,
        // Cumulative values
        pontosCum: cumPoints,
        golsCum: cumGoals,
        assistenciasCum: cumAssists,
        vitoriasCum: cumVictories,
        empatesCum: cumDraws,
        derrotasCum: cumDefeats,
        presencasCum: cumPresences,
      };
    });
  }, [roundStats]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      return (
        <div className="bg-background/95 border border-border rounded-lg p-3 shadow-lg backdrop-blur-sm">
          <p className="font-medium text-primary mb-2">Rodada {data?.roundNumber}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card className="card-glow bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary glow-text flex items-center gap-2">
            <TrendingUp size={24} />
            Evolução do Desempenho
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (roundStats.length === 0) {
    return (
      <Card className="card-glow bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary glow-text flex items-center gap-2">
            <TrendingUp size={24} />
            Evolução do Desempenho
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <TrendingUp size={48} className="mx-auto mb-4 opacity-50" />
            <p>Nenhuma estatística disponível ainda.</p>
            <p className="text-sm mt-2">Participe das rodadas para ver sua evolução!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-glow bg-card border-border">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-primary glow-text flex items-center gap-2">
          <TrendingUp size={24} />
          Evolução do Desempenho
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 gap-1 mb-6 h-auto">
            <TabsTrigger value="points" className="flex items-center gap-1 py-2 text-xs sm:text-sm">
              <TrendingUp size={14} />
              <span className="hidden sm:inline">Pontos</span>
              <span className="sm:hidden">Pts</span>
            </TabsTrigger>
            <TabsTrigger value="goals" className="flex items-center gap-1 py-2 text-xs sm:text-sm">
              <Target size={14} />
              <span className="hidden sm:inline">Gols/Assist</span>
              <span className="sm:hidden">G/A</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-1 py-2 text-xs sm:text-sm">
              <Trophy size={14} />
              <span className="hidden sm:inline">Resultados</span>
              <span className="sm:hidden">V/E/D</span>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-1 py-2 text-xs sm:text-sm">
              <Users size={14} />
              <span className="hidden sm:inline">Presença</span>
              <span className="sm:hidden">Pres</span>
            </TabsTrigger>
          </TabsList>

          {/* Points Evolution */}
          <TabsContent value="points" className="mt-0">
            <div className="h-[300px] sm:h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativeData}>
                  <defs>
                    <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="pontosCum"
                    name="Total Acumulado"
                    stroke="hsl(var(--primary))"
                    fill="url(#colorPoints)"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="pontos"
                    name="Por Rodada"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--chart-2))", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {/* Goals & Assists */}
          <TabsContent value="goals" className="mt-0">
            <div className="h-[300px] sm:h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar 
                    dataKey="gols" 
                    name="Gols" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="assistencias" 
                    name="Assistências" 
                    fill="hsl(var(--chart-3))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Cumulative totals */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-2xl font-bold text-primary">
                  {cumulativeData[cumulativeData.length - 1]?.golsCum || 0}
                </p>
                <p className="text-xs text-muted-foreground">Total de Gols</p>
              </div>
              <div className="text-center p-3 bg-muted/20 rounded-lg border border-border">
                <p className="text-2xl font-bold" style={{ color: "hsl(var(--chart-3))" }}>
                  {cumulativeData[cumulativeData.length - 1]?.assistenciasCum || 0}
                </p>
                <p className="text-xs text-muted-foreground">Total de Assistências</p>
              </div>
            </div>
          </TabsContent>

          {/* Results (V/D/E) */}
          <TabsContent value="results" className="mt-0">
            <div className="h-[300px] sm:h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="vitoriasCum"
                    name="Vitórias"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ fill: "#22c55e", strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="empatesCum"
                    name="Empates"
                    stroke="#eab308"
                    strokeWidth={2}
                    dot={{ fill: "#eab308", strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="derrotasCum"
                    name="Derrotas"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ fill: "#ef4444", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Cumulative totals */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="text-center p-3 bg-green-600/10 rounded-lg border border-green-600/20">
                <p className="text-xl font-bold text-green-600">
                  {cumulativeData[cumulativeData.length - 1]?.vitoriasCum || 0}
                </p>
                <p className="text-xs text-muted-foreground">Vitórias</p>
              </div>
              <div className="text-center p-3 bg-yellow-600/10 rounded-lg border border-yellow-600/20">
                <p className="text-xl font-bold text-yellow-600">
                  {cumulativeData[cumulativeData.length - 1]?.empatesCum || 0}
                </p>
                <p className="text-xs text-muted-foreground">Empates</p>
              </div>
              <div className="text-center p-3 bg-red-600/10 rounded-lg border border-red-600/20">
                <p className="text-xl font-bold text-red-600">
                  {cumulativeData[cumulativeData.length - 1]?.derrotasCum || 0}
                </p>
                <p className="text-xs text-muted-foreground">Derrotas</p>
              </div>
            </div>
          </TabsContent>

          {/* Attendance */}
          <TabsContent value="attendance" className="mt-0">
            <div className="h-[300px] sm:h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativeData}>
                  <defs>
                    <linearGradient id="colorPresence" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="stepAfter"
                    dataKey="presencasCum"
                    name="Presenças Acumuladas"
                    stroke="#22c55e"
                    fill="url(#colorPresence)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="text-center p-3 bg-green-600/10 rounded-lg border border-green-600/20">
                <p className="text-2xl font-bold text-green-600">
                  {cumulativeData[cumulativeData.length - 1]?.presencasCum || 0}
                </p>
                <p className="text-xs text-muted-foreground">Presenças</p>
              </div>
              <div className="text-center p-3 bg-muted/20 rounded-lg border border-border">
                <p className="text-2xl font-bold text-muted-foreground">
                  {roundStats.length}
                </p>
                <p className="text-xs text-muted-foreground">Total de Rodadas</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
