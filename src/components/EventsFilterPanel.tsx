import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Filter, SortAsc, SortDesc, Search, X } from "lucide-react";
import { EVENT_ICONS, formatMinute, EventIcon, EventType } from "@/components/ui/event-item";

interface Event {
  id: string;
  type: 'goal' | 'amarelo' | 'azul';
  minute: number;
  player_name: string;
  player_id: string;
  team_color: string;
  match_number: number;
  match_id: string;
  assist_name?: string;
}

interface EventsFilterPanelProps {
  roundId: string;
  onEventClick?: (matchId: string) => void;
}

const teamColors: Record<string, string> = {
  branco: "bg-white text-black border border-gray-300",
  vermelho: "bg-red-600 text-white",
  azul: "bg-blue-600 text-white",
  laranja: "bg-orange-500 text-white",
};

const teamNames: Record<string, string> = {
  branco: "Branco",
  vermelho: "Vermelho",
  azul: "Azul",
  laranja: "Laranja",
};

export default function EventsFilterPanel({ roundId, onEventClick }: EventsFilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [playerFilter, setPlayerFilter] = useState<string>("");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  
  // Sorting
  const [sortBy, setSortBy] = useState<"minute" | "player" | "type" | "match">("minute");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    if (isOpen && roundId) {
      loadEvents();
    }
  }, [isOpen, roundId]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      // Load goals with assists
      const { data: goalsData, error: goalsError } = await supabase
        .from("goals")
        .select(`
          id,
          minute,
          team_color,
          player_id,
          match_id,
          matches!inner(match_number, round_id),
          player:profiles!goals_player_id_fkey(nickname, name)
        `)
        .eq("matches.round_id", roundId);

      if (goalsError) throw goalsError;

      // Load assists for goals
      const goalIds = goalsData?.map(g => g.id) || [];
      const { data: assistsData } = await supabase
        .from("assists")
        .select(`
          goal_id,
          player:profiles!assists_player_id_fkey(nickname, name)
        `)
        .in("goal_id", goalIds);

      const assistsMap = new Map(
        assistsData?.map(a => [a.goal_id, a.player?.nickname || a.player?.name]) || []
      );

      // Load cards
      const { data: cardsData, error: cardsError } = await supabase
        .from("cards")
        .select(`
          id,
          minute,
          card_type,
          player_id,
          match_id,
          matches!inner(match_number, round_id),
          player:profiles!cards_player_id_fkey(nickname, name)
        `)
        .eq("matches.round_id", roundId);

      if (cardsError) throw cardsError;

      // Get team colors for card players
      const cardPlayerIds = cardsData?.map(c => c.player_id) || [];
      const { data: teamPlayersData } = await supabase
        .from("round_team_players")
        .select("player_id, team_color")
        .eq("round_id", roundId)
        .in("player_id", cardPlayerIds);

      const teamPlayersMap = new Map(
        teamPlayersData?.map(tp => [tp.player_id, tp.team_color]) || []
      );

      // Map goals to events
      const goalEvents: Event[] = (goalsData || []).map(g => ({
        id: g.id,
        type: 'goal' as const,
        minute: g.minute,
        player_name: g.player?.nickname || g.player?.name || 'Desconhecido',
        player_id: g.player_id || '',
        team_color: g.team_color,
        match_number: g.matches?.match_number || 0,
        match_id: g.match_id,
        assist_name: assistsMap.get(g.id),
      }));

      // Map cards to events
      const cardEvents: Event[] = (cardsData || []).map(c => ({
        id: c.id,
        type: c.card_type === 'amarelo' ? 'amarelo' as const : 'azul' as const,
        minute: c.minute,
        player_name: c.player?.nickname || c.player?.name || 'Desconhecido',
        player_id: c.player_id,
        team_color: teamPlayersMap.get(c.player_id) || '',
        match_number: c.matches?.match_number || 0,
        match_id: c.match_id,
      }));

      setEvents([...goalEvents, ...cardEvents]);
    } catch (error) {
      console.error("Erro ao carregar eventos:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique players for filter suggestions
  const uniquePlayers = useMemo(() => {
    const players = new Set(events.map(e => e.player_name));
    return Array.from(players).sort();
  }, [events]);

  // Get unique teams
  const uniqueTeams = useMemo(() => {
    const teams = new Set(events.map(e => e.team_color).filter(Boolean));
    return Array.from(teams);
  }, [events]);

  // Filter and sort events
  const filteredEvents = useMemo(() => {
    let filtered = [...events];

    // Apply type filter
    if (typeFilter !== "all") {
      if (typeFilter === "goals") {
        filtered = filtered.filter(e => e.type === "goal");
      } else if (typeFilter === "cards") {
        filtered = filtered.filter(e => e.type === "amarelo" || e.type === "azul");
      } else if (typeFilter === "amarelo") {
        filtered = filtered.filter(e => e.type === "amarelo");
      } else if (typeFilter === "azul") {
        filtered = filtered.filter(e => e.type === "azul");
      }
    }

    // Apply player filter
    if (playerFilter) {
      const search = playerFilter.toLowerCase();
      filtered = filtered.filter(e => 
        e.player_name.toLowerCase().includes(search) ||
        (e.assist_name && e.assist_name.toLowerCase().includes(search))
      );
    }

    // Apply team filter
    if (teamFilter !== "all") {
      filtered = filtered.filter(e => e.team_color === teamFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "minute":
          comparison = a.minute - b.minute;
          break;
        case "player":
          comparison = a.player_name.localeCompare(b.player_name);
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "match":
          comparison = a.match_number - b.match_number;
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [events, typeFilter, playerFilter, teamFilter, sortBy, sortOrder]);

  // Stats
  const stats = useMemo(() => ({
    totalGoals: events.filter(e => e.type === "goal").length,
    totalYellowCards: events.filter(e => e.type === "amarelo").length,
    totalBlueCards: events.filter(e => e.type === "azul").length,
  }), [events]);

  const clearFilters = () => {
    setTypeFilter("all");
    setPlayerFilter("");
    setTeamFilter("all");
  };

  const hasActiveFilters = typeFilter !== "all" || playerFilter !== "" || teamFilter !== "all";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-muted/10 border-border">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/20 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter size={20} className="text-primary" />
                Eventos da Rodada
                {events.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {events.length}
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-3">
                {events.length > 0 && (
                  <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{EVENT_ICONS.goal} {stats.totalGoals}</span>
                    <span>{EVENT_ICONS.amarelo} {stats.totalYellowCards}</span>
                    <span>{EVENT_ICONS.azul} {stats.totalBlueCards}</span>
                  </div>
                )}
                {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando eventos...
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum evento registrado nesta rodada
              </div>
            ) : (
              <>
                {/* Filters */}
                <div className="mb-4 space-y-3">
                  {/* Mobile stats */}
                  <div className="sm:hidden flex items-center justify-center gap-4 text-sm text-muted-foreground mb-2">
                    <span>{EVENT_ICONS.goal} {stats.totalGoals}</span>
                    <span>{EVENT_ICONS.amarelo} {stats.totalYellowCards}</span>
                    <span>{EVENT_ICONS.azul} {stats.totalBlueCards}</span>
                  </div>
                  
                  {/* Filter row */}
                  <div className="flex flex-wrap gap-2">
                    {/* Type filter */}
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-[140px] h-10">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="goals">{EVENT_ICONS.goal} Gols</SelectItem>
                        <SelectItem value="cards">🎴 Cartões</SelectItem>
                        <SelectItem value="amarelo">{EVENT_ICONS.amarelo} Amarelo</SelectItem>
                        <SelectItem value="azul">{EVENT_ICONS.azul} Azul</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Team filter */}
                    <Select value={teamFilter} onValueChange={setTeamFilter}>
                      <SelectTrigger className="w-[140px] h-10">
                        <SelectValue placeholder="Time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {uniqueTeams.map(team => (
                          <SelectItem key={team} value={team}>
                            {teamNames[team] || team}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Player search */}
                    <div className="relative flex-1 min-w-[150px]">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar jogador..."
                        value={playerFilter}
                        onChange={(e) => setPlayerFilter(e.target.value)}
                        className="pl-9 h-10"
                      />
                    </div>

                    {/* Clear filters */}
                    {hasActiveFilters && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={clearFilters}
                        className="h-10 w-10"
                      >
                        <X size={18} />
                      </Button>
                    )}
                  </div>

                  {/* Sort row */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm text-muted-foreground">Ordenar por:</span>
                    <div className="flex gap-1">
                      {[
                        { key: "minute", label: "Minuto" },
                        { key: "player", label: "Jogador" },
                        { key: "type", label: "Tipo" },
                        { key: "match", label: "Partida" },
                      ].map(({ key, label }) => (
                        <Button
                          key={key}
                          variant={sortBy === key ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            if (sortBy === key) {
                              setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                            } else {
                              setSortBy(key as any);
                              setSortOrder("asc");
                            }
                          }}
                          className="h-8 px-3 text-xs gap-1"
                        >
                          {label}
                          {sortBy === key && (
                            sortOrder === "asc" ? <SortAsc size={12} /> : <SortDesc size={12} />
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Results count */}
                {hasActiveFilters && (
                  <div className="text-sm text-muted-foreground mb-3">
                    Mostrando {filteredEvents.length} de {events.length} eventos
                  </div>
                )}

                {/* Events list */}
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
                  {filteredEvents.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      Nenhum evento corresponde aos filtros
                    </div>
                  ) : (
                    filteredEvents.map((event) => (
                      <div
                        key={`${event.type}-${event.id}`}
                        onClick={() => onEventClick?.(event.match_id)}
                        className="flex items-center gap-3 p-3 bg-background/50 rounded-lg hover:bg-background/80 transition-colors cursor-pointer"
                      >
                        {/* Event icon */}
                        <EventIcon type={event.type as EventType} size="md" />
                        
                        {/* Event info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {event.player_name}
                          </div>
                          {event.assist_name && (
                            <div className="text-xs text-muted-foreground truncate">
                              Assist: {event.assist_name}
                            </div>
                          )}
                        </div>

                        {/* Team badge */}
                        {event.team_color && (
                          <Badge className={`${teamColors[event.team_color]} text-xs px-2 py-0.5 flex-shrink-0`}>
                            {teamNames[event.team_color]?.substring(0, 3) || event.team_color.substring(0, 3)}
                          </Badge>
                        )}

                        {/* Match number */}
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          J{event.match_number}
                        </span>

                        {/* Minute */}
                        <span className="text-sm font-medium text-primary flex-shrink-0 min-w-[35px] text-right">
                          {formatMinute(event.minute)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
