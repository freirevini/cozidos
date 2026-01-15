import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FilterDrawer, { FilterState, FilterBadge } from "@/components/FilterDrawer";
import { useToast } from "@/hooks/use-toast";
import { useProfileStats } from "@/hooks/useProfileStats";
import {
  ProfileHeroHeader,
  ProfileStatsGrid,
  ProfileCalculatedMetrics,
  ProfileEvolutionChart,
  ProfileBestWorstCards,
} from "@/components/profile";
import { Loader2, ArrowLeft, Filter } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

interface UserProfile {
  id: string;
  name: string;
  nickname: string | null;
  birth_date: string | null;
  position: string | null;
  level: string | null;
  is_approved: boolean;
  status: string | null;
  email: string | null;
  avatar_url: string | null;
  ranking_position: number | null;
}

export default function Profile() {
  const { id: urlProfileId } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialYear = searchParams.get("year") ? Number(searchParams.get("year")) : null;
  const initialMonth = searchParams.get("month") ? Number(searchParams.get("month")) : null;

  const { isAdmin } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const { toast } = useToast();

  // Filters - Default to current year (2026)
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | null>(initialYear ?? currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(initialMonth);

  // Filter drawer state
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  const handleApplyFilters = (filters: FilterState) => {
    setSelectedYear(filters.season);
    setSelectedMonth(filters.month);
  };

  const currentFilters: FilterState = {
    season: selectedYear,
    month: selectedMonth,
    level: null,
    roundId: null,
  };

  // Stats hook - uses profile.id as source of truth
  const {
    stats,
    roundStats,
    availableYears,
    calculatedMetrics,
    bestWorstPeriods,
    loading: statsLoading,
  } = useProfileStats(profile?.id, selectedYear, selectedMonth);

  // Convert availableYears (string[]) to number[] for FilterDrawer
  const seasonsAsNumbers = availableYears.map(y => parseInt(y)).filter(y => !isNaN(y));

  useEffect(() => {
    loadProfile();
  }, [urlProfileId]);

  // Auto-select most recent year when available
  useEffect(() => {
    if (availableYears.length > 0 && selectedYear === null && initialYear === null) {
      // Parse string year to number for state
      const mostRecentYear = parseInt(availableYears[0]);
      if (!isNaN(mostRecentYear)) {
        setSelectedYear(mostRecentYear);
      }
    }
  }, [availableYears]);

  const loadProfile = async () => {
    try {
      setLoading(true);

      let profileId: string | null = null;
      let profileData: any = null;
      let isOwn = false;

      // If viewing another player's profile
      if (urlProfileId) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, name, nickname, birth_date, position, level, is_approved, status, email, avatar_url")
          .eq("id", urlProfileId)
          .single();

        if (error) throw error;
        profileData = data;
        profileId = data?.id || null;
        isOwn = false;
      } else {
        // Load own profile
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        // Buscar perfil vinculado ao user_id - esta é a fonte de verdade
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("id, name, nickname, birth_date, position, level, is_approved, status, email, avatar_url, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (profiles && profiles.length > 0) {
          // Priorizar perfil aprovado ou mais recente
          const selectedProfile = profiles.find(p => p.status === 'aprovado' || p.is_approved)
            || profiles[0];

          profileData = selectedProfile;
          profileId = selectedProfile.id;
          isOwn = true;
        } else {
          toast({
            title: "Perfil não encontrado",
            description: "Seu perfil está sendo criado. Recarregue a página em alguns instantes.",
            variant: "default",
          });
          setLoading(false);
          return;
        }
      }

      if (!profileData || !profileId) {
        setLoading(false);
        return;
      }

      // Buscar posição no ranking da temporada atual com critérios de desempate
      let rankingPosition: number | null = null;
      const currentYear = new Date().getFullYear();

      const { data: roundStats } = await supabase
        .from("player_round_stats")
        .select(`
          player_id,
          total_points,
          presence_points,
          victories,
          defeats,
          goal_difference,
          yellow_cards,
          blue_cards,
          assists,
          goals,
          round:rounds!inner(scheduled_date)
        `)
        .gte("round.scheduled_date", `${currentYear}-01-01`)
        .lte("round.scheduled_date", `${currentYear}-12-31`);

      if (roundStats) {
        // Interface para agregação
        interface PlayerAgg {
          pontos: number;
          presencas: number;
          vitorias: number;
          saldo_gols: number;
          cartoes: number;
          assistencias: number;
          gols: number;
          derrotas: number;
        }

        // Agregar estatísticas por jogador
        const playerTotals = new Map<string, PlayerAgg>();
        roundStats.forEach((rs: any) => {
          const current = playerTotals.get(rs.player_id) || {
            pontos: 0, presencas: 0, vitorias: 0, saldo_gols: 0,
            cartoes: 0, assistencias: 0, gols: 0, derrotas: 0
          };
          playerTotals.set(rs.player_id, {
            pontos: current.pontos + (rs.total_points || 0),
            presencas: current.presencas + (rs.presence_points || 0),
            vitorias: current.vitorias + (rs.victories || 0),
            saldo_gols: current.saldo_gols + (rs.goal_difference || 0),
            cartoes: current.cartoes + (rs.yellow_cards || 0) + (rs.blue_cards || 0),
            assistencias: current.assistencias + (rs.assists || 0),
            gols: current.gols + (rs.goals || 0),
            derrotas: current.derrotas + (rs.defeats || 0),
          });
        });

        // Ordenar com critérios de desempate (igual a Classification.tsx)
        const sortedPlayers = Array.from(playerTotals.entries())
          .sort(([, a], [, b]) => {
            // 1. Mais pontos totais
            if (a.pontos !== b.pontos) return b.pontos - a.pontos;
            // 2. Mais presenças
            if (a.presencas !== b.presencas) return b.presencas - a.presencas;
            // 3. Mais vitórias
            if (a.vitorias !== b.vitorias) return b.vitorias - a.vitorias;
            // 4. Maior saldo de gols
            if (a.saldo_gols !== b.saldo_gols) return b.saldo_gols - a.saldo_gols;
            // 5. Menos cartões
            if (a.cartoes !== b.cartoes) return a.cartoes - b.cartoes;
            // 6. Mais assistências
            if (a.assistencias !== b.assistencias) return b.assistencias - a.assistencias;
            // 7. Mais gols
            if (a.gols !== b.gols) return b.gols - a.gols;
            // 8. Menos derrotas
            return a.derrotas - b.derrotas;
          });

        const position = sortedPlayers.findIndex(([id]) => id === profileId);
        if (position !== -1) {
          rankingPosition = position + 1;
        }
      }

      setProfile({
        ...profileData,
        ranking_position: rankingPosition,
      });
      setIsOwnProfile(isOwn);

    } catch (error: any) {
      console.error("Erro ao carregar perfil:", error);
      toast({
        title: "Erro ao carregar perfil",
        description: error.message || "Ocorreu um erro ao carregar o perfil.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const hasData = stats.partidas > 0 || stats.gols > 0 || stats.assistencias > 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e0e10] text-white font-sans">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0e0e10] text-white">
        <Header />
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-muted-foreground">Perfil não encontrado</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0e0e10] text-white font-sans">
      <Header />

      {/* Filter Drawer */}
      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onApply={handleApplyFilters}
        currentFilters={currentFilters}
        seasons={seasonsAsNumbers}
        availableMonths={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}
        showLevel={false}
        showRounds={false}
      />

      <main className="max-w-2xl mx-auto pb-8">
        {/* Botão Voltar - apenas quando visualizando perfil de outro jogador */}
        {urlProfileId && (
          <div className="px-4 pt-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>
          </div>
        )}
        {/* Profile Hero Header - MLS Style */}
        <ProfileHeroHeader
          id={profile.id}
          name={profile.name}
          nickname={profile.nickname}
          avatarUrl={profile.avatar_url}
          position={profile.position}
          level={profile.level}
          birthDate={profile.birth_date}
          rankingPosition={profile.ranking_position}
          isOwnProfile={isOwnProfile}
          onAvatarUpdate={(url) => setProfile(prev => prev ? { ...prev, avatar_url: url } : null)}
        />

        {/* Stats Tab */}
        <Tabs defaultValue="stats" className="w-full">
          <TabsList className="w-full justify-start px-4 bg-transparent border-b border-white/10 rounded-none h-auto py-0">
            <TabsTrigger
              value="stats"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-pink-500 data-[state=active]:text-pink-300 data-[state=active]:bg-transparent px-4 py-3 text-gray-400"
            >
              Estatísticas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="mt-0">
            {/* Filter Header */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFilterDrawerOpen(true)}
                className="rounded-full gap-2 border-white/10 bg-[#1c1c1e] hover:bg-white/10 text-white"
              >
                <Filter className="h-4 w-4" />
                Filtros
                {selectedMonth !== null && (
                  <span className="px-1.5 py-0.5 text-xs rounded-full bg-pink-500 text-white">
                    1
                  </span>
                )}
              </Button>

              {selectedMonth !== null && (
                <FilterBadge filters={currentFilters} seasons={seasonsAsNumbers} showLevel={false} />
              )}
            </div>

            {statsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
              </div>
            ) : (
              <>
                {/* Stats Grid */}
                <ProfileStatsGrid stats={stats} />

                {/* Calculated Metrics */}
                <ProfileCalculatedMetrics metrics={calculatedMetrics} hasData={hasData} />

                {/* Evolution Chart */}
                <ProfileEvolutionChart roundStats={roundStats} />

                {/* Best/Worst Cards */}
                <ProfileBestWorstCards bestWorstPeriods={bestWorstPeriods} />
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
}
