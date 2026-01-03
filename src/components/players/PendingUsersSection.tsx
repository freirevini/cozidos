import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserPlus, Link2, X, Loader2, Clock, RefreshCw, Eye } from "lucide-react";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/errorHandler";

interface PendingUser {
    id: string;
    user_id: string;
    nickname: string | null;
    name: string | null;
    email: string | null;
    created_at: string;
}

interface OrphanProfile {
    id: string;
    nickname: string | null;
    name: string | null;
    email: string | null;
    level: string | null;
    position: string | null;
}

export function PendingUsersSection({ onUserProcessed }: { onUserProcessed?: () => void }) {
    const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
    const [orphanProfiles, setOrphanProfiles] = useState<OrphanProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [userToReject, setUserToReject] = useState<PendingUser | null>(null);
    const [linkDialogOpen, setLinkDialogOpen] = useState(false);
    const [userToLink, setUserToLink] = useState<PendingUser | null>(null);
    const [selectedOrphanId, setSelectedOrphanId] = useState<string>("");

    const loadData = async () => {
        setLoading(true);
        try {
            // Load pending users
            const { data: pending, error: pendingError } = await supabase
                .from("profiles")
                .select("id, user_id, nickname, name, email, created_at")
                .eq("status", "pendente")
                .not("user_id", "is", null)
                .order("created_at", { ascending: false });

            if (pendingError) throw pendingError;
            setPendingUsers(pending || []);

            // Load orphan profiles (for linking) - profiles without user_id
            const { data: orphans, error: orphansError } = await supabase
                .from("profiles")
                .select("id, nickname, name, email, level, position")
                .is("user_id", null)
                .eq("status", "aprovado")
                .order("nickname", { ascending: true });

            if (orphansError) throw orphansError;
            setOrphanProfiles(orphans || []);
        } catch (error: any) {
            toast.error(getUserFriendlyError(error));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleApproveNew = async (user: PendingUser) => {
        setProcessingId(user.id);
        try {
            // Approve by updating profile status directly
            const { error } = await supabase
                .from("profiles")
                .update({ status: "aprovado", is_approved: true })
                .eq("id", user.id);

            if (error) throw error;

            toast.success(`${user.nickname || user.name || "Usuário"} aprovado como novo jogador!`);
            await loadData();
            onUserProcessed?.();
        } catch (error: any) {
            toast.error(getUserFriendlyError(error));
        } finally {
            setProcessingId(null);
        }
    };

    const handleApproveObserver = async (user: PendingUser) => {
        setProcessingId(user.id);
        try {
            const { data, error } = await supabase.rpc("admin_approve_observer", {
                p_profile_id: user.id,
            });

            if (error) throw error;

            const result = data as { success: boolean; message?: string; error?: string };
            if (!result.success) throw new Error(result.error || "Erro ao aprovar");

            toast.success(`${user.nickname || user.name || "Usuário"} aprovado como observador!`);
            await loadData();
            onUserProcessed?.();
        } catch (error: any) {
            toast.error(getUserFriendlyError(error));
        } finally {
            setProcessingId(null);
        }
    };

    const handleLinkExisting = async () => {
        if (!userToLink || !selectedOrphanId) return;

        setProcessingId(userToLink.id);
        try {
            // Link pending user to existing orphan profile using existing RPC
            const { data, error } = await supabase.rpc("admin_link_pending_to_profile", {
                p_admin_user_id: userToLink.user_id, // Using the pending user's user_id
                p_pending_profile_id: userToLink.id,
                p_target_profile_id: selectedOrphanId,
            });

            if (error) throw error;

            const result = data as { success: boolean; message?: string; error?: string };
            if (!result.success) throw new Error(result.error || "Erro ao vincular");

            toast.success(`Usuário vinculado ao jogador existente!`);
            setLinkDialogOpen(false);
            setUserToLink(null);
            setSelectedOrphanId("");
            await loadData();
            onUserProcessed?.();
        } catch (error: any) {
            toast.error(getUserFriendlyError(error));
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async () => {
        if (!userToReject) return;

        setProcessingId(userToReject.id);
        try {
            // Update profile status to rejected
            const { error: updateError } = await supabase
                .from("profiles")
                .update({ status: "rejeitado", is_approved: false })
                .eq("id", userToReject.id);

            if (updateError) throw updateError;

            // Try to delete auth user via Edge Function
            try {
                await supabase.functions.invoke("delete-auth-user", {
                    body: { user_id: userToReject.user_id },
                });
            } catch (authError) {
                console.warn("Erro ao deletar usuário auth:", authError);
            }

            toast.success("Usuário recusado e removido do sistema");
            setRejectDialogOpen(false);
            setUserToReject(null);
            await loadData();
            onUserProcessed?.();
        } catch (error: any) {
            toast.error(getUserFriendlyError(error));
        } finally {
            setProcessingId(null);
        }
    };

    const getInitials = (user: PendingUser) => {
        const name = user.nickname || user.name || "U";
        return name.substring(0, 2).toUpperCase();
    };

    if (loading) {
        return (
            <Card className="mb-6">
                <CardHeader className="py-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Clock className="h-5 w-5 text-amber-500" />
                        Solicitações Pendentes
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    if (pendingUsers.length === 0) {
        return null; // Don't show section if no pending users
    }

    return (
        <>
            <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
                <CardHeader className="py-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Clock className="h-5 w-5 text-amber-500" />
                            Solicitações Pendentes
                            <Badge variant="secondary" className="ml-2">{pendingUsers.length}</Badge>
                        </CardTitle>
                        <Button variant="ghost" size="icon" onClick={loadData}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {pendingUsers.map((user) => (
                        <div
                            key={user.id}
                            className="flex items-center gap-3 p-3 rounded-lg bg-background border"
                        >
                            <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-amber-500/20 text-amber-700">
                                    {getInitials(user)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                    {user.nickname || user.name || "Sem nome"}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                    {user.email}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    onClick={() => handleApproveNew(user)}
                                    disabled={processingId === user.id}
                                    className="h-8"
                                >
                                    {processingId === user.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <UserPlus className="h-4 w-4 mr-1" />
                                            Novo
                                        </>
                                    )}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleApproveObserver(user)}
                                    disabled={processingId === user.id}
                                    className="h-8"
                                    title="Aprovar como observador (não-jogador)"
                                >
                                    {processingId === user.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Eye className="h-4 w-4 mr-1" />
                                            Obs
                                        </>
                                    )}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setUserToLink(user);
                                        setLinkDialogOpen(true);
                                    }}
                                    disabled={processingId === user.id || orphanProfiles.length === 0}
                                    className="h-8"
                                >
                                    <Link2 className="h-4 w-4 mr-1" />
                                    Vincular
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                        setUserToReject(user);
                                        setRejectDialogOpen(true);
                                    }}
                                    disabled={processingId === user.id}
                                    className="h-8 text-destructive hover:text-destructive"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Link Dialog */}
            <AlertDialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Vincular a Jogador Existente</AlertDialogTitle>
                        <AlertDialogDescription>
                            Vincular <strong>{userToLink?.nickname || userToLink?.name}</strong> a um jogador existente.
                            O usuário herdará todo o histórico do jogador selecionado.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <Select value={selectedOrphanId} onValueChange={setSelectedOrphanId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione um jogador..." />
                            </SelectTrigger>
                            <SelectContent>
                                {orphanProfiles.map((orphan) => (
                                    <SelectItem key={orphan.id} value={orphan.id}>
                                        {orphan.nickname || orphan.name} {orphan.level && `(${orphan.level})`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setSelectedOrphanId("")}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleLinkExisting}
                            disabled={!selectedOrphanId || processingId === userToLink?.id}
                        >
                            {processingId === userToLink?.id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Vincular
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Reject Confirmation Dialog */}
            <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">Recusar Usuário</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja recusar <strong>{userToReject?.nickname || userToReject?.name || userToReject?.email}</strong>?
                            <br /><br />
                            Esta ação removerá completamente o usuário do sistema (conta e perfil).
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleReject}
                            className="bg-destructive hover:bg-destructive/90"
                            disabled={processingId === userToReject?.id}
                        >
                            {processingId === userToReject?.id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Recusar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
