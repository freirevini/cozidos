import { Badge } from "@/components/ui/badge";
import { AvatarUpload } from "@/components/AvatarUpload";
import { Camera, Shield } from "lucide-react";
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
    <div className="relative w-full bg-background overflow-hidden border-b border-border/50">
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
      <div className="relative h-[480px] sm:h-[500px] w-full max-w-md mx-auto sm:max-w-none">

        {/* Layer 0: Background Gradient & Pattern */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/90 to-background z-0"></div>

        {/* Layer 1: Team Logo Aura (Background) */}
        <div className="absolute inset-x-0 bottom-20 flex justify-center z-10 opacity-10 pointer-events-none">
          <img
            src={logoCozidos}
            alt="Logo Background"
            className="w-[120%] h-auto max-w-none ml-20 sm:ml-0 scale-150 blur-[2px]"
          />
        </div>

        {/* Layer 2: Player Image (Transparent PNG) */}
        <div className="absolute inset-0 z-20 flex items-end justify-center overflow-hidden">
          {currentAvatarUrl ? (
            <img
              src={currentAvatarUrl}
              alt={displayName}
              className="h-[95%] w-auto object-contain object-bottom drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-transform hover:scale-105 duration-700"
            />
          ) : (
            // Fallback for no image
            <div className="mb-20">
              <div className="w-48 h-48 rounded-full bg-secondary/30 flex items-center justify-center border-4 border-secondary/50 backdrop-blur-md">
                <span className="text-7xl font-bold text-primary opacity-80">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Layer 3: Info Overlay Gradient */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background via-background/90 to-transparent z-30 pointer-events-none"></div>

        {/* Layer 4: Text Content */}
        <div className="absolute bottom-0 left-0 right-0 z-40 p-6 flex flex-col items-start sm:items-center">

          <div className="flex items-center gap-2 mb-1">
            {rankingPosition && rankingPosition > 0 && (
              <Badge className="bg-amber-500 hover:bg-amber-600 text-black font-bold h-6 px-2 shadow-lg shadow-amber-900/20">
                #{rankingPosition}
              </Badge>
            )}
            {level && (
              <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 h-6 px-2 backdrop-blur-sm">
                NÍVEL {level}
              </Badge>
            )}
          </div>

          <h1 className="text-5xl sm:text-6xl font-black text-foreground uppercase tracking-tighter leading-none mb-2" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
            {displayName}
          </h1>

          <div className="flex items-center gap-4 text-sm sm:text-base font-medium text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Shield size={16} className="text-primary" />
              <span className="text-foreground">{position ? (positionMap[position] || position).toUpperCase() : 'JOGADOR'}</span>
            </div>

            {age !== null && (
              <>
                <span className="w-1 h-1 rounded-full bg-border"></span>
                <span>{age} ANOS</span>
              </>
            )}
          </div>
        </div>

        {/* Edit Button */}
        {isOwnProfile && !showUpload && (
          <button
            onClick={() => setShowUpload(true)}
            className="absolute top-4 right-4 z-50 p-3 bg-secondary/80 hover:bg-secondary backdrop-blur-md rounded-full shadow-lg border border-white/10 transition-all active:scale-95 group"
          >
            <Camera className="w-5 h-5 text-primary group-hover:text-primary/80" />
          </button>
        )}
      </div>
    </div>
  );
}
