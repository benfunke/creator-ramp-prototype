import { decryptToken, encryptToken } from '../crypto'
import { createServerClient } from '../supabase-server'
import { refreshAccessToken, TikTokUserInfo } from './oauth'

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2'

export interface TikTokVideo {
  id: string
  title: string
  video_description: string
  create_time: number
  cover_image_url: string
  share_url: string
  embed_link: string
  duration: number
  width: number
  height: number
  view_count: number
  like_count: number
  comment_count: number
  share_count: number
}

export class TikTokAPI {
  private accessToken: string
  private connectionId: string
  private openId: string

  constructor(accessToken: string, connectionId: string, openId: string) {
    this.accessToken = accessToken
    this.connectionId = connectionId
    this.openId = openId
  }

  static async fromConnectionId(connectionId: string): Promise<TikTokAPI> {
    const supabase = createServerClient()

    const { data: connection, error } = await supabase
      .from('tiktok_connections')
      .select('*')
      .eq('id', connectionId)
      .single()

    if (error || !connection) {
      throw new Error('Connection not found')
    }

    let accessToken = decryptToken(connection.access_token_encrypted)

    // Check if token is expired and refresh if needed
    const expiresAt = new Date(connection.token_expires_at)
    const now = new Date()

    if (expiresAt < now) {
      // Token expired, try to refresh
      const refreshTokenExpiresAt = new Date(connection.refresh_token_expires_at)

      if (refreshTokenExpiresAt < now) {
        throw new Error('Refresh token expired. User needs to reconnect.')
      }

      try {
        const refreshToken = decryptToken(connection.refresh_token_encrypted)
        const newTokens = await refreshAccessToken(refreshToken)

        const newTokenExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000)
        const newRefreshTokenExpiresAt = new Date(Date.now() + newTokens.refresh_expires_in * 1000)

        // Update tokens in database
        await supabase
          .from('tiktok_connections')
          .update({
            access_token_encrypted: encryptToken(newTokens.access_token),
            refresh_token_encrypted: encryptToken(newTokens.refresh_token),
            token_expires_at: newTokenExpiresAt.toISOString(),
            refresh_token_expires_at: newRefreshTokenExpiresAt.toISOString(),
          })
          .eq('id', connectionId)

        accessToken = newTokens.access_token
      } catch (refreshError) {
        console.error('Failed to refresh TikTok token:', refreshError)
        throw new Error('Failed to refresh token. User needs to reconnect.')
      }
    }

    return new TikTokAPI(accessToken, connectionId, connection.tiktok_open_id)
  }

  private async fetch(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    const url = new URL(`${TIKTOK_API_BASE}${endpoint}`)
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
    })

    const data = await response.json()

    if (data.error?.code && data.error.code !== 'ok') {
      throw new Error(data.error.message || 'TikTok API error')
    }

    return data
  }

  async getUserInfo(): Promise<TikTokUserInfo> {
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

    const data = await this.fetch('/user/info/', {
      fields: fields.join(','),
    })

    return data.data.user
  }

  async getVideos(maxCount = 20, cursor?: string): Promise<{ videos: TikTokVideo[], cursor: string | null, has_more: boolean }> {
    const fields = [
      'id',
      'title',
      'video_description',
      'create_time',
      'cover_image_url',
      'share_url',
      'embed_link',
      'duration',
      'width',
      'height',
      'view_count',
      'like_count',
      'comment_count',
      'share_count',
    ]

    const params: Record<string, string> = {
      fields: fields.join(','),
      max_count: String(Math.min(maxCount, 20)), // TikTok max is 20 per request
    }

    if (cursor) {
      params.cursor = cursor
    }

    const response = await fetch(`${TIKTOK_API_BASE}/video/list/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })

    const data = await response.json()

    if (data.error?.code && data.error.code !== 'ok') {
      throw new Error(data.error.message || 'Failed to fetch videos')
    }

    return {
      videos: data.data.videos || [],
      cursor: data.data.cursor || null,
      has_more: data.data.has_more || false,
    }
  }

  async getAllVideos(maxVideos = 100): Promise<TikTokVideo[]> {
    const allVideos: TikTokVideo[] = []
    let cursor: string | undefined
    let hasMore = true

    while (hasMore && allVideos.length < maxVideos) {
      const result = await this.getVideos(20, cursor)
      allVideos.push(...result.videos)
      cursor = result.cursor || undefined
      hasMore = result.has_more
    }

    return allVideos.slice(0, maxVideos)
  }
}
