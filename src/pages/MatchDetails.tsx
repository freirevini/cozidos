import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ArrowLeft } from "lucide-react";

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
  started_at: string | null;
  finished_at: string | null;
  match_timer_started_at: string | null;
  match_timer_paused_at: string | null;
  match_timer_total_paused_seconds: number | null;
  status: string;
}

interface Goal {
  id: string;
  match_id: string;
  player_id: string;
  team_color: string;
  minute: number;
  is_own_goal: boolean;
  player?: {
    name: string;
    nickname: string | null;
  };
  assists?: {
    player?: {
      name: string;
      nickname: string | null;
    };
  };
}

interface Card {
  id: string;
  match_id: string;
  player_id: string;
  card_type: string;
  minute: number;
  player?: {
    name: string;
    nickname: string | null;
  };
}

interface Event {
  id: string;
  type: 'match_start' | 'match_end' | 'goal' | 'amarelo' | 'azul';
  minute: number;
  team_color?: string;
  player?: {
    name: string;
    nickname: string | null;
  };
  assist?: {
    name: string;
    nickname: string | null;
  };
}

const teamNames: Record<string, string> = {
  branco: "BRANCO",
  vermelho: "VERMELHO",
  verde: "VERDE",
  amarelo: "AMARELO",
  laranja: "LARANJA",
  azul: "AZUL",
  preto: "PRETO",
  rosa: "ROSA",
};

