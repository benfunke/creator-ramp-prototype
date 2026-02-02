import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { exchangeCodeForTokens, getOAuth2Client } from '@/lib/youtube/oauth'
import { encryptToken } from '@/lib/crypto'
import { syncChannel } from '@/lib/youtube/sync'
import { google } from 'googleapis'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Handle OAuth errors from Google
  if (error) {
    return NextResponse.redirect(
      `${appUrl}/dashboard?youtube_error=${encodeURIComponent(error)}`
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl}/dashboard?youtube_error=missing_params`
    )
  }

  try {
    // Decode and validate state
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    const csrfCookie = request.cookies.get('youtube_oauth_csrf')?.value

    if (stateData.csrf !== csrfCookie) {
      throw new Error('CSRF validation failed')
    }

    // Check timestamp (10 minute expiry)
    if (Date.now() - stateData.timestamp > 600000) {
      throw new Error('OAuth state expired')
    }

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Missing tokens in response')
    }

    // Get channel info using the access token
    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials(tokens)

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client })
    const channelResponse = await youtube.channels.list({
      part: ['snippet', 'statistics', 'brandingSettings'],
      mine: true
    })

    const channel = channelResponse.data.items?.[0]
    if (!channel || !channel.id) {
      throw new Error('No channel found for this account')
    }

    // Store in Supabase (using service role to bypass RLS for insert)
    const supabase = createServerClient()

    // Insert/update youtube_connection
    const { data: connection, error: connError } = await supabase
      .from('youtube_connections')
      .upsert({
        user_id: stateData.userId,
        channel_id: channel.id,
        access_token_encrypted: encryptToken(tokens.access_token),
        refresh_token_encrypted: encryptToken(tokens.refresh_token),
        token_expires_at: new Date(tokens.expiry_date!).toISOString(),
        scopes: tokens.scope?.split(' ') || [],
        is_active: true,
        last_sync_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,channel_id'
      })
      .select()
      .single()

    if (connError) throw connError

    // Insert/update channel data
    const { error: channelError } = await supabase
      .from('youtube_channels')
      .upsert({
        connection_id: connection.id,
        channel_id: channel.id,
        title: channel.snippet?.title,
        description: channel.snippet?.description,
        custom_url: channel.snippet?.customUrl,
        published_at: channel.snippet?.publishedAt,
        thumbnail_url: channel.snippet?.thumbnails?.high?.url,
        banner_url: channel.brandingSettings?.image?.bannerExternalUrl,
        country: channel.snippet?.country,
        subscriber_count: parseInt(channel.statistics?.subscriberCount || '0'),
        view_count: parseInt(channel.statistics?.viewCount || '0'),
        video_count: parseInt(channel.statistics?.videoCount || '0'),
      }, {
        onConflict: 'connection_id'
      })

    if (channelError) throw channelError

    // Run initial sync to populate videos, analytics, and create first snapshot
    // This runs in the background - we don't wait for it to complete
    syncChannel(connection.id).then(result => {
      console.log('Initial sync completed:', result)
    }).catch(err => {
      console.error('Initial sync failed:', err)
    })

    // Clear CSRF cookie and redirect to dashboard with success
    const response = NextResponse.redirect(
      `${appUrl}/dashboard?youtube_connected=true`
    )
    response.cookies.delete('youtube_oauth_csrf')

    return response

  } catch (err) {
    console.error('YouTube OAuth callback error:', err)
    return NextResponse.redirect(
      `${appUrl}/dashboard?youtube_error=callback_failed`
    )
  }
}
