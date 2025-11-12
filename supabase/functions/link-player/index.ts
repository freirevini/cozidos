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

    // Validar dados obrigatórios
    if (!auth_user_id || !email || !birth_date) {
      throw new Error('Dados incompletos: auth_user_id, email e birth_date são obrigatórios')
    }

    console.log('[link-player] Recebido:', { auth_user_id, email, birth_date, first_name, last_name, position })

    // Gerar player_id determinístico (ddMMyyyy + email sanitizado)
    // Exemplo: 02/10/1992 + vinicius@hotmail.com = 02101992viniciushotmailcom
    const normalizedEmail = email.toLowerCase().trim()
    const sanitizedEmail = normalizedEmail.replace(/[^a-z0-9]/g, '')
    
    // birth_date vem como YYYY-MM-DD do frontend
    const [yyyy, mm, dd] = birth_date.split('-')
    const player_id = `${dd}${mm}${yyyy}${sanitizedEmail}`

    console.log('[link-player] player_id gerado:', player_id, `(de ${birth_date} + ${normalizedEmail})`)

    // Buscar perfil PRÉ-EXISTENTE (criado pelo admin) com mesmo player_id
    const { data: existingProfile, error: searchError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('player_id', player_id)
      .is('user_id', null) // Apenas perfis SEM user_id (criados por admin)
      .maybeSingle()

    if (searchError) {
      console.error('[link-player] Erro ao buscar perfil existente:', searchError)
    }

    // Buscar perfil TEMPORÁRIO criado pelo trigger handle_new_user
    let { data: tempProfile, error: tempError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', auth_user_id)
      .maybeSingle() // Removido filtro player_id IS NULL

    if (tempError) {
      console.error('[link-player] Erro ao buscar perfil temporário:', tempError)
    }

    // Fallback: buscar por email se não encontrou por user_id
    if (!tempProfile) {
      console.log('[link-player] Perfil temporário não encontrado por user_id. Tentando por email...')
      const { data: byEmail } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('email', normalizedEmail)
        .eq('user_id', auth_user_id)
        .maybeSingle()
      
      if (byEmail) {
        console.log('[link-player] Perfil encontrado por email:', byEmail.id)
        tempProfile = byEmail
      }
    }

    if (existingProfile) {
      console.log('[link-player] ✅ MATCH ENCONTRADO! Perfil pré-existente:', existingProfile.id)
      
      // Vincular user_id ao perfil pré-existente
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
        console.error('[link-player] Erro ao vincular perfil existente:', updateError)
        throw updateError
      }

      // CLEANUP: Deletar perfil temporário criado pelo trigger
      if (tempProfile) {
        console.log('[link-player] 🗑️ Deletando perfil temporário:', tempProfile.id)
        const { error: deleteError } = await supabaseAdmin
          .from('profiles')
          .delete()
          .eq('id', tempProfile.id)

        if (deleteError) {
          console.error('[link-player] Erro ao deletar perfil temporário:', deleteError)
          // Não bloqueia o fluxo - só loga
        }
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
      console.log('[link-player] ❌ Nenhum perfil pré-existente encontrado. Atualizando perfil temporário.')
      
      if (tempProfile) {
        // Atualizar perfil temporário com player_id e dados completos
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            player_id,
            position,
            status: 'pendente', // Aguarda aprovação do admin
          })
          .eq('id', tempProfile.id)

        if (updateError) {
          console.error('[link-player] Erro ao atualizar perfil temporário:', updateError)
          throw updateError
        }

        console.log('[link-player] ✅ Perfil temporário atualizado com player_id')

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
      } else {
        // Fallback: criar perfil do zero (caso trigger tenha falhado)
        console.log('[link-player] ⚠️ Perfil temporário não encontrado. Criando do zero.')
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
    }

  } catch (error: unknown) {
    // Extrair detalhes completos do erro
    const err = (error && typeof error === 'object') ? (error as any) : null
    const errorMessage = err?.message || err?.details || err?.hint || JSON.stringify(err) || 'Erro desconhecido'
    
    console.error('[link-player] ❌ ERRO GERAL:', error)
    console.error('[link-player] Detalhes:', { message: err?.message, details: err?.details, hint: err?.hint, code: err?.code })
    
    // Retornar 200 com ok: false para evitar Runtime Error na UI
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
