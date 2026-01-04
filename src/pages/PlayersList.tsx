import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Users } from "lucide-react";

/**
 * Placeholder page for players list (for non-player/observer users)
 * This page will be configured in the future to show player data
 */
export default function PlayersList() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />

            <main className="flex-1 container mx-auto px-4 py-8">
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                        <Users className="w-10 h-10 text-primary" />
                    </div>

                    <h1 className="text-2xl font-bold text-foreground mb-2">
                        Lista de Jogadores
                    </h1>

                    <p className="text-muted-foreground max-w-md">
                        Esta página será configurada em breve para exibir informações dos jogadores do Cozidos FC.
                    </p>
                </div>
            </main>

            <Footer />
        </div>
    );
}
