-- Criar bucket público para avatares de jogadores
INSERT INTO storage.buckets (id, name, public)
VALUES ('player-avatars', 'player-avatars', true);

-- Política RLS: Qualquer pessoa pode VER avatares (público)
CREATE POLICY "Public Access to view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'player-avatars');

-- Política RLS: Apenas admins podem FAZER UPLOAD
CREATE POLICY "Admin can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'player-avatars' 
  AND public.is_admin(auth.uid())
);

-- Política RLS: Apenas admins podem DELETAR avatares
CREATE POLICY "Admin can delete avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'player-avatars'
  AND public.is_admin(auth.uid())
);

-- Política RLS: Apenas admins podem ATUALIZAR avatares
CREATE POLICY "Admin can update avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'player-avatars'
  AND public.is_admin(auth.uid())
);

-- Adicionar coluna avatar_url na tabela profiles
ALTER TABLE public.profiles
ADD COLUMN avatar_url TEXT;

-- Comentário explicativo
COMMENT ON COLUMN public.profiles.avatar_url IS 'URL pública da foto de perfil do jogador armazenada no Storage';