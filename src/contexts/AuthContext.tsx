import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  isPlayer: boolean;
  loading: boolean;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  isPlayer: false,
  loading: true,
  refreshAuth: async () => {},
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
  const [loading, setLoading] = useState(true);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Buscar role e is_player em paralelo
        const [roleData, profileData] = await Promise.all([
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("is_player")
            .eq("user_id", user.id)
            .maybeSingle()
        ]);

        setIsAdmin(roleData.data?.role === "admin");
        setIsPlayer(profileData.data?.is_player || false);
      } else {
        setIsAdmin(false);
        setIsPlayer(false);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      setUser(null);
      setIsAdmin(false);
      setIsPlayer(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Carregar dados do usuário na montagem
    loadUserData();

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        // Usar setTimeout para evitar deadlock
        setTimeout(() => {
          loadUserData();
        }, 0);
      } else {
        setUser(null);
        setIsAdmin(false);
        setIsPlayer(false);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAdmin, isPlayer, loading, refreshAuth: loadUserData }}>
      {children}
    </AuthContext.Provider>
  );
};
