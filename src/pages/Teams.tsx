import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import { Users, Settings, Eye, ArrowLeft } from "lucide-react";

export default function Teams() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0e0e10] text-white font-sans">
      <Header />
      <main className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-[22px] font-bold text-white tracking-tight">
            Times
          </h1>
        </div>

        {/* Cards de navegação */}
        <div className="grid gap-4 max-w-lg mx-auto">
          {/* Ver times - visível para todos */}
          <article
            className="relative overflow-hidden bg-[#1c1c1e] rounded-2xl p-4 flex items-center gap-4 border border-white/5 shadow-lg group transition-transform duration-300 hover:-translate-y-1 cursor-pointer"
            onClick={() => navigate("/teams/view")}
          >
            {/* Glow effect */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-500/10 blur-[40px] rounded-full group-hover:bg-pink-500/20 transition-colors duration-500" />

            <div className="relative z-10 p-3 rounded-xl bg-pink-500/20 text-pink-400 group-hover:bg-pink-500 group-hover:text-white transition-colors">
              <Eye className="h-6 w-6" />
            </div>
            <div className="relative z-10 flex-1">
              <h2 className="text-lg font-bold text-white">
                Ver Times
              </h2>
              <p className="text-sm text-gray-400">
                Visualize os times de cada rodada
              </p>
            </div>
          </article>

          {/* Opções admin */}
          {isAdmin && (
            <>
              <article
                className="relative overflow-hidden bg-[#1c1c1e] rounded-2xl p-4 flex items-center gap-4 border border-white/5 shadow-lg group transition-transform duration-300 hover:-translate-y-1 cursor-pointer"
                onClick={() => navigate("/admin/teams/define")}
              >
                {/* Glow effect */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-500/10 blur-[40px] rounded-full group-hover:bg-pink-500/20 transition-colors duration-500" />

                <div className="relative z-10 p-3 rounded-xl bg-pink-500/20 text-pink-400 group-hover:bg-pink-500 group-hover:text-white transition-colors">
                  <Users className="h-6 w-6" />
                </div>
                <div className="relative z-10 flex-1">
                  <h2 className="text-lg font-bold text-white">
                    Definir Times
                  </h2>
                  <p className="text-sm text-gray-400">
                    Crie novos times para uma rodada
                  </p>
                </div>
              </article>

              <article
                className="relative overflow-hidden bg-[#1c1c1e] rounded-2xl p-4 flex items-center gap-4 border border-white/5 shadow-lg group transition-transform duration-300 hover:-translate-y-1 cursor-pointer"
                onClick={() => navigate("/admin/teams/manage")}
              >
                {/* Glow effect */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-500/10 blur-[40px] rounded-full group-hover:bg-pink-500/20 transition-colors duration-500" />

                <div className="relative z-10 p-3 rounded-xl bg-pink-500/20 text-pink-400 group-hover:bg-pink-500 group-hover:text-white transition-colors">
                  <Settings className="h-6 w-6" />
                </div>
                <div className="relative z-10 flex-1">
                  <h2 className="text-lg font-bold text-white">
                    Gerenciar Times
                  </h2>
                  <p className="text-sm text-gray-400">
                    Edite ou exclua times existentes
                  </p>
                </div>
              </article>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
