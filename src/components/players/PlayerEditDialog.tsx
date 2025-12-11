import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trash2, Save } from "lucide-react";
import type { Player } from "./PlayerCompactCard";

interface PlayerEditDialogProps {
  player: Player | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (player: Player) => Promise<void>;
  onDelete: (player: Player) => void;
}

export function PlayerEditDialog({
  player,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: PlayerEditDialogProps) {
  const [formData, setFormData] = useState<Partial<Player>>({});
  const [saving, setSaving] = useState(false);

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
    }
  }, [player]);

  const handleSave = async () => {
    if (!player) return;
    setSaving(true);
    try {
      await onSave({ ...player, ...formData } as Player);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const displayName = player?.nickname || player?.first_name || player?.name || "Jogador";
  const initials = displayName
    .split(" ")
    .map(n => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const formatDateForInput = (dateStr: string | null | undefined) => {
    if (!dateStr) return "";
    // Se já está no formato yyyy-mm-dd, retorna direto
    if (dateStr.includes("-")) return dateStr;
    // Se está em dd/mm/yyyy, converte
    const [day, month, year] = dateStr.split("/");
    return `${year}-${month}-${day}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2 border-primary/30">
              <AvatarImage src={player?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-xl">Editar Jogador</DialogTitle>
              <DialogDescription className="text-sm">
                {player?.first_name} {player?.last_name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Apelido */}
          <div className="space-y-2">
            <Label htmlFor="edit-nickname">Apelido</Label>
            <Input
              id="edit-nickname"
              value={formData.nickname || ""}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              placeholder="Nome de exibição"
              className="h-11"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="edit-email">E-mail</Label>
            <Input
              id="edit-email"
              type="email"
              value={formData.email || ""}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@exemplo.com"
              className="h-11"
            />
          </div>

          {/* Data de Nascimento */}
          <div className="space-y-2">
            <Label htmlFor="edit-birth">Data de Nascimento</Label>
            <Input
              id="edit-birth"
              type="date"
              value={formatDateForInput(formData.birth_date)}
              onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
              className="h-11"
            />
          </div>

          {/* Nível e Posição em grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-level">Nível</Label>
              <Select
                value={formData.level || ""}
                onValueChange={(value) => setFormData({ ...formData, level: value })}
              >
                <SelectTrigger id="edit-level" className="h-11">
                  <SelectValue placeholder="Nível" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                  <SelectItem value="D">D</SelectItem>
                  <SelectItem value="E">E</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-position">Posição</Label>
              <Select
                value={formData.position || ""}
                onValueChange={(value) => setFormData({ ...formData, position: value })}
              >
                <SelectTrigger id="edit-position" className="h-11">
                  <SelectValue placeholder="Posição" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="goleiro">Goleiro</SelectItem>
                  <SelectItem value="defensor">Defensor</SelectItem>
                  <SelectItem value="meio-campista">Meio-Campista</SelectItem>
                  <SelectItem value="atacante">Atacante</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="edit-status">Status</Label>
            <Select
              value={formData.status || "pendente"}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger id="edit-status" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="congelado">Congelado</SelectItem>
                <SelectItem value="rejeitado">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 pt-4">
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="w-full h-11"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
          <Button
            variant="outline"
            onClick={() => player && onDelete(player)}
            className="w-full h-11 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir Jogador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
