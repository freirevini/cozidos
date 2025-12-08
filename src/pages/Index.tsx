import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PendingPlayerBanner } from "@/components/PendingPlayerBanner";
import { Trophy, Users, Calendar, BarChart3, Settings } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isPending, profileData, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const menuItems = [
    {
      title: "Rodadas",
      description: "Acompanhe as rodadas e partidas",
      icon: Calendar,
      href: "/matches",
      color: "text-blue-500",
    },
    {
      title: "Classificação",
      description: "Veja a tabela de classificação",
      icon: Trophy,
      href: "/classification",
      color: "text-yellow-500",
    },
    {
      title: "Estatísticas",
      description: "Estatísticas detalhadas dos jogadores",
      icon: BarChart3,
      href: "/statistics",
      color: "text-green-500",
    },
    {
      title: "Times",
      description: "Visualize os times das rodadas",
      icon: Users,
      href: "/teams",
      color: "text-purple-500",
    },
  ];

  const adminItems = [
    {
      title: "Gerenciar Jogadores",
      description: "Cadastrar e gerenciar jogadores",
      icon: Users,
      href: "/admin/players",
      color: "text-primary",
    },
    {
      title: "Gerenciar Rodadas",
      description: "Criar e gerenciar rodadas",
      icon: Calendar,
      href: "/admin/round",
      color: "text-primary",
    },
    {
      title: "Definir Times",
      description: "Montar os times da rodada",
      icon: Settings,
      href: "/admin/teams",
      color: "text-primary",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {/* Banner para jogadores pendentes */}
        {isPending && <PendingPlayerBanner />}

        {/* Saudação */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Olá, {profileData?.nickname || profileData?.name || 'Usuário'}!
          </h1>
          <p className="text-muted-foreground mt-2">
            {isPending 
              ? "Seu cadastro está pendente. Enquanto isso, explore as funcionalidades abaixo."
              : "Bem-vindo ao sistema de gerenciamento de partidas."
            }
          </p>
        </div>

        {/* Menu principal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {menuItems.map((item) => (
            <Card 
              key={item.href}
              className="cursor-pointer hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 border-border bg-card"
              onClick={() => navigate(item.href)}
            >
              <CardHeader className="pb-2">
                <item.icon className={`h-8 w-8 ${item.color}`} />
              </CardHeader>
              <CardContent>
                <CardTitle className="text-lg mb-1">{item.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Área admin */}
        {isAdmin && (
          <>
            <h2 className="text-2xl font-bold text-foreground mb-4">Administração</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {adminItems.map((item) => (
                <Card 
                  key={item.href}
                  className="cursor-pointer hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 border-primary/30 bg-primary/5"
                  onClick={() => navigate(item.href)}
                >
                  <CardHeader className="pb-2">
                    <item.icon className={`h-8 w-8 ${item.color}`} />
                  </CardHeader>
                  <CardContent>
                    <CardTitle className="text-lg mb-1">{item.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
