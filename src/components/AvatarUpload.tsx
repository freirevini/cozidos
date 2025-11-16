import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AvatarUploadProps {
  playerId: string;
  playerName: string;
  currentAvatarUrl: string | null;
  onUploadComplete: (url: string | null) => void;
}

export function AvatarUpload({ 
  playerId, 
  playerName, 
  currentAvatarUrl, 
  onUploadComplete 
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      
      const file = event.target.files?.[0];
      if (!file) return;
      
      // Validar tamanho (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Imagem muito grande! Máximo 2MB");
        return;
      }
      
      // Validar tipo
      if (!file.type.startsWith("image/")) {
        toast.error("Apenas imagens são permitidas");
        return;
      }
      
      // Gerar nome único
      const fileExt = file.name.split(".").pop();
      const fileName = `${playerId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;
      
      // Upload para Storage
      const { error: uploadError } = await supabase.storage
        .from("player-avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });
      
      if (uploadError) throw uploadError;
      
      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from("player-avatars")
        .getPublicUrl(filePath);
      
      // Atualizar perfil no banco
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", playerId);
      
      if (updateError) throw updateError;
      
      onUploadComplete(publicUrl);
      toast.success("Foto atualizada com sucesso!");
      
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao fazer upload da foto");
    } finally {
      setUploading(false);
      // Limpar input
      event.target.value = "";
    }
  };

  const handleRemove = async () => {
    try {
      setRemoving(true);
      
      if (!currentAvatarUrl) return;
      
      // Extrair nome do arquivo da URL
      const fileName = currentAvatarUrl.split("/").pop();
      if (!fileName) return;
      
      // Deletar do Storage
      const { error: deleteError } = await supabase.storage
        .from("player-avatars")
        .remove([fileName]);
      
      if (deleteError) throw deleteError;
      
      // Remover do perfil
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", playerId);
      
      if (updateError) throw updateError;
      
      onUploadComplete(null);
      toast.success("Foto removida com sucesso!");
      
    } catch (error) {
      console.error("Erro ao remover foto:", error);
      toast.error("Erro ao remover foto");
    } finally {
      setRemoving(false);
    }
  };
  
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Avatar Preview */}
      <Avatar className="h-24 w-24">
        {currentAvatarUrl ? (
          <AvatarImage src={currentAvatarUrl} alt={playerName} className="object-cover" />
        ) : (
          <AvatarFallback className="text-xl">
            {playerName.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        )}
      </Avatar>
      
      {/* Botões de ação */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => document.getElementById(`file-${playerId}`)?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          Upload Foto
        </Button>
        
        {currentAvatarUrl && (
          <Button
            variant="destructive"
            size="sm"
            disabled={removing}
            onClick={handleRemove}
          >
            {removing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
      
      <input
        id={`file-${playerId}`}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={handleUpload}
      />
      
      <p className="text-xs text-muted-foreground text-center">
        Formatos: JPG, PNG, WEBP<br />
        Tamanho máximo: 2MB
      </p>
    </div>
  );
}
