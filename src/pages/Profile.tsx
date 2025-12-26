import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";
import { useProfileStats } from "@/hooks/useProfileStats";
import {
  ProfileHeroHeader,
  ProfileFilters,
  ProfileStatsGrid,
  ProfileCalculatedMetrics,
  ProfileEvolutionChart,
  ProfileBestWorstCards,
} from "@/components/profile";
import { Loader2, ArrowLeft } from "lucide-react";
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

  // Filters
  const [selectedYear, setSelectedYear] = useState<number | null>(initialYear);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(initialMonth);

  // Stats hook - uses profile.id as source of truth
  const {
    stats,
    roundStats,
    availableYears,
    calculatedMetrics,
    bestWorstPeriods,
    loading: statsLoading,
  } = useProfileStats(profile?.id, selectedYear, selectedMonth);

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

      // Buscar posição no ranking
      let rankingPosition: number | null = null;
      const { data: rankingData } = await supabase
        .from("player_rankings")
        .select("player_id, pontos_totais")
        .order("pontos_totais", { ascending: false });

      if (rankingData) {
        const position = rankingData.findIndex(r => r.player_id === profileId);
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
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-muted-foreground">Perfil não encontrado</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-2xl mx-auto pb-8">
        {/* Botão Voltar - apenas quando visualizando perfil de outro jogador */}
        {urlProfileId && (
          <div className="px-4 pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
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
          <TabsList className="w-full justify-start px-4 bg-transparent border-b border-border/50 rounded-none h-auto py-0">
            <TabsTrigger
              value="stats"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
            >
              Estatísticas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="mt-0">
            {/* Filters */}
            <ProfileFilters
              availableYears={availableYears}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              onYearChange={setSelectedYear}
              onMonthChange={setSelectedMonth}
            />

            {statsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
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
