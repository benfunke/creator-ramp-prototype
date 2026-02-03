import crypto from 'crypto'

const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/'
const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/'

const SCOPES = [
  'user.info.basic',
  'user.info.profile',
  'user.info.stats',
  'video.list',
]

export interface TikTokTokens {
  access_token: string
  refresh_token: string
  open_id: string
  scope: string
  expires_in: number
  refresh_expires_in: number
  token_type: string
}

export interface TikTokUserInfo {
  open_id: string
  union_id?: string
  avatar_url: string
  avatar_url_100?: string
  avatar_large_url?: string
  display_name: string
  bio_description?: string
  profile_deep_link?: string
  username?: string
  follower_count?: number
  following_count?: number
  likes_count?: number
  video_count?: number
  is_verified?: boolean
}

/**
 * Generates a cryptographically random code verifier for PKCE.
 * The verifier is a high-entropy string between 43-128 characters.
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/**
 * Generates a code challenge from the code verifier using SHA256.
 * This is the Base64URL-encoded SHA256 hash of the verifier.
 */
export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

export function generateAuthUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok/callback`,
    scope: SCOPES.join(','),
    response_type: 'code',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${TIKTOK_AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<TikTokTokens> {
  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok/callback`,
      code_verifier: codeVerifier,
    }),
  })

  const data = await response.json()

  if (data.error) {
    throw new Error(data.error_description || data.error || 'Failed to exchange code for tokens')
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    open_id: data.open_id,
    scope: data.scope,
    expires_in: data.expires_in,
    refresh_expires_in: data.refresh_expires_in,
    token_type: data.token_type,
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<TikTokTokens> {
  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const data = await response.json()

  if (data.error) {
    throw new Error(data.error_description || data.error || 'Failed to refresh token')
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    open_id: data.open_id,
    scope: data.scope,
    expires_in: data.expires_in,
    refresh_expires_in: data.refresh_expires_in,
    token_type: data.token_type,
  }
}

export async function getUserInfo(accessToken: string): Promise<TikTokUserInfo> {
  const fields = [
    'open_id',
    'union_id',
    'avatar_url',
    'avatar_url_100',
    'avatar_large_url',
    'display_name',
    'bio_description',
    'profile_deep_link',
    'username',
    'follower_count',
    'following_count',
    'likes_count',
    'video_count',
    'is_verified',
  ]

  const response = await fetch(
    `https://open.tiktokapis.com/v2/user/info/?fields=${fields.join(',')}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  )

  const data = await response.json()

  console.log('TikTok user info response:', JSON.stringify(data, null, 2))

  if (data.error?.code && data.error.code !== 'ok') {
    throw new Error(data.error.message || 'Failed to fetch user info')
  }

  return data.data.user
}
