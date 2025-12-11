import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Substitution {
  id: string;
  match_id: string;
  team_color: string;
  player_out_id: string;
  player_in_id: string;
  minute: number;
  player_out?: {
    id: string;
    name: string;
    nickname: string | null;
    position: string | null;
    level?: string;
    avatar_url?: string;
  };
  player_in?: {
    id: string;
    name: string;
    nickname: string | null;
    position: string | null;
    level?: string;
    avatar_url?: string;
  };
}

export function useMatchSubstitutions(matchId: string | undefined) {
  const [substitutions, setSubstitutions] = useState<Substitution[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSubstitutions = useCallback(async () => {
    if (!matchId) {
      setSubstitutions([]);
      setLoading(false);
      return;
    }

    try {
      console.log('[useMatchSubstitutions] Fetching substitutions for match:', matchId);
      
      const { data, error } = await supabase
        .from("substitutions")
        .select(`
          id,
          match_id,
          team_color,
          player_out_id,
          player_in_id,
          minute,
          player_out:profiles!substitutions_player_out_id_fkey(id, name, nickname, position, level, avatar_url),
          player_in:profiles!substitutions_player_in_id_fkey(id, name, nickname, position, level, avatar_url)
        `)
        .eq("match_id", matchId)
        .order("minute", { ascending: true });

      if (error) {
        console.error('[useMatchSubstitutions] Error fetching:', error);
        return;
      }

      const subs = (data || []).map((sub: any) => ({
        id: sub.id,
        match_id: sub.match_id,
        team_color: sub.team_color,
        player_out_id: sub.player_out_id,
        player_in_id: sub.player_in_id,
        minute: sub.minute,
        player_out: sub.player_out,
        player_in: sub.player_in,
      }));

      console.log('[useMatchSubstitutions] Loaded substitutions:', subs);
      setSubstitutions(subs);
    } catch (err) {
      console.error('[useMatchSubstitutions] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  // Debounced refetch
  const debouncedRefetch = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      fetchSubstitutions();
    }, 150);
  }, [fetchSubstitutions]);

  useEffect(() => {
    fetchSubstitutions();
  }, [fetchSubstitutions]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel(`match-subs-${matchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'substitutions', filter: `match_id=eq.${matchId}` },
        (payload) => {
          console.log('[useMatchSubstitutions] Realtime update:', payload);
          debouncedRefetch();
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [matchId, debouncedRefetch]);

  return { substitutions, loading, refetch: fetchSubstitutions };
}
