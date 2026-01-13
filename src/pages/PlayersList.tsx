import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Users } from "lucide-react";

/**
 * Placeholder page for players list (for non-player/observer users)
 * This page will be configured in the future to show player data
 */
export default function PlayersList() {
    return (
        <div className="min-h-screen bg-[#0e0e10] text-white font-sans flex flex-col">
            <Header />

            <main className="flex-1 container mx-auto px-4 py-8">
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-20 h-20 rounded-full bg-pink-500/20 flex items-center justify-center mb-6">
                        <Users className="w-10 h-10 text-pink-400" />
                    </div>

                    <h1 className="text-[22px] font-bold text-white tracking-tight mb-2">
                        Lista de Jogadores
                    </h1>

                    <p className="text-gray-400 max-w-md">
                        Esta página será configurada em breve para exibir informações dos jogadores do Cozidos FC.
                    </p>
                </div>
            </main>

            <Footer />
        </div>
    );
}
