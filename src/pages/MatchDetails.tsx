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
    loadEvents();
  }, [matchId]);

  const loadMatchData = async () => {
    if (!matchId) return;
    
    const { data } = await supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .single();

    if (data) {
      setMatch(data);
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    if (!matchId) return;

    // Carregar gols com assistências
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

    // Carregar cartões
    const { data: cardsData } = await supabase
      .from("cards")
      .select(`
        *,
        player:profiles!cards_player_id_fkey(name, nickname)
      `)
      .eq("match_id", matchId);

    const allEvents: Event[] = [
      { id: 'start', type: 'match_start', minute: 0 },
    ];

    if (goalsData) {
      goalsData.forEach((goal: any) => {
        allEvents.push({
          id: goal.id,
          type: 'goal',
          minute: goal.minute,
          player: goal.player,
          assist: goal.assists?.player,
        });
      });
    }

    if (cardsData) {
      cardsData.forEach((card: Card) => {
        allEvents.push({
          id: card.id,
          type: card.card_type as 'amarelo' | 'azul',
          minute: card.minute,
          player: card.player,
        });
      });
    }

    // Adicionar evento de fim se a partida estiver finalizada
    if (match?.status === 'finished' && match.finished_at) {
      const finalMinute = getCurrentMatchMinute() || 90;
      allEvents.push({
        id: 'end',
        type: 'match_end',
        minute: finalMinute,
      });
    }

    // Ordenar por minuto
    allEvents.sort((a, b) => a.minute - b.minute);
    setEvents(allEvents);
  };

  const getCurrentMatchMinute = (): number | null => {
    if (!match || match.status !== 'in_progress' || !match.match_timer_started_at) {
      if (match?.status === 'finished' && match.started_at && match.finished_at) {
        const startTime = new Date(match.started_at).getTime();
        const endTime = new Date(match.finished_at).getTime();
        const elapsedSeconds = Math.floor((endTime - startTime) / 1000) - (match.match_timer_total_paused_seconds || 0);
        return Math.floor(elapsedSeconds / 60);
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

    const elapsedSeconds = Math.floor((now - startTime) / 1000) - pausedSeconds;
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);

    return elapsedMinutes;
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
        return '🔵';
      case 'match_end':
        return '🔵';
      case 'goal':
        return '⚽';
      case 'amarelo':
        return '🟨';
      case 'azul':
        return '🟦';
      default:
        return '';
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

  const maxMinute = Math.max(90, currentMinute || 90, ...events.map(e => e.minute));

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
          <CardContent className="p-6 space-y-8">
            {/* Header com Horário */}
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {match.started_at ? formatTime(match.started_at) : match.scheduled_time}
              </div>
            </div>

            {/* Placar Central */}
            <div className="flex items-center justify-center gap-4 sm:gap-8">
              <div className="text-center flex-1">
                <div className="text-lg sm:text-xl font-bold uppercase truncate">
                  {teamNames[match.team_home] || match.team_home}
                </div>
              </div>
              
              <div className="flex flex-col items-center min-w-[120px]">
                <div className="text-4xl sm:text-6xl font-bold">
                  {match.score_home} : {match.score_away}
                </div>
                {match.status === 'in_progress' && currentMinute !== null && (
                  <div className="text-primary text-xl sm:text-2xl mt-2">{currentMinute}'</div>
                )}
                {match.status === 'finished' && (
                  <div className="text-primary text-base sm:text-lg mt-2">Encerrada</div>
                )}
              </div>

              <div className="text-center flex-1">
                <div className="text-lg sm:text-xl font-bold uppercase truncate">
                  {teamNames[match.team_away] || match.team_away}
                </div>
              </div>
            </div>

            {/* Linha do Tempo */}
            {match.status !== 'not_started' && (
              <div className="relative pt-8 pb-6">
                <div className="relative h-2 bg-primary/20 rounded-full">
                  <div 
                    className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(100, ((currentMinute || 0) / maxMinute) * 100)}%` }}
                  ></div>
                  
                  {/* Marcadores de tempo */}
                  <div className="absolute -bottom-6 left-0 text-xs text-muted-foreground">0'</div>
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">45'</div>
                  <div className="absolute -bottom-6 right-0 text-xs text-muted-foreground">90'</div>
                  
                  {/* Eventos na timeline */}
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="absolute -top-6 transform -translate-x-1/2 text-xl hover:scale-125 transition-transform cursor-pointer"
                      style={{ left: `${Math.min(100, (event.minute / maxMinute) * 100)}%` }}
                      title={`${event.minute}' - ${getEventText(event)}`}
                    >
                      {getEventIcon(event)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de Eventos */}
            {match.status !== 'not_started' && events.length > 0 && (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-primary scrollbar-track-background">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-3 bg-muted/10 rounded-lg hover:bg-muted/20 transition-colors"
                  >
                    <span className="text-xl flex-shrink-0">{getEventIcon(event)}</span>
                    
                    <div className="flex-1 min-w-0">
                      {event.type === 'goal' ? (
                        <>
                          <div className="text-sm font-bold truncate">
                            {event.player?.nickname || event.player?.name || 'Jogador'}
                          </div>
                          {event.assist && (
                            <div className="text-xs text-muted-foreground truncate">
                              Assist: {event.assist.nickname || event.assist.name}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-sm font-medium">{getEventText(event)}</div>
                      )}
                    </div>
                    
                    <span className="text-xs text-muted-foreground flex-shrink-0 mt-1">
                      {event.minute}'
                    </span>
                  </div>
                ))}
              </div>
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
