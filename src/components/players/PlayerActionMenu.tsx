import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2, UserCheck, UserX, Link2, Camera, Copy, ExternalLink } from "lucide-react";
import type { Player } from "./PlayerCompactCard";

export interface PlayerActionMenuProps {
  player: Player;
  onEdit: () => void;
  onDelete: () => void;
  onApprove: () => void;
  onReject: () => void;
  onLinkPlayer: () => void;
  onEditAvatar: () => void;
  onCopyToken: (token: string) => void;
  onCopyInviteLink: (token: string) => void;
  onGenerateToken: (playerId: string) => void;
}

export function PlayerActionMenu({
  player,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  onLinkPlayer,
  onEditAvatar,
  onCopyToken,
  onCopyInviteLink,
  onGenerateToken,
}: PlayerActionMenuProps) {
  const isPending = player.status === "pendente";
  const hasUserAccount = !!player.user_id;
  const isAdminCreated = player.created_by_admin_simple && !player.user_id;
  const hasToken = !!player.claim_token;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9 shrink-0 hover:bg-primary/10"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* Ações de aprovação para pendentes com conta */}
        {isPending && hasUserAccount && (
          <>
            <DropdownMenuItem onClick={onApprove} className="text-green-500">
              <UserCheck className="h-4 w-4 mr-2" />
              Aprovar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onLinkPlayer}>
              <Link2 className="h-4 w-4 mr-2" />
              Vincular
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onReject} className="text-red-500">
              <UserX className="h-4 w-4 mr-2" />
              Rejeitar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Ações de token para jogadores criados pelo admin */}
        {isAdminCreated && (
          <>
            {hasToken ? (
              <>
                <DropdownMenuItem onClick={() => onCopyToken(player.claim_token!)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Token
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCopyInviteLink(player.claim_token!)}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Copiar Link
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={() => onGenerateToken(player.id)}>
                <Link2 className="h-4 w-4 mr-2" />
                Gerar Token
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
          </>
        )}

        {/* Ações padrão */}
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEditAvatar}>
          <Camera className="h-4 w-4 mr-2" />
          Alterar Foto
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
