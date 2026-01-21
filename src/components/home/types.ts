// Types shared across Home components

export interface PlayerStats {
    player_id: string;
    nickname: string;
    pontos_totais: number;
    gols: number;
    assistencias: number;
    saldo_gols: number;
    presencas: number;
    vitorias: number;
    derrotas: number;
    cartoes_amarelos: number;
    cartoes_azuis: number;
}

export interface LastRoundStats {
    total_points: number;
    goals: number;
    assists: number;
}

export interface RetrospectItem {
    result: 'win' | 'draw' | 'loss';
}

export interface NextMatchData {
    round_id: string;
    round_number: number;
    scheduled_date: string;
    user_team_name: string | null;
    user_team_color: string | null;
}

export interface AdminLastRoundEvents {
    goals: number;
    assists: number;
    yellowCards: number;
    blueCards: number;
}

export interface LiveMatch {
    id: string;
    teamHome: string;
    teamAway: string;
    scoreHome: number;
    scoreAway: number;
    minutes: number;
}

export interface TeamPlayerHome {
    id: string;
    nickname: string;
    level: string | null;
    position: string | null;
}

export interface UpcomingTeamData {
    roundNumber: number;
    scheduledDate: string;
    teamsByColor: Record<string, TeamPlayerHome[]>;
}

// Sorting function with tiebreaker criteria
export const sortPlayers = (a: PlayerStats, b: PlayerStats): number => {
    if (a.pontos_totais !== b.pontos_totais) return b.pontos_totais - a.pontos_totais;
    if (a.presencas !== b.presencas) return b.presencas - a.presencas;
    if (a.vitorias !== b.vitorias) return b.vitorias - a.vitorias;
    if (a.saldo_gols !== b.saldo_gols) return b.saldo_gols - a.saldo_gols;
    const cardsA = (a.cartoes_amarelos || 0) + (a.cartoes_azuis || 0);
    const cardsB = (b.cartoes_amarelos || 0) + (b.cartoes_azuis || 0);
    if (cardsA !== cardsB) return cardsA - cardsB;
    if (a.assistencias !== b.assistencias) return b.assistencias - a.assistencias;
    if (a.gols !== b.gols) return b.gols - a.gols;
    if (a.derrotas !== b.derrotas) return a.derrotas - b.derrotas;
    return a.nickname.localeCompare(b.nickname);
};

// Team color styles
export const teamColorStyles: Record<string, { bg: string; text: string; border: string }> = {
    laranja: { bg: "bg-gradient-to-r from-orange-500 to-orange-600", text: "text-white", border: "border-orange-500/30" },
    preto: { bg: "bg-gradient-to-r from-zinc-700 to-zinc-800", text: "text-white", border: "border-zinc-600/30" },
    branco: { bg: "bg-gradient-to-r from-zinc-100 to-zinc-200", text: "text-zinc-900", border: "border-zinc-300/50" },
    azul: { bg: "bg-gradient-to-r from-blue-500 to-blue-600", text: "text-white", border: "border-blue-500/30" },
};

export const teamDisplayNames: Record<string, string> = {
    laranja: "Laranja", preto: "Preto", branco: "Branco", azul: "Azul",
};

// Sort players by level
export const sortPlayersByLevel = (players: TeamPlayerHome[]): TeamPlayerHome[] => {
    const levelOrder = ["A", "B", "C", "D", "E"];
    return [...players].sort((a, b) => {
        const aIsGK = a.position === "goleiro";
        const bIsGK = b.position === "goleiro";
        if (aIsGK && !bIsGK) return 1;
        if (!aIsGK && bIsGK) return -1;
        if (aIsGK && bIsGK) return 0;
        const levelA = a.level?.toUpperCase() || "Z";
        const levelB = b.level?.toUpperCase() || "Z";
        return levelOrder.indexOf(levelA) - levelOrder.indexOf(levelB);
    });
};

export const getLevelDisplay = (level: string | null, position: string | null): string => {
    if (position === "goleiro") return "GK";
    return level?.toUpperCase() || "-";
};