const MatchDetails = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [currentMinute, setCurrentMinute] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId) return;
    loadMatchData();
  }, [matchId]);

  // Carregar eventos após match estar disponível
  useEffect(() => {
    if (match) {
      loadEvents();
    }
  }, [match, matchId]);

  const loadMatchData = async () => {
    if (!matchId) return;
    
    const { data } = await supabase
      .from("matches")
      .select(`
        *,
        round:rounds(round_number)
      `)
      .eq("id", matchId)
      .single();

    if (data) {
      setMatch({
        ...data,
        round_number: data.round?.round_number
      });
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    if (!matchId || !match) return;

    const { data: goalsData } = await supabase
      .from("goals")
      .select(`
        *,
        player:profiles!goals_player_id_fkey(name, nickname),
        assists(
          player:profiles!assists_player_id_fkey(name, nickname)
        )
      `)
      .eq("match_id", matchId);

    const { data: cardsData } = await supabase
      .from("cards")
      .select(`
        *,
        player:profiles!cards_player_id_fkey(name, nickname, id)
      `)
      .eq("match_id", matchId);

    const allEvents: Event[] = [];

    if (goalsData) {
      goalsData.forEach((goal: any) => {
        allEvents.push({
          id: goal.id,
          type: 'goal',
          minute: goal.minute,
          team_color: goal.team_color,
          player: goal.player,
          assist: goal.assists?.player,
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
          type: card.card_type as 'amarelo' | 'azul',
          minute: card.minute,
          team_color: teamData?.team_color,
          player: card.player,
        });
      }
    }

    allEvents.sort((a, b) => a.minute - b.minute);
    setEvents(allEvents);
  };

  const getCurrentMatchMinute = (): number | null => {
    if (!match || match.status !== 'in_progress' || !match.match_timer_started_at) {
      if (match?.status === 'finished' && match.started_at && match.finished_at) {
        const startTime = new Date(match.started_at).getTime();
        const endTime = new Date(match.finished_at).getTime();
        const elapsedSeconds = Math.floor((endTime - startTime) / 1000) - (match.match_timer_total_paused_seconds || 0);
        return Math.max(0, Math.floor(elapsedSeconds / 60));
      }
      return null;
    }

    const startTime = new Date(match.match_timer_started_at).getTime();
    const now = Date.now();
    let pausedSeconds = match.match_timer_total_paused_seconds || 0;

    if (match.match_timer_paused_at) {
      const pausedAt = new Date(match.match_timer_paused_at).getTime();
      pausedSeconds += Math.floor((now - pausedAt) / 1000);
    }

    const elapsedSeconds = Math.max(0, Math.floor((now - startTime) / 1000) - pausedSeconds);
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);

    return Math.max(0, elapsedMinutes);
  };

  // Atualizar cronômetro em tempo real
  useEffect(() => {
    if (match?.status === 'in_progress') {
      const interval = setInterval(() => {
        setCurrentMinute(getCurrentMatchMinute());
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setCurrentMinute(getCurrentMatchMinute());
    }
  }, [match]);

  // Realtime: Sincronizar atualizações
  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel('match-details-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`
        },
        () => {
          loadMatchData();
          loadEvents();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'goals'
        },
        () => {
          loadEvents();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cards'
        },
        () => {
          loadEvents();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assists'
        },
        () => {
          loadEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getEventIcon = (event: Event) => {
    switch (event.type) {
      case 'match_start':
        return <span className="text-2xl">🔵</span>;
      case 'match_end':
        return <span className="text-2xl">🔵</span>;
      case 'goal':
        return <span className="text-2xl">⚽</span>;
      case 'amarelo':
        return <span className="text-2xl">🟨</span>;
      case 'azul':
        return <span className="text-2xl">🟦</span>;
      default:
        return null;
    }
  };

  const getEventText = (event: Event) => {
    switch (event.type) {
      case 'match_start':
        return 'Início da partida';
      case 'match_end':
        return 'Final da partida';
      case 'goal':
        return event.player?.nickname || event.player?.name || 'Jogador';
      case 'amarelo':
      case 'azul':
        return event.player?.nickname || event.player?.name || 'Jogador';
      default:
        return '';
    }
  };

  if (loading || !match) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-primary text-xl">Carregando...</div>
      </div>
    );
  }

  const maxMinute = 120;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-6 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/matches')}
          className="mb-6 hover:bg-primary/10"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Rodadas
        </Button>

        <Card className="overflow-hidden border-border">
          <CardContent className="p-6 space-y-6">
            {/* Header com Rodada e Jogo */}
            <div className="text-center mb-4">
              <div className="text-xl sm:text-2xl font-bold text-primary">
                {match.round_number && `Rodada ${match.round_number} - Jogo ${match.match_number}`}
              </div>
            </div>

            {/* Placar Central com melhor alinhamento */}
            <div className="flex items-center justify-between gap-6">
              {/* Time Casa */}
              <div className="flex-1 text-center">
                <div className="text-base sm:text-lg font-bold uppercase">
                  {teamNames[match.team_home] || match.team_home}
                </div>
              </div>
              
              {/* Placar e Status */}
              <div className="flex flex-col items-center gap-2">
                <div className="text-5xl sm:text-6xl font-bold tabular-nums">
                  {match.score_home} : {match.score_away}
                </div>
                {match.status === 'in_progress' && currentMinute !== null && (
                  <div className="text-primary text-lg sm:text-xl">
                    {currentMinute > 12 ? `12'+${currentMinute - 12}` : `${currentMinute}'`}
                  </div>
                )}
                {match.status === 'finished' && (
                  <div className="text-primary text-sm sm:text-base">Encerrada</div>
                )}
              </div>

              {/* Time Visitante */}
              <div className="flex-1 text-center">
                <div className="text-base sm:text-lg font-bold uppercase">
                  {teamNames[match.team_away] || match.team_away}
                </div>
              </div>
            </div>

            {/* Linha do Tempo */}
            {match.status !== 'not_started' && (
              <div className="relative pt-12 pb-8">
                <div className="relative h-1 bg-muted/30 rounded-full">
                  {currentMinute && (
                    <div 
                      className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-1000"
                      style={{ width: `${Math.min(100, (currentMinute / 12) * 100)}%` }}
                    ></div>
                  )}
                  
                  {/* Marcadores de tempo */}
              <div className="absolute -bottom-6 left-0 text-xs text-muted-foreground">0'</div>
              <div className="absolute -bottom-6 left-[25%] text-xs text-primary">3'</div>
              <div className="absolute -bottom-6 left-[50%] text-xs text-primary">6'</div>
              <div className="absolute -bottom-6 left-[75%] text-xs text-primary">9'</div>
              <div className="absolute -bottom-6 right-0 text-xs text-muted-foreground">12'</div>
                  
                  {/* Eventos na timeline */}
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                      style={{ left: `${(event.minute / 12) * 100}%` }}
                    >
                      <span className="text-lg">{getEventIcon(event)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Eventos por Time - Grid 2 Colunas */}
            {match.status !== 'not_started' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 border-t pt-6">
                  {/* Coluna Esquerda - Time Casa */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 border-b pb-2 mb-3">
                      <h3 className="text-sm font-bold text-primary uppercase">
                        {teamNames[match.team_home]}
                      </h3>
                    </div>
                    {events
                      .filter(event => 
                        event.type !== 'match_start' && 
                        event.type !== 'match_end' && 
                        event.team_color === match.team_home
                      )
                      .length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center italic">
                          Sem eventos
                        </p>
                      ) : (
                        events
                          .filter(event => 
                            event.type !== 'match_start' && 
                            event.type !== 'match_end' && 
                            event.team_color === match.team_home
                          )
                          .map((event) => (
                            <div key={event.id} className="flex items-center gap-2 text-sm bg-muted/10 p-2 rounded">
                              <span className="text-lg">{getEventIcon(event)}</span>
                              <span className="flex-1 truncate font-medium">
                                {event.player?.nickname || event.player?.name}
                              </span>
                              <span className="text-xs text-primary font-bold">
                                {event.minute > 12 ? `12'+${event.minute - 12}` : `${event.minute}'`}
                              </span>
                            </div>
                          ))
                      )}
                  </div>

                  {/* Coluna Direita - Time Visitante */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 border-b pb-2 mb-3">
                      <h3 className="text-sm font-bold text-primary uppercase">
                        {teamNames[match.team_away]}
                      </h3>
                    </div>
                    {events
                      .filter(event => 
                        event.type !== 'match_start' && 
                        event.type !== 'match_end' && 
                        event.team_color === match.team_away
                      )
                      .length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center italic">
                          Sem eventos
                        </p>
                      ) : (
                        events
                          .filter(event => 
                            event.type !== 'match_start' && 
                            event.type !== 'match_end' && 
                            event.team_color === match.team_away
                          )
                          .map((event) => (
                            <div key={event.id} className="flex items-center gap-2 text-sm bg-muted/10 p-2 rounded">
                              <span className="text-lg">{getEventIcon(event)}</span>
                              <span className="flex-1 truncate font-medium">
                                {event.player?.nickname || event.player?.name}
                              </span>
                              <span className="text-xs text-primary font-bold">
                                {event.minute > 12 ? `12'+${event.minute - 12}` : `${event.minute}'`}
                              </span>
                            </div>
                          ))
                      )}
                  </div>
                </div>

                {/* Eventos Globais (Início/Fim) */}
                <div className="border-t pt-4 mt-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="text-xl">🔵</span>
                      <span>Início da partida</span>
                      <span className="ml-auto">0'</span>
                    </div>
                    {match.status === 'finished' && (
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="text-xl">🔵</span>
                        <span>Final da partida</span>
                        <span className="ml-auto">
                          {currentMinute && currentMinute > 90 ? `90'+${currentMinute - 90}` : `${currentMinute || 90}'`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {match.status === 'not_started' && (
              <div className="text-center py-8 text-muted-foreground">
                A partida ainda não foi iniciada
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default MatchDetails;
