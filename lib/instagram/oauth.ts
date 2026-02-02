const FACEBOOK_OAUTH_URL = 'https://www.facebook.com/v18.0/dialog/oauth'
const FACEBOOK_TOKEN_URL = 'https://graph.facebook.com/v18.0/oauth/access_token'
const GRAPH_API_BASE = 'https://graph.facebook.com/v18.0'

const SCOPES = [
  'instagram_basic',
  'instagram_manage_insights',
  'pages_show_list',
  'pages_read_engagement',
  'business_management',
]

export interface ShortLivedToken {
  access_token: string
  token_type: string
  expires_in: number
}

export interface LongLivedToken {
  access_token: string
  token_type: string
  expires_in: number
}

export interface InstagramAccount {
  instagram_user_id: string
  facebook_page_id: string
  username: string
  name: string
  biography: string
  profile_picture_url: string
  followers_count: number
  follows_count: number
  media_count: number
  account_type: string
  website?: string
}

export function generateAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`,
    scope: SCOPES.join(','),
    response_type: 'code',
    state,
  })
  return `${FACEBOOK_OAUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForToken(code: string): Promise<ShortLivedToken> {
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID!,
    client_secret: process.env.FACEBOOK_APP_SECRET!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`,
    code,
  })

  const response = await fetch(`${FACEBOOK_TOKEN_URL}?${params.toString()}`)
  const data = await response.json()

  if (data.error) {
    throw new Error(data.error.message || 'Failed to exchange code for token')
  }

  return {
    access_token: data.access_token,
    token_type: data.token_type,
    expires_in: data.expires_in,
  }
}

export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<LongLivedToken> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: process.env.FACEBOOK_APP_ID!,
    client_secret: process.env.FACEBOOK_APP_SECRET!,
    fb_exchange_token: shortLivedToken,
  })

  const response = await fetch(`${FACEBOOK_TOKEN_URL}?${params.toString()}`)
  const data = await response.json()

  if (data.error) {
    throw new Error(data.error.message || 'Failed to exchange for long-lived token')
  }

  return {
    access_token: data.access_token,
    token_type: data.token_type,
    expires_in: data.expires_in,
  }
}

export async function refreshLongLivedToken(currentToken: string): Promise<LongLivedToken> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: process.env.FACEBOOK_APP_ID!,
    client_secret: process.env.FACEBOOK_APP_SECRET!,
    fb_exchange_token: currentToken,
  })

  const response = await fetch(`${FACEBOOK_TOKEN_URL}?${params.toString()}`)
  const data = await response.json()

  if (data.error) {
    throw new Error(data.error.message || 'Failed to refresh token')
  }

  return {
    access_token: data.access_token,
    token_type: data.token_type,
    expires_in: data.expires_in,
  }
}

export async function getInstagramAccountFromFacebook(accessToken: string): Promise<InstagramAccount> {
  // Get Facebook Pages the user manages
  const pagesResponse = await fetch(
    `${GRAPH_API_BASE}/me/accounts?access_token=${accessToken}`
  )
  const pagesData = await pagesResponse.json()

  if (pagesData.error) {
    throw new Error(pagesData.error.message || 'Failed to fetch Facebook pages')
  }

  if (!pagesData.data || pagesData.data.length === 0) {
    throw new Error('No Facebook Pages found. Instagram Business accounts must be linked to a Facebook Page.')
  }

  // For each page, check if it has a linked Instagram account
  for (const page of pagesData.data) {
    const igAccountResponse = await fetch(
      `${GRAPH_API_BASE}/${page.id}?fields=instagram_business_account&access_token=${accessToken}`
    )
    const igAccountData = await igAccountResponse.json()

    if (igAccountData.instagram_business_account) {
      const igUserId = igAccountData.instagram_business_account.id

      // Get Instagram account details
      const profileResponse = await fetch(
        `${GRAPH_API_BASE}/${igUserId}?fields=username,name,biography,profile_picture_url,followers_count,follows_count,media_count,account_type,website&access_token=${accessToken}`
      )
      const profile = await profileResponse.json()

      if (profile.error) {
        throw new Error(profile.error.message || 'Failed to fetch Instagram profile')
      }

      return {
        instagram_user_id: igUserId,
        facebook_page_id: page.id,
        username: profile.username,
        name: profile.name,
        biography: profile.biography,
        profile_picture_url: profile.profile_picture_url,
        followers_count: profile.followers_count,
        follows_count: profile.follows_count,
        media_count: profile.media_count,
        account_type: profile.account_type,
        website: profile.website,
      }
    }
  }

  throw new Error('No Instagram Business/Creator account found linked to your Facebook Pages.')
}
