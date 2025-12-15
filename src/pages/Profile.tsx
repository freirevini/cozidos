import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";
import { useProfileStats } from "@/hooks/useProfileStats";
import {
  ProfileHeader,
  ProfileFilters,
  ProfileStatsGrid,
  ProfileCalculatedMetrics,
  ProfileEvolutionChart,
  ProfileBestWorstCards,
} from "@/components/profile";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
}

export default function Profile() {
  const { id: urlProfileId } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
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
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      
      // If viewing another player's profile
      if (urlProfileId) {
        const { data: profileData, error } = await supabase
          .from("profiles")
          .select("id, name, nickname, birth_date, position, level, is_approved, status, email, avatar_url")
          .eq("id", urlProfileId)
          .single();

        if (error) throw error;
        if (profileData) {
          setProfile(profileData);
          setIsOwnProfile(false);
        }
        return;
      }

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
        let selectedProfile = profiles.find(p => p.status === 'aprovado' || p.is_approved) 
          || profiles[0];
        
        setProfile(selectedProfile);
        setIsOwnProfile(true);
      } else {
        toast({
          title: "Perfil não encontrado",
          description: "Seu perfil está sendo criado. Recarregue a página em alguns instantes.",
          variant: "default",
        });
      }
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
        {/* Profile Header - MLS Style */}
        <ProfileHeader
          name={profile.name}
          nickname={profile.nickname}
          avatarUrl={profile.avatar_url}
          position={profile.position}
          level={profile.level}
          status={profile.status}
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
