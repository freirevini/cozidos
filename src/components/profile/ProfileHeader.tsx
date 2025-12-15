import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface ProfileHeaderProps {
  name: string;
  nickname: string | null;
  avatarUrl: string | null;
  position: string | null;
  level: string | null;
  status: string | null;
}

const positionMap: Record<string, string> = {
  goleiro: "Goleiro",
  defensor: "Defensor",
  "meio-campista": "Meio-Campista",
  atacante: "Atacante",
};

export function ProfileHeader({ name, nickname, avatarUrl, position, level, status }: ProfileHeaderProps) {
  const displayName = nickname || name;
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative">
      {/* Background gradient - inspired by MLS style */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/10 to-background" />
      
      <div className="relative px-4 pt-8 pb-6">
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <Avatar className="w-32 h-32 border-4 border-primary/50 shadow-xl shadow-primary/20">
            <AvatarImage src={avatarUrl || undefined} alt={displayName} className="object-cover" />
            <AvatarFallback className="text-4xl font-bold bg-primary/20 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          {/* Name */}
          <h1 className="mt-4 text-3xl font-bold text-foreground tracking-tight">
            {displayName}
          </h1>
          
          {/* Info badges */}
          <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
            {position && (
              <Badge variant="outline" className="bg-muted/30 border-border/50">
                {positionMap[position] || position}
              </Badge>
            )}
            {level && (
              <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary">
                Nível {level}
              </Badge>
            )}
            {status === 'aprovado' && (
              <Badge className="bg-green-600/80">Aprovado</Badge>
            )}
            {status === 'pendente' && (
              <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">
                Pendente
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
