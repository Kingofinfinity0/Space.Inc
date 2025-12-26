import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { userId, email, organizationId } = await req.json()

    if (!userId || !email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user already has a profile
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (existingProfile) {
      return new Response(
        JSON.stringify({ message: 'User already linked to organization' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If organizationId provided, link user to it
    if (organizationId) {
      const { error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('id', organizationId)
        .single()

      if (orgError) {
        return new Response(
          JSON.stringify({ error: 'Organization not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          organization_id: organizationId,
          email: email,
          role: 'staff'
        })

      if (profileError) {
        return new Response(
          JSON.stringify({ error: 'Failed to create profile' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ message: 'User linked to organization successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Auto-create organization based on email domain
    const emailDomain = email.split('@')[1]
    
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('*')
      .or(`metadata->>'domain'.eq.${emailDomain},name.eq.${emailDomain}`)
      .single()

    let orgId = existingOrg?.id

    if (!orgId) {
      const { data: newOrg, error: createOrgError } = await supabase
        .from('organizations')
        .insert({
          name: emailDomain,
          metadata: { domain: emailDomain, auto_created: true }
        })
        .select('id')
        .single()

      if (createOrgError) {
        return new Response(
          JSON.stringify({ error: 'Failed to create organization' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      orgId = newOrg.id
    }

    // Check if this is first user in organization
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        organization_id: orgId,
        email: email,
        role: count === 0 ? 'owner' : 'staff'
      })

    if (profileError) {
      return new Response(
        JSON.stringify({ error: 'Failed to create profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        message: 'User linked to organization successfully',
        organizationId: orgId,
        role: count === 0 ? 'owner' : 'staff'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
