import { createServerClient } from '../supabase-server'
import { YouTubeDataAPI } from './data-api'
import { YouTubeAnalyticsAPI } from './analytics-api'

export interface SyncResult {
  success: boolean
  channelUpdated: boolean
  snapshotCreated: boolean
  videossynced: number
  analyticssynced: boolean
  errors: string[]
}

export async function syncChannel(connectionId: string): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    channelUpdated: false,
    snapshotCreated: false,
    videossynced: 0,
    analyticssynced: false,
    errors: []
  }

  const supabase = createServerClient()

  try {
    // Initialize API clients
    const dataApi = await YouTubeDataAPI.fromConnectionId(connectionId)
    const analyticsApi = await YouTubeAnalyticsAPI.fromConnectionId(connectionId)

    // 1. Sync channel info and stats
    const channelInfo = await dataApi.getChannelInfo()
    if (!channelInfo) {
      throw new Error('Failed to fetch channel info')
    }

    // Get the internal channel record
    const { data: channelRecord, error: channelFetchError } = await supabase
      .from('youtube_channels')
      .select('id')
      .eq('connection_id', connectionId)
      .single()

    if (channelFetchError || !channelRecord) {
      throw new Error('Channel record not found in database')
    }

    // Update channel data
    const channelUpdate = {
      title: channelInfo.snippet?.title,
      description: channelInfo.snippet?.description,
      custom_url: channelInfo.snippet?.customUrl,
      published_at: channelInfo.snippet?.publishedAt,
      thumbnail_url: channelInfo.snippet?.thumbnails?.high?.url,
      banner_url: channelInfo.brandingSettings?.image?.bannerExternalUrl,
      country: channelInfo.snippet?.country,
      subscriber_count: parseInt(channelInfo.statistics?.subscriberCount || '0'),
      view_count: parseInt(channelInfo.statistics?.viewCount || '0'),
      video_count: parseInt(channelInfo.statistics?.videoCount || '0'),
      updated_at: new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('youtube_channels')
      .update(channelUpdate)
      .eq('id', channelRecord.id)

    if (updateError) {
      result.errors.push(`Channel update failed: ${updateError.message}`)
    } else {
      result.channelUpdated = true
    }

    // 2. Create channel snapshot for historical tracking
    const today = new Date().toISOString().split('T')[0]
    const { error: snapshotError } = await supabase
      .from('youtube_channel_snapshots')
      .upsert({
        channel_id: channelRecord.id,
        snapshot_date: today,
        subscriber_count: channelUpdate.subscriber_count,
        view_count: channelUpdate.view_count,
        video_count: channelUpdate.video_count
      }, {
        onConflict: 'channel_id,snapshot_date'
      })

    if (snapshotError) {
      result.errors.push(`Snapshot creation failed: ${snapshotError.message}`)
    } else {
      result.snapshotCreated = true
    }

    // 3. Sync videos
    try {
      const videos = await dataApi.getVideos(100) // Fetch up to 100 videos

      for (const video of videos) {
        const videoData = {
          channel_id: channelRecord.id,
          video_id: video.id,
          title: video.snippet?.title,
          description: video.snippet?.description?.substring(0, 5000), // Limit description length
          published_at: video.snippet?.publishedAt,
          thumbnail_url: video.snippet?.thumbnails?.high?.url || video.snippet?.thumbnails?.default?.url,
          duration: video.contentDetails?.duration,
          privacy_status: video.status?.privacyStatus,
          tags: video.snippet?.tags || [],
          view_count: parseInt(video.statistics?.viewCount || '0'),
          like_count: parseInt(video.statistics?.likeCount || '0'),
          comment_count: parseInt(video.statistics?.commentCount || '0')
        }

        const { error: videoError } = await supabase
          .from('youtube_videos')
          .upsert(videoData, {
            onConflict: 'channel_id,video_id'
          })

        if (!videoError) {
          result.videossynced++
        }
      }
    } catch (videoErr: any) {
      result.errors.push(`Video sync failed: ${videoErr.message}`)
    }

    // 4. Sync analytics (last 28 days)
    try {
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 28)

      // Get basic analytics
      const analytics = await analyticsApi.getChannelAnalyticsWithRevenue(startDate, endDate)

      // Get additional metrics
      const trafficSources = await analyticsApi.getTrafficSources(startDate, endDate)
      const demographics = await analyticsApi.getDemographics(startDate, endDate)
      const geography = await analyticsApi.getGeography(startDate, endDate)
      const impressions = await analyticsApi.getImpressionMetrics(startDate, endDate)

      if (analytics?.rows && analytics.rows.length > 0) {
        const row = analytics.rows[0]
        const columnHeaders = analytics.columnHeaders?.map(h => h.name) || []

        const getValue = (name: string) => {
          const idx = columnHeaders.indexOf(name)
          return idx >= 0 ? row[idx] : null
        }

        // Get impression metrics
        let impressionCount = null
        let ctr = null
        if (impressions?.rows && impressions.rows.length > 0) {
          const impHeaders = impressions.columnHeaders?.map(h => h.name) || []
          const impIdx = impHeaders.indexOf('impressions')
          const ctrIdx = impHeaders.indexOf('impressionClickThroughRate')
          if (impIdx >= 0) impressionCount = impressions.rows[0][impIdx]
          if (ctrIdx >= 0) ctr = impressions.rows[0][ctrIdx]
        }

        const analyticsData = {
          channel_id: channelRecord.id,
          snapshot_date: today,
          period_start: startDate.toISOString().split('T')[0],
          period_end: endDate.toISOString().split('T')[0],
          watch_time_minutes: getValue('estimatedMinutesWatched'),
          average_view_duration_seconds: getValue('averageViewDuration'),
          views: getValue('views'),
          impressions: impressionCount,
          click_through_rate: ctr,
          subscribers_gained: getValue('subscribersGained'),
          subscribers_lost: getValue('subscribersLost'),
          estimated_revenue_cents: getValue('estimatedRevenue') ? Math.round(getValue('estimatedRevenue') * 100) : null,
          demographics_json: demographics?.rows ? { data: demographics.rows, headers: demographics.columnHeaders } : null,
          traffic_sources_json: trafficSources?.rows ? { data: trafficSources.rows, headers: trafficSources.columnHeaders } : null,
          geography_json: geography?.rows ? { data: geography.rows, headers: geography.columnHeaders } : null
        }

        const { error: analyticsError } = await supabase
          .from('youtube_analytics_snapshots')
          .upsert(analyticsData, {
            onConflict: 'channel_id,snapshot_date,period_start,period_end'
          })

        if (analyticsError) {
          result.errors.push(`Analytics save failed: ${analyticsError.message}`)
        } else {
          result.analyticssynced = true
        }
      }
    } catch (analyticsErr: any) {
      result.errors.push(`Analytics sync failed: ${analyticsErr.message}`)
    }

    // Update last_sync_at on the connection
    await supabase
      .from('youtube_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connectionId)

    result.success = result.errors.length === 0

  } catch (error: any) {
    result.errors.push(`Sync failed: ${error.message}`)
  }

  return result
}

// Sync all active connections (for scheduled jobs)
export async function syncAllChannels(): Promise<{ synced: number; failed: number }> {
  const supabase = createServerClient()

  const { data: connections, error } = await supabase
    .from('youtube_connections')
    .select('id')
    .eq('is_active', true)

  if (error || !connections) {
    console.error('Failed to fetch connections:', error)
    return { synced: 0, failed: 0 }
  }

  let synced = 0
  let failed = 0

  for (const connection of connections) {
    const result = await syncChannel(connection.id)
    if (result.success) {
      synced++
    } else {
      failed++
      console.error(`Sync failed for connection ${connection.id}:`, result.errors)
    }
  }

  return { synced, failed }
}
