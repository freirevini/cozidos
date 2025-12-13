import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Settings, Eye, ArrowLeft } from "lucide-react";

export default function Teams() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-primary">
            Times
          </h1>
        </div>

        {/* Cards de navegação */}
        <div className="grid gap-4 max-w-lg mx-auto">
          {/* Ver times - visível para todos */}
          <Card 
            className="bg-gradient-to-br from-card/90 to-card/50 border-border/30 hover:border-primary/30 transition-all cursor-pointer group"
            onClick={() => navigate("/teams/view")}
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Eye className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground">
                  Ver Times
                </h2>
                <p className="text-sm text-muted-foreground">
                  Visualize os times de cada rodada
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Opções admin */}
          {isAdmin && (
            <>
              <Card 
                className="bg-gradient-to-br from-card/90 to-card/50 border-border/30 hover:border-primary/30 transition-all cursor-pointer group"
                onClick={() => navigate("/admin/teams/define")}
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-foreground">
                      Definir Times
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Crie novos times para uma rodada
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="bg-gradient-to-br from-card/90 to-card/50 border-border/30 hover:border-primary/30 transition-all cursor-pointer group"
                onClick={() => navigate("/admin/teams/manage")}
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Settings className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-foreground">
                      Gerenciar Times
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Edite ou exclua times existentes
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
