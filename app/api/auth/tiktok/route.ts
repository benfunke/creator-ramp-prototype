import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithAuth } from '@/lib/supabase-server'
import { generateAuthUrl, generateCodeVerifier, generateCodeChallenge } from '@/lib/tiktok/oauth'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  // Get user's Supabase session from authorization header
  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const supabase = createServerClientWithAuth(token)

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Generate state with user ID and CSRF token
  const csrfToken = crypto.randomBytes(16).toString('hex')
  const state = Buffer.from(JSON.stringify({
    userId: user.id,
    csrf: csrfToken,
    timestamp: Date.now()
  })).toString('base64')

  // Generate PKCE code verifier and challenge
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)

  // Generate the TikTok OAuth URL with PKCE
  const authUrl = generateAuthUrl(state, codeChallenge)

  // Store CSRF token and code verifier in httpOnly cookies
  const response = NextResponse.json({ authUrl })
  response.cookies.set('tiktok_oauth_csrf', csrfToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600 // 10 minutes
  })
  response.cookies.set('tiktok_oauth_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600 // 10 minutes
  })

  return response
}
