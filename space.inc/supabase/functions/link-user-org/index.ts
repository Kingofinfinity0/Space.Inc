// link-user-org/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { corsHeaders, getAuthContext } from 'shared/auth.ts'

/**
 * link-user-org - GROUND ZERO RESET
 * Privileged administrative function to link users to organizations.
 * Strictly follows the Standardized Guide.
 */

serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Extract Auth Context (Identity & RLS Client)
    // Note: We use getAuthContext to ensure only authenticated users can call this (usually an admin)
    const { userId: requesterId, supabase } = await getAuthContext(req);

    // 3. Resolve Profile Context for requester
    const { data: requesterProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', requesterId)
      .single()

    // Security: Only staff/admin/owner can call this
    if (!requesterProfile || requesterProfile.role === 'client') {
      throw new Error('Unauthorized: Only staff can link users')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const { userId, email, organizationId } = body

    if (!userId || !email) {
      throw new Error('Missing required fields (userId, email)')
    }

    // 4. Route Logic
    // Check if user already has a profile
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (existingProfile) {
      return new Response(JSON.stringify({ message: 'User already linked to organization' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let orgIdToLink = organizationId

    // If organizationId provided, link user to it
    if (orgIdToLink) {
      const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('id', orgIdToLink)
        .single()

      if (orgError || !org) throw new Error('Organization not found')
    } else {
      // Auto-create organization based on email domain
      const emailDomain = email.split('@')[1]

      const { data: existingOrg } = await supabaseAdmin
        .from('organizations')
        .select('*')
        .or(`metadata->>'domain'.eq.${emailDomain},name.eq.${emailDomain}`)
        .single()

      orgIdToLink = existingOrg?.id

      if (!orgIdToLink) {
        const { data: newOrg, error: createOrgError } = await supabaseAdmin
          .from('organizations')
          .insert({
            name: emailDomain,
            metadata: { domain: emailDomain, auto_created: true }
          })
          .select('id')
          .single()

        if (createOrgError) throw createOrgError
        orgIdToLink = newOrg.id
      }
    }

    // Check if this is first user in organization
    const { count } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgIdToLink)

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        organization_id: orgIdToLink,
        email: email,
        role: (count === 0) ? 'owner' : 'staff'
      })

    if (profileError) throw profileError

    return new Response(JSON.stringify({
      message: 'User linked to organization successfully',
      organizationId: orgIdToLink,
      role: (count === 0) ? 'owner' : 'staff'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('[link-user-org] Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.status || 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
