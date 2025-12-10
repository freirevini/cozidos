import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ArrowLeft } from "lucide-react";
import { MatchHeader } from "@/components/match/MatchHeader";
import { MatchTimeline, TimelineEvent } from "@/components/match/MatchTimeline";
import { MatchLineups } from "@/components/match/MatchLineups";

interface Match {
  id: string;
  round_id: string;
  round_number?: number;
  match_number: number;
  team_home: string;
  team_away: string;
  score_home: number;
  score_away: number;
  scheduled_time: string;
  scheduled_date?: string;
  started_at: string | null;
  finished_at: string | null;
  match_timer_started_at: string | null;
  match_timer_paused_at: string | null;
  match_timer_total_paused_seconds: number | null;
  status: "not_started" | "in_progress" | "finished";
}

interface Player {
  id: string;
  name: string;
  nickname: string | null;
  position: "goleiro" | "defensor" | "meio-campista" | "atacante" | null;
  level?: string;
  avatar_url?: string;
}

const MatchDetails = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [currentMinute, setCurrentMinute] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"partida" | "times">("partida");

  useEffect(() => {
    if (!matchId) return;
    loadMatchData();
  }, [matchId]);

  useEffect(() => {
    if (match) {
      loadEvents();
      loadPlayers();
    }
  }, [match, matchId]);

  const loadMatchData = async () => {
    if (!matchId) return;

    try {
      const { data, error } = await supabase
        .from("matches")
        .select(`*, round:rounds(round_number, scheduled_date)`)
        .eq("id", matchId)
        .single();

      if (error) throw error;

      if (data) {
        setMatch({
          ...data,
          round_number: data.round?.round_number,
          scheduled_date: data.round?.scheduled_date,
          status: data.status as any,
        });
        setLoading(false);
      }
    } catch (error) {
      console.error("Erro ao carregar partida:", error);
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    if (!matchId || !match) return;

    try {
      const { data: goalsData } = await supabase
        .from("goals")
        .select(`*, player:profiles!goals_player_id_fkey(id, name, nickname, avatar_url), assists(player:profiles!assists_player_id_fkey(id, name, nickname, avatar_url))`)
        .eq("match_id", matchId);

      const { data: cardsData } = await supabase
        .from("cards")
        .select(`*, player:profiles!cards_player_id_fkey(id, name, nickname, avatar_url)`)
        .eq("match_id", matchId);

      const allEvents: TimelineEvent[] = [];

      if (match.started_at) {
        allEvents.push({ id: `start-${match.id}`, type: "match_start", minute: 0 });
      }

      if (goalsData) {
        goalsData.forEach((goal: any) => {
          const assistData = goal.assists ? (Array.isArray(goal.assists) ? goal.assists[0] : goal.assists) : null;
          allEvents.push({
            id: goal.id,
            type: "goal",
            minute: goal.minute,
            team_color: goal.team_color,
            player: goal.player ? { name: goal.player.name, nickname: goal.player.nickname, avatar_url: goal.player.avatar_url } : undefined,
            assist: assistData?.player ? { name: assistData.player.name, nickname: assistData.player.nickname, avatar_url: assistData.player.avatar_url } : undefined,
          });
        });
      }

      if (cardsData) {
        for (const card of cardsData) {
          const { data: teamData } = await supabase
            .from("round_team_players")
            .select("team_color")
            .eq("player_id", card.player_id)
            .eq("round_id", match.round_id)
            .maybeSingle();

          allEvents.push({
            id: card.id,
            type: card.card_type === "amarelo" ? "amarelo" : "azul",
            minute: card.minute,
            team_color: teamData?.team_color,
            player: card.player ? { name: card.player.name, nickname: card.player.nickname, avatar_url: card.player.avatar_url } : undefined,
          });
        }
      }

      if (match.status === "finished" && match.finished_at) {
        const endMinute = getCurrentMatchMinute();
        if (endMinute !== null) {
          allEvents.push({ id: `end-${match.id}`, type: "match_end", minute: endMinute });
        }
      }

      allEvents.sort((a, b) => a.minute - b.minute);
      setEvents(allEvents);
    } catch (error) {
      console.error("Erro ao carregar eventos:", error);
    }
  };

  const loadPlayers = async () => {
    if (!match) return;

    try {
      const { data: teamPlayers } = await supabase
        .from("round_team_players")
        .select(`player_id, team_color, profiles:player_id (id, name, nickname, position, level, avatar_url)`)
        .eq("round_id", match.round_id);

      if (teamPlayers) {
        const home: Player[] = [];
        const away: Player[] = [];

        teamPlayers.forEach((tp: any) => {
          const player: Player = {
            id: tp.profiles.id,
            name: tp.profiles.name,
            nickname: tp.profiles.nickname,
            position: tp.profiles.position,
            level: tp.profiles.level,
            avatar_url: tp.profiles.avatar_url,
          };

          if (tp.team_color === match.team_home) home.push(player);
          else if (tp.team_color === match.team_away) away.push(player);
        });

        setHomePlayers(home);
        setAwayPlayers(away);
      }
    } catch (error) {
      console.error("Erro ao carregar jogadores:", error);
    }
  };

  const getCurrentMatchMinute = (): number | null => {
    if (!match) return null;

    if (match.status === "in_progress" && match.match_timer_started_at) {
      const startTime = new Date(match.match_timer_started_at).getTime();
      const now = Date.now();
      let pausedSeconds = match.match_timer_total_paused_seconds || 0;
      if (match.match_timer_paused_at) {
        const pausedAt = new Date(match.match_timer_paused_at).getTime();
        pausedSeconds += Math.floor((now - pausedAt) / 1000);
      }
      const elapsedSeconds = Math.max(0, Math.floor((now - startTime) / 1000) - pausedSeconds);
      return Math.floor(elapsedSeconds / 60);
    }

    if (match.status === "finished" && match.started_at && match.finished_at) {
      const startTime = new Date(match.started_at).getTime();
      const endTime = new Date(match.finished_at).getTime();
      const elapsedSeconds = Math.floor((endTime - startTime) / 1000) - (match.match_timer_total_paused_seconds || 0);
      return Math.max(0, Math.floor(elapsedSeconds / 60));
    }

    return null;
  };

  useEffect(() => {
    if (match?.status === "in_progress") {
      const interval = setInterval(() => setCurrentMinute(getCurrentMatchMinute()), 1000);
      return () => clearInterval(interval);
    } else {
      setCurrentMinute(getCurrentMatchMinute());
    }
  }, [match]);

  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel("match-details-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` }, () => { loadMatchData(); loadEvents(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "goals" }, () => loadEvents())
      .on("postgres_changes", { event: "*", schema: "public", table: "cards" }, () => loadEvents())
      .on("postgres_changes", { event: "*", schema: "public", table: "assists" }, () => loadEvents())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchId]);

  if (loading || !match) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-primary text-xl">Carregando...</div>
      </div>
    );
  }

  const maxMinute = currentMinute || 12;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-6 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate("/matches")} className="mb-6 hover:bg-primary/10">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Rodadas
        </Button>

        <Card className="overflow-hidden border-border">
          <CardContent className="p-4 sm:p-6">
            <MatchHeader
              teamHome={match.team_home}
              teamAway={match.team_away}
              scoreHome={match.score_home}
              scoreAway={match.score_away}
              roundNumber={match.round_number}
              status={match.status}
              scheduledDate={match.scheduled_date || match.started_at || undefined}
              currentMinute={currentMinute}
              className="mb-6"
            />

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="partida" className="min-h-[44px]">Partida</TabsTrigger>
                <TabsTrigger value="times" className="min-h-[44px]">Times</TabsTrigger>
              </TabsList>

              <TabsContent value="partida" className="space-y-6">
                {match.status !== "not_started" ? (
                  <MatchTimeline events={events} teamHome={match.team_home} teamAway={match.team_away} maxMinute={maxMinute} />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">A partida ainda não foi iniciada</div>
                )}
              </TabsContent>

              <TabsContent value="times" className="space-y-6">
                {homePlayers.length > 0 || awayPlayers.length > 0 ? (
                  <MatchLineups teamHome={match.team_home} teamAway={match.team_away} homePlayers={homePlayers} awayPlayers={awayPlayers} />
                ) : (
                  <div className="text-center py-12 text-muted-foreground">Escalações não disponíveis</div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default MatchDetails;
