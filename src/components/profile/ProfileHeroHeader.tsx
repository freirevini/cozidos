import { Badge } from "@/components/ui/badge";
import { AvatarUpload } from "@/components/AvatarUpload";
import { Camera, Trophy } from "lucide-react";
import { useState } from "react";
import bgCard from "@/assets/bg-card.png";

interface ProfileHeroHeaderProps {
  id: string;
  name: string;
  nickname: string | null;
  avatarUrl: string | null;
  position: string | null;
  level: string | null;
  birthDate: string | null;
  rankingPosition: number | null;
  isOwnProfile: boolean;
  onAvatarUpdate?: (url: string | null) => void;
}

const positionMap: Record<string, string> = {
  goleiro: "GK",
  defensor: "DEF",
  "meio-campista": "MID",
  "meio_campo": "MID",
  atacante: "FWD",
};

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function ProfileHeroHeader({
  id,
  name,
  nickname,
  avatarUrl,
  position,
  level,
  birthDate,
  rankingPosition,
  isOwnProfile,
  onAvatarUpdate
}: ProfileHeroHeaderProps) {
  const [showUpload, setShowUpload] = useState(false);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl);

  const displayName = nickname || name.split(" ")[0];
  const age = calculateAge(birthDate);

  const handleAvatarUpdate = (url: string | null) => {
    setCurrentAvatarUrl(url);
    setShowUpload(false);
    onAvatarUpdate?.(url);
  };

  return (
    <div className="relative w-full bg-background overflow-hidden border-b border-border/50 font-sans">
      {/* Upload Modal Overlay */}
      {isOwnProfile && showUpload && (
        <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <div className="flex justify-end mb-2">
              <button onClick={() => setShowUpload(false)} className="text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>
            <AvatarUpload
              playerId={id}
              playerName={displayName}
              currentAvatarUrl={currentAvatarUrl}
              onUploadComplete={handleAvatarUpdate}
            />
          </div>
        </div>
      )}

      {/* Main Card Container */}
      <div className="relative h-[440px] sm:h-[500px] w-full max-w-md mx-auto sm:max-w-none shadow-2xl">

        {/* Layer 0: Unified Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src={bgCard}
            alt="Background"
            className="w-full h-full object-cover opacity-90"
          />
          {/* Dark gradient overlay to ensure text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
        </div>

        {/* Content Grid */}
        <div className="absolute inset-0 z-30 grid grid-cols-2 p-6 pb-2">

          {/* LEFT COLUMN: Info */}
          <div className="flex flex-col items-start justify-between h-full py-4">



            {/* Middle/Bottom: Player Details */}
            <div className="flex flex-col items-start gap-4 mb-8">
              <div className="flex flex-col">
                {/* Name */}
                <h1 className="text-5xl sm:text-6xl font-black text-white italic tracking-tighter uppercase leading-[0.85] drop-shadow-lg"
                  style={{ textShadow: '4px 4px 0px rgba(0,0,0,0.5)' }}>
                  {displayName}
                </h1>
              </div>

              {/* Ranking Badge & Level */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Ranking */}
                <div className="flex items-center gap-2 bg-amber-400 px-3 py-1 rounded-full shadow-lg shadow-amber-900/40 transform -skew-x-12">
                  <Trophy size={16} className="text-black" />
                  <span className="text-lg font-black text-black">
                    {rankingPosition ? `${rankingPosition}º` : '-'}
                  </span>
                </div>

                {level && (
                  <div className="bg-pink-600 px-3 py-1 rounded-full shadow-lg transform -skew-x-12">
                    <span className="text-sm font-bold text-white tracking-wide">
                      NÍVEL {level}
                    </span>
                  </div>
                )}
              </div>

              {/* Position & Age */}
              <div className="flex gap-4 text-gray-300 font-medium text-sm mt-1 ml-1">
                {position && (
                  <span className="uppercase tracking-widest border-l-2 border-pink-500 pl-2">
                    {positionMap[position] || position}
                  </span>
                )}
                {age && (
                  <span className="border-l-2 border-gray-600 pl-2">
                    {age} ANOS
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Player Image */}
          <div className="relative h-full flex items-end justify-center pointer-events-none">
            {/* The image is positioned absolutely to settle at the bottom right/center */}
          </div>
        </div>

        {/* Layer 2: Player Image (Outside grid to allow overflow/custom positioning) */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          {currentAvatarUrl ? (
            <img
              src={currentAvatarUrl}
              alt={displayName}
              className="absolute bottom-0 right-[-10%] sm:right-[5%] h-[90%] sm:h-[95%] object-contain object-bottom drop-shadow-2xl filter contrast-110"
            />
          ) : (
            // Fallback: Standard layout but with avatar placeholder in the "photo spot"
            <div className="absolute bottom-0 right-[5%] sm:right-[15%] h-[50%] flex items-end opacity-80">
              <div className="w-48 h-48 rounded-full bg-secondary/20 backdrop-blur-sm border-4 border-pink-500/30 flex items-center justify-center mb-12">
                <span className="text-7xl font-bold text-white/50">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Edit Button */}
        {isOwnProfile && !showUpload && (
          <button
            onClick={() => setShowUpload(true)}
            className="absolute top-4 right-4 z-50 p-3 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full border border-white/20 text-white transition-all hover:scale-105 active:scale-95"
          >
            <Camera className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
