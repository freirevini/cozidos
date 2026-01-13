import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface ProfileData {
  id: string;
  is_player: boolean;
  status: string | null;
  nickname: string | null;
  name: string | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;  // true when user is logged in
  isGuest: boolean;          // true when user is NOT logged in (visitor)
  isAdmin: boolean;
  isPlayer: boolean;
  isPending: boolean;
  isApproved: boolean;
  profileData: ProfileData | null;
  profile: ProfileData | null; // Alias for profileData
  loading: boolean;
  refreshAuth: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isGuest: true,
  isAdmin: false,
  isPlayer: false,
  isPending: false,
  isApproved: false,
  profileData: null,
  profile: null,
  loading: true,
  refreshAuth: async () => { },
  signOut: async () => { },
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPlayer, setIsPlayer] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (forceLoading = true) => {
    try {
      if (forceLoading) setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Buscar role e profile em paralelo
        const [roleData, profileResult] = await Promise.all([
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("id, is_player, status, nickname, name, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
        ]);

        setIsAdmin(roleData.data?.role === "admin");

        // Se houver múltiplos perfis, priorizar o aprovado ou o mais recente
        const profiles = profileResult.data || [];
        const profile = profiles.length > 0
          ? (profiles.find(p => p.status === 'aprovado') || profiles[0])
          : null;

        setProfileData(profile);
        setIsPlayer(profile?.is_player || false);

        // Jogador aprovado: status='aprovado'
        setIsApproved(profile?.status === 'aprovado');

        // Jogador pendente: is_player=true E status='pendente'
        setIsPending(
          profile?.is_player === true &&
          profile?.status === 'pendente'
        );

        // Log warning se houver múltiplos perfis (mas não quebrar a aplicação)
        if (profiles.length > 1) {
          console.warn(`[AuthContext] Múltiplos perfis encontrados para user_id ${user.id}. Usando perfil: ${profile?.id}`);
        }
      } else {
        setIsAdmin(false);
        setIsPlayer(false);
        setIsPending(false);
        setProfileData(null);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      setUser(null);
      setIsAdmin(false);
      setIsPlayer(false);
      setIsPending(false);
      setIsApproved(false);
      setProfileData(null);
    } finally {
      if (forceLoading) setLoading(false);
    }
  };

  useEffect(() => {
    // Carregar dados do usuário na montagem (com loading)
    loadUserData(true);

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        // Usar setTimeout para evitar deadlock
        setTimeout(() => {
          // Silent refresh (sem loading global) para não piscar a tela
          loadUserData(false);
        }, 0);
      } else {
        setUser(null);
        setIsAdmin(false);
        setIsPlayer(false);
        setIsPending(false);
        setIsApproved(false);
        setProfileData(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isGuest: !user,
      isAdmin,
      isPlayer,
      isPending,
      isApproved,
      profileData,
      profile: profileData, // Alias
      loading,
      refreshAuth: async () => loadUserData(true),
      signOut: handleSignOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
