import { google, youtubeAnalytics_v2 } from 'googleapis'
import { getOAuth2Client, refreshAccessToken } from './oauth'
import { decryptToken, encryptToken } from '../crypto'
import { createServerClient } from '../supabase-server'

export class YouTubeAnalyticsAPI {
  private analytics: youtubeAnalytics_v2.Youtubeanalytics
  private channelId: string

  constructor(accessToken: string, channelId: string) {
    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials({ access_token: accessToken })
    this.analytics = google.youtubeAnalytics({ version: 'v2', auth: oauth2Client })
    this.channelId = channelId
  }

  static async fromConnectionId(connectionId: string): Promise<YouTubeAnalyticsAPI> {
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

      await supabase
        .from('youtube_connections')
        .update({
          access_token_encrypted: encryptToken(newTokens.access_token!),
          token_expires_at: new Date(newTokens.expiry_date!).toISOString()
        })
        .eq('id', connectionId)

      accessToken = newTokens.access_token!
    }

    return new YouTubeAnalyticsAPI(accessToken, connection.channel_id)
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]
  }

  async getChannelAnalytics(startDate: Date, endDate: Date) {
    try {
      const response = await this.analytics.reports.query({
        ids: `channel==${this.channelId}`,
        startDate: this.formatDate(startDate),
        endDate: this.formatDate(endDate),
        metrics: [
          'views',
          'estimatedMinutesWatched',
          'averageViewDuration',
          'averageViewPercentage',
          'subscribersGained',
          'subscribersLost',
          'likes',
          'comments',
          'shares'
        ].join(',')
      })
      return response.data
    } catch (error: any) {
      // Analytics API may not have data for new channels
      console.error('Analytics fetch error:', error.message)
      return null
    }
  }

  async getChannelAnalyticsWithRevenue(startDate: Date, endDate: Date) {
    try {
      const response = await this.analytics.reports.query({
        ids: `channel==${this.channelId}`,
        startDate: this.formatDate(startDate),
        endDate: this.formatDate(endDate),
        metrics: [
          'views',
          'estimatedMinutesWatched',
          'averageViewDuration',
          'averageViewPercentage',
          'subscribersGained',
          'subscribersLost',
          'likes',
          'comments',
          'shares',
          'estimatedRevenue',
          'cpm'
        ].join(',')
      })
      return response.data
    } catch (error: any) {
      // Revenue metrics require monetization - fall back to basic analytics
      console.error('Revenue analytics fetch error, trying without revenue:', error.message)
      return this.getChannelAnalytics(startDate, endDate)
    }
  }

  async getTrafficSources(startDate: Date, endDate: Date) {
    try {
      const response = await this.analytics.reports.query({
        ids: `channel==${this.channelId}`,
        startDate: this.formatDate(startDate),
        endDate: this.formatDate(endDate),
        metrics: 'views,estimatedMinutesWatched',
        dimensions: 'insightTrafficSourceType',
        sort: '-views'
      })
      return response.data
    } catch (error: any) {
      console.error('Traffic sources fetch error:', error.message)
      return null
    }
  }

  async getDemographics(startDate: Date, endDate: Date) {
    try {
      const response = await this.analytics.reports.query({
        ids: `channel==${this.channelId}`,
        startDate: this.formatDate(startDate),
        endDate: this.formatDate(endDate),
        metrics: 'viewerPercentage',
        dimensions: 'ageGroup,gender',
        sort: '-viewerPercentage'
      })
      return response.data
    } catch (error: any) {
      console.error('Demographics fetch error:', error.message)
      return null
    }
  }

  async getGeography(startDate: Date, endDate: Date) {
    try {
      const response = await this.analytics.reports.query({
        ids: `channel==${this.channelId}`,
        startDate: this.formatDate(startDate),
        endDate: this.formatDate(endDate),
        metrics: 'views,estimatedMinutesWatched',
        dimensions: 'country',
        sort: '-views',
        maxResults: 25
      })
      return response.data
    } catch (error: any) {
      console.error('Geography fetch error:', error.message)
      return null
    }
  }

  async getImpressionMetrics(startDate: Date, endDate: Date) {
    try {
      const response = await this.analytics.reports.query({
        ids: `channel==${this.channelId}`,
        startDate: this.formatDate(startDate),
        endDate: this.formatDate(endDate),
        metrics: 'impressions,impressionClickThroughRate'
      })
      return response.data
    } catch (error: any) {
      console.error('Impressions fetch error:', error.message)
      return null
    }
  }
}
