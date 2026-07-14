import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const token = authHeader.replace('Bearer ', '')

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: { user }, error: uErr } = await admin.auth.getUser(token)
    if (uErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const callerId = user.id

    // verify caller is admin (allow hardcoded admin emails as fallback)
    const { data: roleRow } = await admin.from('user_roles').select('role').eq('user_id', callerId).eq('role', 'admin').maybeSingle()

    const callerEmail = user.email?.toLowerCase() || ""
    const isHardcodedAdmin = ['admin12@gmail.com', 'info@zhar.in'].includes(callerEmail)

    if (!roleRow && !isHardcodedAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: usersData, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (listErr) throw listErr

    const ids = usersData.users.map((u) => u.id)
    const [{ data: profiles }, { data: subs }, { data: roles }] = await Promise.all([
      admin.from('profiles').select('*').in('id', ids),
      admin.from('subscriptions').select('*').in('user_id', ids),
      admin.from('user_roles').select('user_id, role').in('user_id', ids),
    ])

    const users = usersData.users.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      profile: profiles?.find((p: any) => p.id === u.id) || null,
      subscription: subs?.find((s: any) => s.user_id === u.id) || null,
      roles: (roles || []).filter((r: any) => r.user_id === u.id).map((r: any) => r.role),
    }))

    return new Response(JSON.stringify({ users }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
