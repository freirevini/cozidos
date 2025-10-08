import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  name: string;
  nickname: string | null;
  birth_date: string | null;
  position: string | null;
  level: string | null;
  is_approved: boolean;
  status: string | null;
}

const positionMap: Record<string, string> = {
  goleiro: "Goleiro",
  defensor: "Defensor",
  "meio-campista": "Meio-Campista",
  atacante: "Atacante",
};

const levelMap: Record<string, string> = {
  A: "A",
  B: "B",
  C: "C",
  D: "D",
  E: "E",
};

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    checkAdmin();
    loadProfile();
  }, []);

  useEffect(() => {
    if (!userId) return;

    // Subscribe to profile changes
    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        () => {
          loadProfile();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      setIsAdmin(data?.role === "admin");
    }
  };

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      setUserId(user.id);

      const { data, error } = await supabase
        .from("profiles")
        .select("name, nickname, birth_date, position, level, is_approved, status")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar perfil",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return "-";
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header isAdmin={isAdmin} />
      <main className="container mx-auto px-4 py-8">
        <Card className="card-glow bg-card border-border max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-primary glow-text">
              Meu Perfil
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : !profile ? (
              <div className="text-center py-8 text-muted-foreground">
                Perfil não encontrado
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Nome</p>
                    <p className="text-lg font-medium">{profile.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Apelido</p>
                    <p className="text-lg font-medium">{profile.nickname || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Idade</p>
                    <p className="text-lg font-medium">{calculateAge(profile.birth_date)} anos</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Posição</p>
                    <p className="text-lg font-medium">
                      {profile.position ? positionMap[profile.position] : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Nível</p>
                    <p className="text-lg font-medium">
                      {profile.level ? levelMap[profile.level] : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Status</p>
                    {profile.status === 'aprovado' || profile.is_approved ? (
                      <Badge className="bg-green-600">Aprovado</Badge>
                    ) : profile.status === 'rejeitado' ? (
                      <Badge variant="destructive">Rejeitado</Badge>
                    ) : (
                      <Badge variant="outline">Pendente de Aprovação</Badge>
                    )}
                  </div>
                </div>
                {profile.status !== 'aprovado' && !profile.is_approved && (
                  <div className="mt-6 p-4 bg-muted/20 rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground">
                      Seu perfil está pendente de aprovação pelo administrador. 
                      Após a aprovação, você poderá participar das rodadas.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
