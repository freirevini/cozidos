import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Upload, Trash2, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

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
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [showCropDialog, setShowCropDialog] = useState(false);

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area
  ): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("No 2d context");
    }

    // Set canvas size to crop size
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // Draw the cropped image
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }
        resolve(blob);
      }, "image/png");
    });
  };

  /* import removeBackground from "@imgly/background-removal"; needs to be at top, I will assume it's added or I will add it via separate edit or just trust the imports block works if I include it in the text. Wait, replace_file_content works on chunks. I should update imports first or include them. I will replace the imports and handleFileSelect. */

  /* THIS TOOL CALL IS ONLY FOR handleFileSelect logic replacement. */

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tamanho (max 5MB agora, pois processamos locally)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande! Máximo 5MB");
      event.target.value = "";
      return;
    }

    // Validar tipo
    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são permitidas");
      event.target.value = "";
      return;
    }

    try {
      setUploading(true);
      toast.info("Removendo fundo da imagem com IA... Aguarde.", { duration: 5000 });

      // Dynamic import to avoid SSR issues if any, although this is SPA.
      // Better to import at top, but for this chunk logic:
      const { removeBackground } = await import("@imgly/background-removal");

      const blob = await removeBackground(file, {
        progress: (key, current, total) => {
          // console.log(`Downloading ${key}: ${current} of ${total}`);
        }
      });

      const url = URL.createObjectURL(blob);
      setImageSrc(url);
      setShowCropDialog(true);
      toast.success("Fundo removido! Ajuste o corte agora.");

    } catch (error) {
      console.error("Erro ao remover fundo:", error);
      toast.error("Erro ao processar imagem. Tente outra foto.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleCropConfirm = async () => {
    try {
      if (!imageSrc || !croppedAreaPixels) return;

      setUploading(true);
      setShowCropDialog(false);

      // Gerar imagem cortada
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);

      // Gerar nome único
      const fileName = `${playerId}-${Date.now()}.jpg`;
      const filePath = `${fileName}`;

      // Upload para Storage
      const { error: uploadError } = await supabase.storage
        .from("player-avatars")
        .upload(filePath, croppedBlob, {
          cacheControl: "3600",
          upsert: true,
          contentType: "image/png",
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

      // Limpar estados
      setImageSrc(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);

    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao fazer upload da foto");
    } finally {
      setUploading(false);
    }
  };

  const handleCropCancel = () => {
    setShowCropDialog(false);
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
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
          disabled={uploading || showCropDialog}
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
        onChange={handleFileSelect}
      />

      <p className="text-xs text-muted-foreground text-center">
        Dica: Para estilo <b>Card de Jogador</b>, use uma foto de meio corpo.<br />
        O fundo será removido automaticamente.
      </p>

      {/* Dialog de Crop */}
      <Dialog open={showCropDialog} onOpenChange={handleCropCancel}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Posicionar Foto</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Área de Crop Circular */}
            <div className="relative w-full h-[400px] bg-muted rounded-lg overflow-hidden">
              {imageSrc && (
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              )}
            </div>

            {/* Controle de Zoom */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1">
                  <ZoomOut className="h-4 w-4" />
                  Zoom
                </span>
                <ZoomIn className="h-4 w-4" />
              </div>
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.1}
                onValueChange={(value) => setZoom(value[0])}
                className="w-full"
              />
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Arraste a imagem para posicionar e use o controle para ajustar o zoom
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCropCancel}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCropConfirm}
              disabled={uploading || !croppedAreaPixels}
              className="bg-primary hover:bg-primary/90"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                "Confirmar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
