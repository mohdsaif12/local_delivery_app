import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const subscription = await req.json()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ customer_id: user.id, subscription }, { onConflict: 'customer_id' })

  if (error) {
    // The live table also has a UNIQUE(endpoint) (added out-of-band, not in the
    // migrations). The same browser used by more than one account collides on
    // endpoint — that device is already subscribed, so treat the duplicate as
    // success instead of throwing a 500 at the user. (23505 = unique_violation.)
    if (error.code === '23505') return NextResponse.json({ ok: true, note: 'already subscribed' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
