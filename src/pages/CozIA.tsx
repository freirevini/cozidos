import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Sparkles } from "lucide-react";

/**
 * CozIA - Placeholder page for AI features
 * This page will be configured in the future to provide AI-powered insights
 */
export default function CozIA() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />

            <main className="flex-1 container mx-auto px-4 py-8">
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 animate-pulse">
                        <Sparkles className="w-10 h-10 text-primary" />
                    </div>

                    <h1 className="text-2xl font-bold text-foreground mb-2">
                        CozIA
                    </h1>

                    <p className="text-muted-foreground max-w-md mb-4">
                        Análise de desempenho através de Inteligência Artificial.
                    </p>

                    <div className="px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
                        Em breve
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
