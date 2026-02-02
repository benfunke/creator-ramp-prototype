import { decryptToken, encryptToken } from '../crypto'
import { createServerClient } from '../supabase-server'
import { refreshLongLivedToken } from './oauth'

const GRAPH_API_BASE = 'https://graph.facebook.com/v18.0'

export class InstagramGraphAPI {
  private accessToken: string
  private connectionId: string
  private instagramUserId: string

  constructor(accessToken: string, connectionId: string, instagramUserId: string) {
    this.accessToken = accessToken
    this.connectionId = connectionId
    this.instagramUserId = instagramUserId
  }

  static async fromConnectionId(connectionId: string): Promise<InstagramGraphAPI> {
    const supabase = createServerClient()

    const { data: connection, error } = await supabase
      .from('instagram_connections')
      .select('*')
      .eq('id', connectionId)
      .single()

    if (error || !connection) {
      throw new Error('Connection not found')
    }

    let accessToken = decryptToken(connection.access_token_encrypted)

    // Check if token expires within 7 days and refresh if so
    const expiresAt = new Date(connection.token_expires_at)
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    if (expiresAt < sevenDaysFromNow) {
      try {
        const newToken = await refreshLongLivedToken(accessToken)
        const newExpiresAt = new Date(Date.now() + newToken.expires_in * 1000)

        // Update token in database
        await supabase
          .from('instagram_connections')
          .update({
            access_token_encrypted: encryptToken(newToken.access_token),
            token_expires_at: newExpiresAt.toISOString()
          })
          .eq('id', connectionId)

        accessToken = newToken.access_token
      } catch (refreshError) {
        console.error('Failed to refresh Instagram token:', refreshError)
        // Continue with existing token if refresh fails
      }
    }

    return new InstagramGraphAPI(accessToken, connectionId, connection.instagram_user_id)
  }

  private async fetch(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    const url = new URL(`${GRAPH_API_BASE}${endpoint}`)
    url.searchParams.set('access_token', this.accessToken)
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })

    const response = await fetch(url.toString())
    const data = await response.json()

    if (data.error) {
      throw new Error(data.error.message || 'Instagram API error')
    }

    return data
  }

  async getAccountInfo(): Promise<any> {
    return this.fetch(`/${this.instagramUserId}`, {
      fields: 'username,name,biography,profile_picture_url,followers_count,follows_count,media_count,account_type,website'
    })
  }

  async getMedia(limit = 50): Promise<any[]> {
    const allMedia: any[] = []
    let nextUrl: string | null = null

    do {
      let response: any
      if (nextUrl) {
        const fetchResponse = await fetch(`${nextUrl}&access_token=${this.accessToken}`)
        response = await fetchResponse.json()
      } else {
        response = await this.fetch(`/${this.instagramUserId}/media`, {
          fields: 'id,media_type,media_product_type,caption,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count',
          limit: String(Math.min(limit, 50))
        })
      }

      if (response.data) {
        allMedia.push(...response.data)
      }

      nextUrl = response.paging?.next || null
    } while (nextUrl && allMedia.length < limit)

    return allMedia.slice(0, limit)
  }

  async getMediaInsights(mediaId: string, mediaType: string): Promise<any> {
    // Different metrics available for different media types
    let metrics: string[]

    if (mediaType === 'VIDEO' || mediaType === 'REELS') {
      metrics = ['impressions', 'reach', 'plays', 'saved', 'shares']
    } else if (mediaType === 'CAROUSEL_ALBUM') {
      metrics = ['impressions', 'reach', 'saved']
    } else {
      metrics = ['impressions', 'reach', 'saved']
    }

    try {
      return await this.fetch(`/${mediaId}/insights`, {
        metric: metrics.join(',')
      })
    } catch (error) {
      console.error(`Failed to fetch insights for media ${mediaId}:`, error)
      return null
    }
  }

  async getAccountInsights(period: 'day' | 'week' | 'days_28' | 'lifetime' = 'days_28'): Promise<any> {
    const metrics = [
      'impressions',
      'reach',
      'profile_views',
      'website_clicks',
      'email_contacts',
      'phone_call_clicks',
      'get_directions_clicks'
    ]

    try {
      return await this.fetch(`/${this.instagramUserId}/insights`, {
        metric: metrics.join(','),
        period
      })
    } catch (error) {
      console.error('Failed to fetch account insights:', error)
      return null
    }
  }

  async getAudienceDemographics(): Promise<any> {
    const metrics = [
      'audience_city',
      'audience_country',
      'audience_gender_age',
      'audience_locale'
    ]

    try {
      return await this.fetch(`/${this.instagramUserId}/insights`, {
        metric: metrics.join(','),
        period: 'lifetime'
      })
    } catch (error) {
      console.error('Failed to fetch audience demographics:', error)
      return null
    }
  }

  async getOnlineFollowers(): Promise<any> {
    try {
      return await this.fetch(`/${this.instagramUserId}/insights`, {
        metric: 'online_followers',
        period: 'lifetime'
      })
    } catch (error) {
      console.error('Failed to fetch online followers:', error)
      return null
    }
  }
}
