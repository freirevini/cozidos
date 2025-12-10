import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PlayerEventCounts {
  player_id: string;
  goals_count: number;
  yellow_count: number;
  blue_count: number;
  sub_in_minute: number | null;
  is_starter: boolean;
}

export function useMatchPlayerEvents(matchId: string | undefined) {
  const [events, setEvents] = useState<Map<string, PlayerEventCounts>>(new Map());
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!matchId) return;

    try {
      const { data, error } = await supabase.rpc('get_match_player_events', {
        p_match_id: matchId
      });

      if (error) {
        console.error('Error fetching player events:', error);
        return;
      }

      const eventsMap = new Map<string, PlayerEventCounts>();
      (data || []).forEach((row: PlayerEventCounts) => {
        eventsMap.set(row.player_id, row);
      });
      setEvents(eventsMap);
    } catch (err) {
      console.error('Error in fetchEvents:', err);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  // Debounced refetch to coalesce rapid updates
  const debouncedRefetch = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      fetchEvents();
    }, 200);
  }, [fetchEvents]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel(`match-events-${matchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'goals', filter: `match_id=eq.${matchId}` },
        () => debouncedRefetch()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cards', filter: `match_id=eq.${matchId}` },
        () => debouncedRefetch()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'substitutions', filter: `match_id=eq.${matchId}` },
        () => debouncedRefetch()
      )
      .subscribe();

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [matchId, debouncedRefetch]);

  const getPlayerEvents = useCallback((playerId: string): PlayerEventCounts | null => {
    return events.get(playerId) || null;
  }, [events]);

  return { events, loading, getPlayerEvents, refetch: fetchEvents };
}
