import { Badge } from "@/components/ui/badge";
import { AvatarUpload } from "@/components/AvatarUpload";
import { Camera, ChevronUp } from "lucide-react";
import { useState } from "react";
import logoCozidos from "@/assets/logo-cozidos-novo.png";

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
  atacante: "ATK",
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
    <div className="relative bg-background overflow-hidden">
      {/* Background Logo - Giant, semi-transparent */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <img 
          src={logoCozidos} 
          alt="" 
          className="w-[120%] max-w-none h-auto opacity-15 object-contain"
          style={{ filter: 'brightness(0.8)' }}
        />
      </div>

      {/* Hero Container - 45vh height */}
      <div className="relative h-[45vh] min-h-[320px] max-h-[500px]">
        {/* Player Image Container */}
        {isOwnProfile && showUpload ? (
          <div className="absolute inset-0 flex items-center justify-center z-10 p-8">
            <AvatarUpload
              playerId={id}
              playerName={displayName}
              currentAvatarUrl={currentAvatarUrl}
              onUploadComplete={handleAvatarUpdate}
            />
          </div>
        ) : (
          <>
            {/* Player Photo - Rectangular, aligned to bottom */}
            {currentAvatarUrl ? (
              <div className="absolute inset-0 flex items-end justify-center">
                <img 
                  src={currentAvatarUrl} 
                  alt={displayName}
                  className="w-full h-full object-cover object-top"
                  style={{ objectPosition: 'center top' }}
                />
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-40 h-40 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-6xl font-bold text-primary">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            )}

            {/* Gradient Overlay - Fades to black at bottom */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(
                  to bottom,
                  transparent 0%,
                  transparent 40%,
                  hsl(0 0% 0% / 0.3) 60%,
                  hsl(0 0% 0% / 0.7) 80%,
                  hsl(0 0% 0% / 1) 100%
                )`
              }}
            />

            {/* Camera button for own profile */}
            {isOwnProfile && (
              <button
                onClick={() => setShowUpload(true)}
                className="absolute top-4 right-4 p-3 bg-background/70 backdrop-blur-sm rounded-full shadow-lg hover:bg-background/90 transition-colors z-20 border border-border/50"
              >
                <Camera className="w-5 h-5 text-primary" />
              </button>
            )}
          </>
        )}

        {/* Player Info - Bottom left, over gradient */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-4">
          {/* Name - Large, bold */}
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight uppercase drop-shadow-lg">
            {displayName}
          </h1>
          
          {/* Stats badges row */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {position && (
              <Badge 
                variant="outline" 
                className="bg-background/40 backdrop-blur-sm border-white/20 text-white text-xs px-2 py-0.5"
              >
                {positionMap[position] || position}
              </Badge>
            )}
            {level && (
              <Badge 
                className="bg-primary/90 text-primary-foreground text-xs px-2 py-0.5"
              >
                Nível {level}
              </Badge>
            )}
            {age !== null && (
              <Badge 
                variant="outline" 
                className="bg-background/40 backdrop-blur-sm border-white/20 text-white text-xs px-2 py-0.5"
              >
                {age} anos
              </Badge>
            )}
            {rankingPosition !== null && rankingPosition > 0 && (
              <Badge className="bg-amber-500/90 text-black font-bold text-xs px-2 py-0.5">
                #{rankingPosition}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
