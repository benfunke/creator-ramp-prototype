import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { exchangeCodeForTokens, getUserInfo } from '@/lib/tiktok/oauth'
import { encryptToken } from '@/lib/crypto'
import { syncAccount } from '@/lib/tiktok/sync'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Handle OAuth errors from TikTok
  if (error) {
    const errorMsg = errorDescription || error
    return NextResponse.redirect(
      `${appUrl}/dashboard?tiktok_error=${encodeURIComponent(errorMsg)}`
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl}/dashboard?tiktok_error=missing_params`
    )
  }

  try {
    // Decode and validate state
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    const csrfCookie = request.cookies.get('tiktok_oauth_csrf')?.value

    if (stateData.csrf !== csrfCookie) {
      throw new Error('CSRF validation failed')
    }

    // Check timestamp (10 minute expiry)
    if (Date.now() - stateData.timestamp > 600000) {
      throw new Error('OAuth state expired')
    }

    // Get PKCE code verifier from cookie
    const codeVerifier = request.cookies.get('tiktok_oauth_verifier')?.value
    if (!codeVerifier) {
      throw new Error('PKCE code verifier missing')
    }

    // Exchange authorization code for tokens with PKCE verifier
    const tokens = await exchangeCodeForTokens(code, codeVerifier)

    // Get user info
    const userInfo = await getUserInfo(tokens.access_token)

    // Calculate token expiry times
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000)
    const refreshTokenExpiresAt = new Date(Date.now() + tokens.refresh_expires_in * 1000)

    // Store in Supabase (using service role to bypass RLS for insert)
    const supabase = createServerClient()

    // Insert/update tiktok_connection
    const { data: connection, error: connError } = await supabase
      .from('tiktok_connections')
      .upsert({
        user_id: stateData.userId,
        tiktok_open_id: tokens.open_id,
        access_token_encrypted: encryptToken(tokens.access_token),
        refresh_token_encrypted: encryptToken(tokens.refresh_token),
        token_expires_at: tokenExpiresAt.toISOString(),
        refresh_token_expires_at: refreshTokenExpiresAt.toISOString(),
        scopes: tokens.scope.split(','),
        is_active: true,
        last_sync_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,tiktok_open_id'
      })
      .select()
      .single()

    if (connError) throw connError

    // Insert/update account data
    const { error: accountError } = await supabase
      .from('tiktok_accounts')
      .upsert({
        connection_id: connection.id,
        tiktok_open_id: userInfo.open_id,
        union_id: userInfo.union_id,
        username: userInfo.username,
        display_name: userInfo.display_name,
        bio_description: userInfo.bio_description,
        avatar_url: userInfo.avatar_url,
        avatar_large_url: userInfo.avatar_large_url,
        profile_deep_link: userInfo.profile_deep_link,
        follower_count: userInfo.follower_count,
        following_count: userInfo.following_count,
        likes_count: userInfo.likes_count,
        video_count: userInfo.video_count,
        is_verified: userInfo.is_verified,
      }, {
        onConflict: 'connection_id'
      })

    if (accountError) throw accountError

    // Run initial sync in background
    syncAccount(connection.id).then(result => {
      console.log('Initial TikTok sync completed:', result)
    }).catch(err => {
      console.error('Initial TikTok sync failed:', err)
    })

    // Clear OAuth cookies and redirect to dashboard with success
    const response = NextResponse.redirect(
      `${appUrl}/dashboard?tiktok_connected=true`
    )
    response.cookies.delete('tiktok_oauth_csrf')
    response.cookies.delete('tiktok_oauth_verifier')

    return response

  } catch (err) {
    console.error('TikTok OAuth callback error:', err)
    return NextResponse.redirect(
      `${appUrl}/dashboard?tiktok_error=callback_failed`
    )
  }
}
