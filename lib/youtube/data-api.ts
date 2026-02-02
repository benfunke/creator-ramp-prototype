import { google, youtube_v3 } from 'googleapis'
import { getOAuth2Client, refreshAccessToken } from './oauth'
import { decryptToken, encryptToken } from '../crypto'
import { createServerClient } from '../supabase-server'

export class YouTubeDataAPI {
  private youtube: youtube_v3.Youtube
  private connectionId: string
  private channelId: string

  constructor(accessToken: string, connectionId: string, channelId: string) {
    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials({ access_token: accessToken })
    this.youtube = google.youtube({ version: 'v3', auth: oauth2Client })
    this.connectionId = connectionId
    this.channelId = channelId
  }

  static async fromConnectionId(connectionId: string): Promise<YouTubeDataAPI> {
    const supabase = createServerClient()

    const { data: connection, error } = await supabase
      .from('youtube_connections')
      .select('*')
      .eq('id', connectionId)
      .single()

    if (error || !connection) {
      throw new Error('Connection not found')
    }

    let accessToken = decryptToken(connection.access_token_encrypted)

    // Check if token is expired and refresh if needed
    if (new Date(connection.token_expires_at) < new Date()) {
      const refreshToken = decryptToken(connection.refresh_token_encrypted)
      const newTokens = await refreshAccessToken(refreshToken)

      // Update tokens in database
      await supabase
        .from('youtube_connections')
        .update({
          access_token_encrypted: encryptToken(newTokens.access_token!),
          token_expires_at: new Date(newTokens.expiry_date!).toISOString()
        })
        .eq('id', connectionId)

      accessToken = newTokens.access_token!
    }

    return new YouTubeDataAPI(accessToken, connectionId, connection.channel_id)
  }

  async getChannelInfo() {
    const response = await this.youtube.channels.list({
      part: ['snippet', 'statistics', 'brandingSettings', 'contentDetails'],
      id: [this.channelId]
    })
    return response.data.items?.[0]
  }

  async getVideos(maxResults = 50): Promise<any[]> {
    // First get the uploads playlist
    const channel = await this.getChannelInfo()
    const uploadsPlaylistId = channel?.contentDetails?.relatedPlaylists?.uploads

    if (!uploadsPlaylistId) {
      throw new Error('Could not find uploads playlist')
    }

    const allVideos: any[] = []
    let pageToken: string | undefined

    // Fetch all videos (paginated)
    do {
      const playlistResponse = await this.youtube.playlistItems.list({
        part: ['snippet', 'contentDetails'],
        playlistId: uploadsPlaylistId,
        maxResults: Math.min(maxResults, 50),
        pageToken
      })

      const videoIds = playlistResponse.data.items
        ?.map(item => item.contentDetails?.videoId)
        .filter(Boolean) as string[]

      if (videoIds.length > 0) {
        // Get detailed video info including statistics
        const videosResponse = await this.youtube.videos.list({
          part: ['snippet', 'statistics', 'contentDetails', 'status'],
          id: videoIds
        })

        if (videosResponse.data.items) {
          allVideos.push(...videosResponse.data.items)
        }
      }

      pageToken = playlistResponse.data.nextPageToken || undefined

      // Limit total videos fetched
      if (allVideos.length >= maxResults) break
    } while (pageToken)

    return allVideos.slice(0, maxResults)
  }

  async getPlaylists(): Promise<any[]> {
    const allPlaylists: any[] = []
    let pageToken: string | undefined

    do {
      const response = await this.youtube.playlists.list({
        part: ['snippet', 'contentDetails', 'status'],
        channelId: this.channelId,
        maxResults: 50,
        pageToken
      })

      if (response.data.items) {
        allPlaylists.push(...response.data.items)
      }

      pageToken = response.data.nextPageToken || undefined
    } while (pageToken)

    return allPlaylists
  }
}
