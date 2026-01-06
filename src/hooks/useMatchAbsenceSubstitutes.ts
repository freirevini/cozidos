import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AbsenceSubstitute {
    player_id: string;
    team_color: string;
    player: {
        id: string;
        name: string;
        nickname: string | null;
        position: "goleiro" | "defensor" | "meio-campista" | "atacante" | null;
        level?: string;
        avatar_url?: string;
    } | null;
}

export function useMatchAbsenceSubstitutes(matchId: string | undefined) {
    const [absenceSubstitutes, setAbsenceSubstitutes] = useState<AbsenceSubstitute[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!matchId) {
            setLoading(false);
            return;
        }

        const loadAbsenceSubstitutes = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from("match_absence_substitutes")
                    .select(`
            substitute_player_id,
            team_color,
            player:profiles!match_absence_substitutes_substitute_player_id_fkey(
              id, name, nickname, position, level, avatar_url
            )
          `)
                    .eq("match_id", matchId);

                if (error) {
                    console.error("[useMatchAbsenceSubstitutes] Error:", error);
                    setAbsenceSubstitutes([]);
                } else {
                    const subs = (data || []).map((sub: any) => ({
                        player_id: sub.substitute_player_id,
                        team_color: sub.team_color,
                        player: sub.player,
                    }));
                    setAbsenceSubstitutes(subs);
                }
            } catch (error) {
                console.error("[useMatchAbsenceSubstitutes] Exception:", error);
                setAbsenceSubstitutes([]);
            } finally {
                setLoading(false);
            }
        };

        loadAbsenceSubstitutes();

        // Subscribe to realtime changes
        const channel = supabase
            .channel(`match-absence-subs-${matchId}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "match_absence_substitutes", filter: `match_id=eq.${matchId}` },
                () => loadAbsenceSubstitutes()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [matchId]);

    return { absenceSubstitutes, loading };
}
