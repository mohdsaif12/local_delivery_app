import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

const getSupabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  const { customerId, title, body, url, tag } = await req.json()
  if (!customerId || !title || !body) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: CORS })
  }

  const { data, error } = await getSupabaseAdmin()
    .from('push_subscriptions')
    .select('id, subscription')
    .eq('customer_id', customerId)
    .single()

  if (error || !data) {
    return NextResponse.json({ ok: false, reason: 'no subscription' }, { headers: CORS })
  }

  try {
    await webpush.sendNotification(
      data.subscription as webpush.PushSubscription,
      JSON.stringify({ title, body, url: url ?? '/', tag: tag ?? 'order-update' }),
      {
        TTL: 86400, // 24 hours retention if offline
        headers: {
          Urgency: 'high', // Tells Android FCM to trigger high-priority heads-up pop-up
        },
      }
    )
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (err: unknown) {
    const e = err as { statusCode?: number; body?: string; message?: string }
    // Subscription expired or invalid — remove it so banner shows again next login
    if (e?.statusCode === 404 || e?.statusCode === 410) {
      await getSupabaseAdmin().from('push_subscriptions').delete().eq('id', data.id)
    }
    return NextResponse.json(
      { ok: false, reason: 'send failed', statusCode: e?.statusCode, detail: e?.body ?? e?.message },
      { headers: CORS }
    )
  }
}
