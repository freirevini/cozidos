import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Trash2,
  Save,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  Camera
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
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
import type { Player } from "./PlayerCompactCard";

interface PlayerEditDialogProps {
  player: Player | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (player: Player) => Promise<void>;
  onDelete: (player: Player) => void;
  onAvatarEdit?: (player: Player) => void;
}

interface FormErrors {
  nickname?: string;
  email?: string;
  birth_date?: string;
}

export function PlayerEditDialog({
  player,
  open,
  onOpenChange,
  onSave,
  onDelete,
  onAvatarEdit,
}: PlayerEditDialogProps) {
  const [formData, setFormData] = useState<Partial<Player>>({});
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [originalStatus, setOriginalStatus] = useState<string>("");

  useEffect(() => {
    if (player) {
      setFormData({
        nickname: player.nickname || "",
        email: player.email || "",
        birth_date: player.birth_date || "",
        level: player.level || "",
        position: player.position || "",
        status: player.status || "pendente",
      });
      setOriginalStatus(player.status || "pendente");
      setErrors({});
    }
  }, [player]);

  const displayName = player?.nickname || player?.first_name || player?.name || "Jogador";
  const initials = displayName
    .split(" ")
    .map(n => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Calculate age from birth_date
  const calculatedAge = useMemo(() => {
    const dateStr = formData.birth_date;
    if (!dateStr) return null;

    try {
      const birthDate = new Date(formatDateForInput(dateStr));
      if (isNaN(birthDate.getTime())) return null;

      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      return age > 0 && age < 120 ? age : null;
    } catch {
      return null;
    }
  }, [formData.birth_date]);

  // Validate email format
  const validateEmail = (email: string): boolean => {
    if (!email) return true; // Optional field
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validate birth date (no future dates)
  const validateBirthDate = (dateStr: string): boolean => {
    if (!dateStr) return true;
    const date = new Date(formatDateForInput(dateStr));
    return date <= new Date();
  };

  const formatDateForInput = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "";
    if (dateStr.includes("-")) return dateStr;
    const [day, month, year] = dateStr.split("/");
    return `${year}-${month}-${day}`;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.nickname?.trim()) {
      newErrors.nickname = "Apelido é obrigatório";
    }

    if (formData.email && !validateEmail(formData.email)) {
      newErrors.email = "E-mail inválido";
    }

    if (formData.birth_date && !validateBirthDate(formData.birth_date)) {
      newErrors.birth_date = "Data não pode ser no futuro";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!player || !validateForm()) return;

    setSaving(true);
    try {
      await onSave({ ...player, ...formData } as Player);

      toast({
        title: "Alterações salvas",
        description: "Os dados do jogador foram atualizados com sucesso.",
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Não foi possível salvar as alterações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!player) return;

    setDeleting(true);
    try {
      onDelete(player);
      setShowDeleteConfirm(false);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: error instanceof Error ? error.message : "Não foi possível excluir o jogador.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  // Check if status changed to "aprovado"
  const statusChangedToApproved = originalStatus !== "aprovado" && formData.status === "aprovado";

  // Check if email was changed (important for linking)
  const emailChanged = player?.email !== formData.email && player?.email;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
          {/* Fixed Header */}
          <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-10 w-10 shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold flex-1">Editar Jogador</h2>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Avatar className="h-20 w-20 border-3 border-primary/30 bg-muted">
                  <AvatarImage src={player?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {onAvatarEdit && (
                  <button
                    onClick={() => player && onAvatarEdit(player)}
                    className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">{player?.first_name} {player?.last_name}</p>
                {player?.email && (
                  <p className="text-xs text-muted-foreground mt-1">{player.email}</p>
                )}
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Apelido - Required */}
              <div className="space-y-2">
                <Label htmlFor="edit-nickname" className="text-sm font-medium text-primary">
                  Apelido / Nome de exibição *
                </Label>
                <Input
                  id="edit-nickname"
                  value={formData.nickname || ""}
                  onChange={(e) => {
                    setFormData({ ...formData, nickname: e.target.value });
                    if (errors.nickname) setErrors({ ...errors, nickname: undefined });
                  }}
                  placeholder="Como será chamado"
                  className={`h-12 text-base rounded-lg ${errors.nickname ? 'border-destructive' : ''}`}
                />
                {errors.nickname && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.nickname}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="edit-email" className="text-sm font-medium text-primary">
                  E-mail
                </Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  placeholder="email@exemplo.com"
                  className={`h-12 text-base rounded-lg ${errors.email ? 'border-destructive' : ''}`}
                />
                {errors.email && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.email}
                  </p>
                )}
                {emailChanged && (
                  <p className="text-xs text-yellow-500 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Alterar o e-mail pode afetar a vinculação da conta do jogador
                  </p>
                )}
              </div>

              {/* Data de Nascimento */}
              <div className="space-y-2">
                <Label htmlFor="edit-birth" className="text-sm font-medium text-primary">
                  Data de Nascimento
                </Label>
                <Input
                  id="edit-birth"
                  type="date"
                  value={formatDateForInput(formData.birth_date)}
                  onChange={(e) => {
                    setFormData({ ...formData, birth_date: e.target.value });
                    if (errors.birth_date) setErrors({ ...errors, birth_date: undefined });
                  }}
                  max={new Date().toISOString().split('T')[0]}
                  className={`h-12 text-base rounded-lg ${errors.birth_date ? 'border-destructive' : ''}`}
                />
                {calculatedAge !== null && (
                  <p className="text-xs text-muted-foreground">
                    {calculatedAge} anos
                  </p>
                )}
                {errors.birth_date && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.birth_date}
                  </p>
                )}
              </div>

              {/* Nível */}
              <div className="space-y-2">
                <Label htmlFor="edit-level" className="text-sm font-medium text-primary">
                  Nível
                </Label>
                <Select
                  value={formData.level || ""}
                  onValueChange={(value) => setFormData({ ...formData, level: value })}
                >
                  <SelectTrigger id="edit-level" className="h-12 text-base rounded-lg">
                    <SelectValue placeholder="Selecione o nível" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A - Elite</SelectItem>
                    <SelectItem value="B">B - Avançado</SelectItem>
                    <SelectItem value="C">C - Intermediário</SelectItem>
                    <SelectItem value="D">D - Iniciante</SelectItem>
                    <SelectItem value="E">E - Básico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Posição */}
              <div className="space-y-2">
                <Label htmlFor="edit-position" className="text-sm font-medium text-primary">
                  Posição
                </Label>
                <Select
                  value={formData.position || ""}
                  onValueChange={(value) => setFormData({ ...formData, position: value })}
                >
                  <SelectTrigger id="edit-position" className="h-12 text-base rounded-lg">
                    <SelectValue placeholder="Selecione a posição" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="goleiro">🧤 Goleiro</SelectItem>
                    <SelectItem value="defensor">🛡️ Defensor</SelectItem>
                    <SelectItem value="meio-campista">⚡ Meio-Campista</SelectItem>
                    <SelectItem value="atacante">⚽ Atacante</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="edit-status" className="text-sm font-medium text-primary">
                  Status
                </Label>
                <Select
                  value={formData.status || "pendente"}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger id="edit-status" className="h-12 text-base rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">⏳ Pendente</SelectItem>
                    <SelectItem value="aprovado">✅ Aprovado</SelectItem>
                    <SelectItem value="congelado">❄️ Congelado</SelectItem>
                    <SelectItem value="rejeitado">❌ Rejeitado</SelectItem>
                  </SelectContent>
                </Select>
                {statusChangedToApproved && (
                  <p className="text-xs text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Usuário aprovado — ele poderá ser escalado em times
                  </p>
                )}
              </div>

              {/* Token/Player ID info */}
              {player?.claim_token && (
                <div className="p-3 bg-muted/30 rounded-lg space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Token de Vinculação</p>
                  <p className="text-xs font-mono text-foreground break-all">{player.claim_token}</p>
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="sticky bottom-0 bg-background border-t border-border p-4 space-y-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-13 text-base font-semibold rounded-lg"
              size="lg"
            >
              {saving ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  Salvar Alterações
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={saving}
              className="w-full h-11 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive rounded-lg"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Jogador
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Excluir Jogador</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Deseja realmente excluir <span className="font-semibold text-foreground">{displayName}</span>?
              <br /><br />
              <span className="text-destructive/80">Esta ação é irreversível.</span> Todos os dados associados (gols, assistências, estatísticas) serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto h-11" disabled={deleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="w-full sm:w-auto h-11 bg-destructive hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
