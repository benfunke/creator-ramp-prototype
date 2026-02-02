import { NextRequest, NextResponse } from 'next/server'
import { createServerClientWithAuth } from '@/lib/supabase-server'
import { generateAuthUrl } from '@/lib/youtube/oauth'
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

  // Generate the Google OAuth URL
  const authUrl = generateAuthUrl(state)

  // Store CSRF token in httpOnly cookie
  const response = NextResponse.json({ authUrl })
  response.cookies.set('youtube_oauth_csrf', csrfToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600 // 10 minutes
  })

  return response
}
