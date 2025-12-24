import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Loader2, KeyRound, X } from "lucide-react";
import { toast } from "sonner";

export function GlobalPendingBanner() {
    const { isPending, profileData, refreshAuth } = useAuth();
    const [token, setToken] = useState("");
    const [loading, setLoading] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    // Don't render if not pending or dismissed
    if (!isPending || dismissed) {
        return null;
    }

    const handleClaimToken = async () => {
        if (!token.trim()) {
            toast.error("Digite um código válido");
            return;
        }

        setLoading(true);
        try {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData?.user) throw new Error("Usuário não autenticado");

            const { data, error } = await supabase.rpc("claim_profile_with_token", {
                p_token: token.trim(),
                p_user_id: userData.user.id,
            });

            if (error) throw error;

            const result = data as { success: boolean; message?: string; error?: string };

            if (result.success) {
                toast.success(result.message || "Perfil vinculado com sucesso!");
                // Reload to update auth state
                await refreshAuth();
                window.location.reload();
            } else {
                toast.error(result.error || "Código inválido ou já utilizado");
            }
        } catch (error: any) {
            toast.error(error.message || "Erro ao processar código");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gradient-to-r from-amber-500/90 to-orange-500/90 text-white px-4 py-3 shadow-lg sticky top-0 z-50">
            <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Message */}
                <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <span className="font-medium">
                        Seu cadastro está pendente de aprovação.
                    </span>
                    <span className="hidden sm:inline text-white/80">
                        Insira o código de ativação ou aguarde aprovação do admin.
                    </span>
                </div>

                {/* Token Input */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-initial">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
                        <Input
                            type="text"
                            placeholder="Código de ativação"
                            value={token}
                            onChange={(e) => setToken(e.target.value.toUpperCase())}
                            className="pl-9 h-9 w-full sm:w-40 bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30"
                            disabled={loading}
                            onKeyDown={(e) => e.key === "Enter" && handleClaimToken()}
                        />
                    </div>
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleClaimToken}
                        disabled={loading || !token.trim()}
                        className="h-9 bg-white text-orange-600 hover:bg-white/90"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            "Ativar"
                        )}
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDismissed(true)}
                        className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/20"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
