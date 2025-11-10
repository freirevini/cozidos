import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { auth_user_id, email, birth_date, first_name, last_name, position } = await req.json()

    // Validar dados
    if (!auth_user_id || !email || !birth_date) {
      throw new Error('Dados incompletos: auth_user_id, email e birth_date são obrigatórios')
    }

    console.log('[link-player] Recebido:', { auth_user_id, email, birth_date, first_name, last_name, position })

    // Gerar player_id (SHA256 de email + birthdate)
    const raw = `${email.toLowerCase().trim()}|${birth_date}`
    const encoder = new TextEncoder()
    const data = encoder.encode(raw)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const player_id = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // Buscar por perfil existente com mesmo player_id
    const { data: existingProfile, error: searchError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('player_id', player_id)
      .maybeSingle()

    if (searchError) {
      console.error('Erro ao buscar perfil existente:', searchError)
    }

    if (existingProfile) {
      console.log('[link-player] Perfil existente encontrado:', existingProfile.id)
      
      // Vincular usuário ao perfil existente (matching determinístico)
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          user_id: auth_user_id,
          status: 'aprovado',  // Auto-aprovar vinculação
          email,
          first_name: first_name || existingProfile.first_name,
          last_name: last_name || existingProfile.last_name,
        })
        .eq('id', existingProfile.id)

      if (updateError) {
        console.error('[link-player] Erro ao vincular:', updateError)
        throw updateError
      }

      return new Response(
        JSON.stringify({
          ok: true,
          player_id,
          linked: true,
          created: false,
          message: `Seu cadastro foi vinculado ao perfil existente: ${existingProfile.nickname || existingProfile.name}. Você já pode acessar seu histórico!`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      console.log('[link-player] Criando novo perfil de jogador')
      
      // Criar novo perfil
      const fullName = `${first_name || ''} ${last_name || ''}`.trim() || 'Jogador'
      
      const { error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          player_id,
          user_id: auth_user_id,
          email,
          name: fullName,
          first_name: first_name || 'Jogador',
          last_name: last_name || '',
          nickname: first_name || 'Jogador',
          birth_date,
          position,
          is_player: true,
          status: 'pendente',
        })

      if (insertError) {
        console.error('[link-player] Erro ao criar perfil:', insertError)
        throw insertError
      }
      
      console.log('[link-player] Novo perfil criado com sucesso')

      return new Response(
        JSON.stringify({
          ok: true,
          player_id,
          linked: false,
          created: true,
          message: 'Cadastro realizado com sucesso! Aguarde aprovação do administrador para ser escalado em times.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('Erro na função link-player:', error)
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
