import React from 'react';
import { useNavigate } from 'react-router-dom';

// Team assets mapping
import teamAzul from '@/assets/team-azul.png';
import teamBranco from '@/assets/team-branco.png';
import teamPreto from '@/assets/team-preto.png';
import teamLaranja from '@/assets/team-laranja.png';

export type TeamColor = 'azul' | 'branco' | 'preto' | 'laranja';
export type MatchStatus = 'scheduled' | 'in_progress' | 'finished';

const teamAssets: Record<TeamColor, { logo: string; name: string; color: string }> = {
    azul: { logo: teamAzul, name: 'Azul', color: '#3b82f6' },
    branco: { logo: teamBranco, name: 'Branco', color: '#ffffff' },
    preto: { logo: teamPreto, name: 'Preto', color: '#1a1a1a' },
    laranja: { logo: teamLaranja, name: 'Laranja', color: '#f97316' }
};

interface MatchRowCompactProps {
    matchId: string;
    roundId: string;
    teamHome: TeamColor;
    teamAway: TeamColor;
    scoreHome: number;
    scoreAway: number;
    status: MatchStatus;
    minutes?: number; // For live matches
    scheduledTime?: string; // For scheduled matches (e.g., "20:00")
    onClick?: () => void;
    isAdmin?: boolean; // Controls navigation route
}

const MatchRowCompact: React.FC<MatchRowCompactProps> = ({
    matchId,
    roundId,
    teamHome,
    teamAway,
    scoreHome,
    scoreAway,
    status,
    minutes,
    scheduledTime,
    onClick,
    isAdmin = false
}) => {
    const navigate = useNavigate();

    const homeTeam = teamAssets[teamHome] || teamAssets.branco;
    const awayTeam = teamAssets[teamAway] || teamAssets.branco;

    const handleClick = () => {
        if (onClick) {
            onClick();
        } else if (isAdmin) {
            navigate(`/admin/match/${matchId}/${roundId}`);
        } else {
            navigate(`/match/${matchId}`);
        }
    };

    const getStatusDisplay = () => {
        switch (status) {
            case 'finished':
                return { main: 'FIM', sub: '', color: 'text-white' };
            case 'in_progress':
                return { main: 'AO VIVO', sub: minutes ? `${minutes}'` : '', color: 'text-pink-400' };
            case 'scheduled':
                return { main: scheduledTime || '--:--', sub: '', color: 'text-gray-400' };
            default:
                return { main: '--', sub: '', color: 'text-gray-400' };
        }
    };

    const statusDisplay = getStatusDisplay();
    const isLive = status === 'in_progress';
    const homeWon = status === 'finished' && scoreHome > scoreAway;
    const awayWon = status === 'finished' && scoreAway > scoreHome;

    return (
        <div
            className="bg-[#1c1c1e] px-3 py-2.5 flex items-center cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
            onClick={handleClick}
        >
            {/* Logos Column */}
            <div className="flex flex-col items-center gap-1.5 mr-3 w-7">
                <img
                    src={homeTeam.logo}
                    alt={homeTeam.name}
                    className="rounded-full bg-gray-700 object-cover w-7 h-7"
                />
                <img
                    src={awayTeam.logo}
                    alt={awayTeam.name}
                    className="rounded-full bg-gray-700 object-cover w-7 h-7"
                />
            </div>

            {/* Teams and Scores Column */}
            <div className="flex-1 flex flex-col justify-center gap-1.5">
                <div className="flex justify-between items-center pr-3">
                    <span className={`text-sm font-semibold ${homeWon ? 'text-green-400' : 'text-white'}`}>
                        {homeTeam.name}
                    </span>
                    <span className={`text-sm font-semibold ${status === 'scheduled' ? 'text-gray-500' : 'text-white'}`}>
                        {status !== 'scheduled' ? scoreHome : ''}
                    </span>
                </div>

                <div className="flex justify-between items-center pr-3">
                    <span className={`text-sm font-semibold ${awayWon ? 'text-green-400' : 'text-white'}`}>
                        {awayTeam.name}
                    </span>
                    <span className={`text-sm font-semibold ${status === 'scheduled' ? 'text-gray-500' : awayWon ? 'text-green-400' : 'text-white'}`}>
                        {status !== 'scheduled' ? scoreAway : ''}
                    </span>
                </div>
            </div>

            {/* Vertical Separator */}
            <div className="w-px h-10 mx-2 bg-white/10"></div>

            {/* Status Column */}
            <div className="w-16 flex flex-col items-center justify-center text-center shrink-0">
                <span className={`text-xs font-bold ${statusDisplay.color} ${isLive ? 'animate-pulse' : ''}`}>
                    {statusDisplay.main}
                </span>
                {statusDisplay.sub && (
                    <span className="text-[10px] font-medium text-pink-300">
                        {statusDisplay.sub}
                    </span>
                )}
            </div>
        </div>
    );
};

export default MatchRowCompact;
