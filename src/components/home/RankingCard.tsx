import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlayerStats } from "./types";

export interface RankingCardProps {
    title: string;
    topLabel: string;
    valueLabel: string;
    players: PlayerStats[];
    loading: boolean;
    navigateTo: string;
    getValue: (player: PlayerStats) => number | string;
    formatValue?: (value: number | string) => string;
}

const RankingCard: React.FC<RankingCardProps> = ({
    title,
    topLabel,
    valueLabel,
    players,
    loading,
    navigateTo,
    getValue,
    formatValue = (v) => String(v),
}) => {
    const navigate = useNavigate();

    return (
        <article
            className="relative overflow-hidden bg-[#1c1c1e] rounded-2xl p-4 flex flex-col border border-white/5 shadow-lg group transition-transform duration-300 hover:-translate-y-1 cursor-pointer"
            onClick={() => navigate(navigateTo)}
        >
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-500/10 blur-[40px] rounded-full group-hover:bg-pink-500/20 transition-colors duration-500" />
            <div className="relative z-10 flex justify-between items-start mb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-pink-200 bg-pink-500/20 px-2 py-0.5 rounded-md border border-pink-500/20">
                    {title}
                </span>
            </div>
            <div className="relative z-10 flex-grow flex flex-col gap-2">
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-5 w-full" />
                    ))
                ) : players.length > 0 ? (
                    <>
                        <div className="flex items-end justify-between pb-2 mb-1 border-b border-white/10">
                            <div>
                                <span className="text-[9px] font-bold text-pink-300 uppercase tracking-wider block mb-0.5">
                                    {topLabel}
                                </span>
                                <span className="text-lg font-black text-white leading-none">
                                    {players[0]?.nickname?.toUpperCase()}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-lg font-bold text-pink-300 leading-none">
                                    {formatValue(getValue(players[0]))}
                                </span>
                                <span className="text-[9px] text-gray-300 block uppercase font-bold">
                                    {valueLabel}
                                </span>
                            </div>
                        </div>
                        {players.slice(1, 5).map((player, idx) => (
                            <div key={player.player_id} className="flex items-center justify-between text-xs py-0.5">
                                <div className="flex items-center gap-2.5">
                                    <span className="font-bold text-gray-400 w-3 text-center">{idx + 2}</span>
                                    <span className="font-bold text-gray-100">{player.nickname?.toUpperCase()}</span>
                                </div>
                                <span className="font-bold text-white">{formatValue(getValue(player))}</span>
                            </div>
                        ))}
                    </>
                ) : (
                    <div className="text-gray-400 text-sm">Sem dados</div>
                )}
            </div>
            <div className="relative z-10 mt-4 pt-3 border-t border-white/10 flex justify-between items-center bg-black/20 -mx-4 -mb-4 px-4 py-3">
                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wide">Ver mais</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-pink-300 transition-colors" />
            </div>
        </article>
    );
};

export default React.memo(RankingCard);
