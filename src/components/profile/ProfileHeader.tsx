import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AvatarUpload } from "@/components/AvatarUpload";
import { Camera } from "lucide-react";
import { useState } from "react";

interface ProfileHeaderProps {
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
  goleiro: "Goleiro",
  defensor: "Defensor",
  "meio-campista": "Meio-Campista",
  atacante: "Atacante",
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

export function ProfileHeader({
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
}: ProfileHeaderProps) {
  const [showUpload, setShowUpload] = useState(false);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl);

  const displayName = nickname || name;
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const age = calculateAge(birthDate);

  const handleAvatarUpdate = (url: string | null) => {
    setCurrentAvatarUrl(url);
    setShowUpload(false);
    onAvatarUpdate?.(url);
  };

  return (
    <div className="relative">
      {/* Background gradient - inspired by MLS style */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/10 to-background" />

      <div className="relative px-4 pt-8 pb-6">
        {/* Avatar with upload option for own profile */}
        <div className="flex flex-col items-center">
          {isOwnProfile && showUpload ? (
            <AvatarUpload
              playerId={id}
              playerName={displayName}
              currentAvatarUrl={currentAvatarUrl}
              onUploadComplete={handleAvatarUpdate}
            />
          ) : (
            <div className="relative">
              <Avatar className="w-32 h-32 border-4 border-primary/50 shadow-xl shadow-primary/20 bg-muted">
                <AvatarImage src={currentAvatarUrl || undefined} alt={displayName} className="object-cover" />
                <AvatarFallback className="text-4xl font-bold bg-primary/20 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>

              {isOwnProfile && (
                <button
                  onClick={() => setShowUpload(true)}
                  className="absolute bottom-0 right-0 p-2 bg-primary rounded-full shadow-lg hover:bg-primary/90 transition-colors"
                >
                  <Camera className="w-4 h-4 text-primary-foreground" />
                </button>
              )}
            </div>
          )}

          {/* Name */}
          <h1 className="mt-4 text-3xl font-bold text-foreground tracking-tight">
            {displayName}
          </h1>

          {/* Info badges - Age, Level, Ranking Position */}
          <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
            {age !== null && (
              <Badge variant="outline" className="bg-muted/30 border-border/50">
                {age} anos
              </Badge>
            )}
            {level && (
              <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary">
                Nível {level}
              </Badge>
            )}
            {position && (
              <Badge variant="outline" className="bg-muted/30 border-border/50">
                {positionMap[position] || position}
              </Badge>
            )}
            {rankingPosition !== null && rankingPosition > 0 && (
              <Badge className="bg-amber-600/80 hover:bg-amber-600">
                #{rankingPosition} no Ranking
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}