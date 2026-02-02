import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getInstagramAccountFromFacebook
} from '@/lib/instagram/oauth'
import { encryptToken } from '@/lib/crypto'
import { syncAccount } from '@/lib/instagram/sync'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorReason = searchParams.get('error_reason')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Handle OAuth errors from Facebook
  if (error) {
    const errorMsg = errorReason || error
    return NextResponse.redirect(
      `${appUrl}/dashboard?instagram_error=${encodeURIComponent(errorMsg)}`
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl}/dashboard?instagram_error=missing_params`
    )
  }

  try {
    // Decode and validate state
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    const csrfCookie = request.cookies.get('instagram_oauth_csrf')?.value

    if (stateData.csrf !== csrfCookie) {
      throw new Error('CSRF validation failed')
    }

    // Check timestamp (10 minute expiry)
    if (Date.now() - stateData.timestamp > 600000) {
      throw new Error('OAuth state expired')
    }

    // Exchange authorization code for short-lived token
    const shortLivedToken = await exchangeCodeForToken(code)

    // Exchange for long-lived token (60 days)
    const longLivedToken = await exchangeForLongLivedToken(shortLivedToken.access_token)

    // Get Instagram account info via Facebook Graph API
    const instagramAccount = await getInstagramAccountFromFacebook(longLivedToken.access_token)

    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + longLivedToken.expires_in * 1000)

    // Store in Supabase (using service role to bypass RLS for insert)
    const supabase = createServerClient()

    // Insert/update instagram_connection
    const { data: connection, error: connError } = await supabase
      .from('instagram_connections')
      .upsert({
        user_id: stateData.userId,
        instagram_user_id: instagramAccount.instagram_user_id,
        facebook_page_id: instagramAccount.facebook_page_id,
        access_token_encrypted: encryptToken(longLivedToken.access_token),
        token_expires_at: tokenExpiresAt.toISOString(),
        scopes: ['instagram_basic', 'instagram_manage_insights', 'pages_show_list', 'pages_read_engagement', 'business_management'],
        is_active: true,
        last_sync_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,instagram_user_id'
      })
      .select()
      .single()

    if (connError) throw connError

    // Insert/update account data
    const { error: accountError } = await supabase
      .from('instagram_accounts')
      .upsert({
        connection_id: connection.id,
        instagram_user_id: instagramAccount.instagram_user_id,
        username: instagramAccount.username,
        name: instagramAccount.name,
        biography: instagramAccount.biography,
        profile_picture_url: instagramAccount.profile_picture_url,
        website: instagramAccount.website,
        followers_count: instagramAccount.followers_count,
        follows_count: instagramAccount.follows_count,
        media_count: instagramAccount.media_count,
        account_type: instagramAccount.account_type,
      }, {
        onConflict: 'connection_id'
      })

    if (accountError) throw accountError

    // Run initial sync in background
    syncAccount(connection.id).then(result => {
      console.log('Initial Instagram sync completed:', result)
    }).catch(err => {
      console.error('Initial Instagram sync failed:', err)
    })

    // Clear CSRF cookie and redirect to dashboard with success
    const response = NextResponse.redirect(
      `${appUrl}/dashboard?instagram_connected=true`
    )
    response.cookies.delete('instagram_oauth_csrf')

    return response

  } catch (err) {
    console.error('Instagram OAuth callback error:', err)
    return NextResponse.redirect(
      `${appUrl}/dashboard?instagram_error=callback_failed`
    )
  }
}
