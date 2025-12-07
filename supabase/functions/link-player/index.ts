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

    const { auth_user_id, email, birth_date, first_name, last_name, position, claim_token } = await req.json()

    // Validar dados obrigatórios
    if (!auth_user_id || !email) {
      throw new Error('Dados incompletos: auth_user_id e email são obrigatórios')
    }

    console.log('[link-player] Recebido:', { auth_user_id, email, birth_date, first_name, last_name, position, claim_token })

    const normalizedEmail = email.toLowerCase().trim()

    // 0. Se veio com claim_token, tentar reivindicar via RPC primeiro
    if (claim_token && claim_token.trim()) {
      console.log('[link-player] Tentando claim com token:', claim_token)
      
      const { data: claimResult, error: claimError } = await supabaseAdmin
        .rpc('claim_profile_with_token', {
          p_token: claim_token.trim(),
          p_user_id: auth_user_id
        })

      if (!claimError && claimResult?.success) {
        console.log('[link-player] ✅ Token válido, perfil reivindicado:', claimResult)
        return new Response(
          JSON.stringify({
            ok: true,
            linked: true,
            created: false,
            claimed_via_token: true,
            message: claimResult.message || 'Perfil vinculado com sucesso via token!'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        console.log('[link-player] Token inválido ou erro:', claimError, claimResult)
        // Continua para fluxo normal de matching
      }
    }

    // 1. Usar a função RPC find_matching_profiles para busca heurística completa
    const { data: matchingProfiles, error: matchError } = await supabaseAdmin
      .rpc('find_matching_profiles', {
        p_email: normalizedEmail,
        p_birth_date: birth_date || null,
        p_first_name: first_name || null,
        p_last_name: last_name || null
      })

    if (matchError) {
      console.error('[link-player] Erro ao buscar perfis:', matchError)
    }

    console.log('[link-player] Perfis encontrados:', matchingProfiles?.length || 0, matchingProfiles)

    // 2. Buscar perfil TEMPORÁRIO criado pelo trigger handle_new_user
    let { data: tempProfile, error: tempError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', auth_user_id)
      .maybeSingle()

    if (tempError) {
      console.error('[link-player] Erro ao buscar perfil temporário:', tempError)
    }

    // Gerar player_id determinístico para fallback
    let player_id: string | null = null
    if (birth_date) {
      const sanitizedEmail = normalizedEmail.replace(/[^a-z0-9]/g, '')
      const [yyyy, mm, dd] = birth_date.split('-')
      player_id = `${dd}${mm}${yyyy}${sanitizedEmail}`
      console.log('[link-player] player_id gerado:', player_id)
    }

    // 3. Analisar resultados do matching
    const bestMatch = matchingProfiles && matchingProfiles.length > 0 ? matchingProfiles[0] : null
    
    if (bestMatch && bestMatch.match_score >= 90) {
      // AUTO-LINK: Match >= 90% (player_id exato ou email exato)
      console.log('[link-player] ✅ MATCH ENCONTRADO! Score:', bestMatch.match_score, 'Razão:', bestMatch.match_reason)
      
      // Vincular usando RPC link_player_to_user
      const { data: linkResult, error: linkError } = await supabaseAdmin
        .rpc('link_player_to_user', {
          p_profile_id: bestMatch.profile_id,
          p_user_id: auth_user_id,
          p_actor_id: auth_user_id
        })

      if (linkError) {
        console.error('[link-player] Erro ao vincular via RPC:', linkError)
        throw linkError
      }

      console.log('[link-player] Resultado do link:', linkResult)

      // Registrar no audit_log
      await supabaseAdmin.from('audit_log').insert({
        action: 'player_self_linked',
        actor_id: auth_user_id,
        target_profile_id: bestMatch.profile_id,
        metadata: {
          match_score: bestMatch.match_score,
          match_reason: bestMatch.match_reason,
          email: normalizedEmail,
          birth_date,
          player_id
        }
      })

      // CLEANUP: Deletar perfil temporário se diferente do vinculado
      if (tempProfile && tempProfile.id !== bestMatch.profile_id) {
        console.log('[link-player] 🗑️ Deletando perfil temporário:', tempProfile.id)
        await supabaseAdmin.from('profiles').delete().eq('id', tempProfile.id)
      }

      return new Response(
        JSON.stringify({
          ok: true,
          player_id: bestMatch.player_id || player_id,
          linked: true,
          created: false,
          match_score: bestMatch.match_score,
          message: `Seu cadastro foi vinculado ao perfil existente: ${bestMatch.name}. Você já pode acessar seu histórico!`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (bestMatch && bestMatch.match_score >= 60) {
      // MATCH PARCIAL: 60-89% - Criar perfil pendente mas informar que existe candidato
      console.log('[link-player] ⚠️ MATCH PARCIAL. Score:', bestMatch.match_score, 'Razão:', bestMatch.match_reason)
      
      if (tempProfile) {
        await supabaseAdmin
          .from('profiles')
          .update({
            player_id,
            position,
            status: 'pendente',
            is_approved: false,
            is_player: true
          })
          .eq('id', tempProfile.id)

        // Registrar no audit_log
        await supabaseAdmin.from('audit_log').insert({
          action: 'player_partial_match_pending',
          actor_id: auth_user_id,
          target_profile_id: tempProfile.id,
          metadata: {
            candidate_profile_id: bestMatch.profile_id,
            match_score: bestMatch.match_score,
            match_reason: bestMatch.match_reason,
            email: normalizedEmail,
            birth_date,
            player_id
          }
        })
      }

      return new Response(
        JSON.stringify({
          ok: true,
          player_id,
          linked: false,
          created: true,
          partial_match: {
            profile_id: bestMatch.profile_id,
            name: bestMatch.name,
            score: bestMatch.match_score
          },
          message: 'Cadastro realizado! Encontramos um perfil similar no sistema. O administrador irá verificar e vincular se necessário.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else {
      // SEM MATCH: Criar/atualizar perfil novo como PENDENTE
      console.log('[link-player] ❌ Nenhum match encontrado. Criando perfil pendente.')
      
      if (tempProfile) {
        await supabaseAdmin
          .from('profiles')
          .update({
            player_id,
            position,
            status: 'pendente',
            is_approved: false,
            is_player: true
          })
          .eq('id', tempProfile.id)

        // Registrar no audit_log
        await supabaseAdmin.from('audit_log').insert({
          action: 'player_created_no_match',
          actor_id: auth_user_id,
          target_profile_id: tempProfile.id,
          metadata: {
            email: normalizedEmail,
            birth_date,
            player_id,
            first_name,
            last_name
          }
        })

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
        // Fallback: criar perfil do zero
        console.log('[link-player] ⚠️ Perfil temporário não encontrado. Criando do zero.')
        const fullName = `${first_name || ''} ${last_name || ''}`.trim() || 'Jogador'
        
        const { data: newProfile, error: insertError } = await supabaseAdmin
          .from('profiles')
          .insert({
            player_id,
            user_id: auth_user_id,
            email: normalizedEmail,
            name: fullName,
            first_name: first_name || 'Jogador',
            last_name: last_name || '',
            nickname: first_name || 'Jogador',
            birth_date,
            position,
            is_player: true,
            status: 'pendente',
            is_approved: false
          })
          .select('id')
          .single()

        if (insertError) {
          console.error('[link-player] Erro ao criar perfil:', insertError)
          throw insertError
        }

        // Registrar no audit_log
        await supabaseAdmin.from('audit_log').insert({
          action: 'player_created_fallback',
          actor_id: auth_user_id,
          target_profile_id: newProfile?.id,
          metadata: {
            email: normalizedEmail,
            birth_date,
            player_id,
            first_name,
            last_name,
            reason: 'temp_profile_not_found'
          }
        })

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
    const err = (error && typeof error === 'object') ? (error as any) : null
    const errorMessage = err?.message || err?.details || err?.hint || 'Erro ao processar cadastro'
    
    console.error('[link-player] ❌ ERRO GERAL:', error)
    console.error('[link-player] Detalhes:', { message: err?.message, details: err?.details, hint: err?.hint, code: err?.code })
    
    let statusCode = 500
    let userMessage = 'Erro ao processar cadastro. Tente novamente.'
    
    if (err?.message?.includes('auth') || err?.message?.includes('unauthorized')) {
      statusCode = 401
      userMessage = 'Sessão expirada. Faça login novamente.'
    } else if (err?.message?.includes('duplicate') || err?.message?.includes('already exists')) {
      statusCode = 409
      userMessage = 'Já existe um cadastro com estes dados.'
    } else if (err?.message?.includes('validation') || err?.message?.includes('invalid')) {
      statusCode = 400
      userMessage = 'Dados inválidos. Verifique as informações e tente novamente.'
    }
    
    return new Response(
      JSON.stringify({ ok: false, error: userMessage }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
