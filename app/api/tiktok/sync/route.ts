import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithAuth, createServerClient } from '@/lib/supabase-server'
import { syncAccount } from '@/lib/tiktok/sync'

export async function POST(request: NextRequest) {
  // Get user's Supabase session from authorization header
  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const supabase = createServerClientWithAuth(token)

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get the user's TikTok connection
    const serverSupabase = createServerClient()
    const { data: connection, error: connError } = await serverSupabase
      .from('tiktok_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (connError || !connection) {
      return NextResponse.json(
        { error: 'No TikTok account connected' },
        { status: 404 }
      )
    }

    // Run the sync
    const result = await syncAccount(connection.id)

    return NextResponse.json({
      success: result.success,
      accountUpdated: result.accountUpdated,
      snapshotCreated: result.snapshotCreated,
      videosSynced: result.videosSynced,
      errors: result.errors
    })

  } catch (error: any) {
    console.error('TikTok sync error:', error)
    return NextResponse.json(
      { error: 'Sync failed', details: error.message },
      { status: 500 }
    )
  }
}
