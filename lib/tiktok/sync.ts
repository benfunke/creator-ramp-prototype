import { createServerClient } from '../supabase-server'
import { TikTokAPI } from './api'

export interface SyncResult {
  success: boolean
  accountUpdated: boolean
  snapshotCreated: boolean
  videosSynced: number
  errors: string[]
}

export async function syncAccount(connectionId: string): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    accountUpdated: false,
    snapshotCreated: false,
    videosSynced: 0,
    errors: []
  }

  const supabase = createServerClient()

  try {
    // Initialize API client
    const api = await TikTokAPI.fromConnectionId(connectionId)

    // 1. Sync account info
    const userInfo = await api.getUserInfo()

    // Get the internal account record
    const { data: accountRecord, error: accountFetchError } = await supabase
      .from('tiktok_accounts')
      .select('id')
      .eq('connection_id', connectionId)
      .single()

    if (accountFetchError || !accountRecord) {
      throw new Error('Account record not found in database')
    }

    // Update account data
    const accountUpdate = {
      username: userInfo.username,
      display_name: userInfo.display_name,
      bio_description: userInfo.bio_description,
      avatar_url: userInfo.avatar_url,
      avatar_large_url: userInfo.avatar_large_url,
      profile_deep_link: userInfo.profile_deep_link,
      follower_count: userInfo.follower_count,
      following_count: userInfo.following_count,
      likes_count: userInfo.likes_count,
      video_count: userInfo.video_count,
      is_verified: userInfo.is_verified,
      updated_at: new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('tiktok_accounts')
      .update(accountUpdate)
      .eq('id', accountRecord.id)

    if (updateError) {
      result.errors.push(`Account update failed: ${updateError.message}`)
    } else {
      result.accountUpdated = true
    }

    // 2. Create account snapshot for historical tracking
    const today = new Date().toISOString().split('T')[0]
    const { error: snapshotError } = await supabase
      .from('tiktok_account_snapshots')
      .upsert({
        account_id: accountRecord.id,
        snapshot_date: today,
        follower_count: accountUpdate.follower_count,
        following_count: accountUpdate.following_count,
        likes_count: accountUpdate.likes_count,
        video_count: accountUpdate.video_count
      }, {
        onConflict: 'account_id,snapshot_date'
      })

    if (snapshotError) {
      result.errors.push(`Snapshot creation failed: ${snapshotError.message}`)
    } else {
      result.snapshotCreated = true
    }

    // 3. Sync videos
    try {
      const videos = await api.getAllVideos(100)

      for (const video of videos) {
        const videoData = {
          account_id: accountRecord.id,
          video_id: video.id,
          title: video.title,
          description: video.video_description?.substring(0, 5000),
          create_time: video.create_time ? new Date(video.create_time * 1000).toISOString() : null,
          cover_image_url: video.cover_image_url,
          share_url: video.share_url,
          embed_link: video.embed_link,
          duration: video.duration,
          width: video.width,
          height: video.height,
          view_count: video.view_count,
          like_count: video.like_count,
          comment_count: video.comment_count,
          share_count: video.share_count,
        }

        const { error: videoError } = await supabase
          .from('tiktok_videos')
          .upsert(videoData, {
            onConflict: 'account_id,video_id'
          })

        if (!videoError) {
          result.videosSynced++
        }
      }
    } catch (videoErr: any) {
      result.errors.push(`Video sync failed: ${videoErr.message}`)
    }

    // Update last_sync_at on the connection
    await supabase
      .from('tiktok_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connectionId)

    result.success = result.errors.length === 0

  } catch (error: any) {
    result.errors.push(`Sync failed: ${error.message}`)
  }

  return result
}

// Sync all active connections (for scheduled jobs)
export async function syncAllAccounts(): Promise<{ synced: number; failed: number }> {
  const supabase = createServerClient()

  const { data: connections, error } = await supabase
    .from('tiktok_connections')
    .select('id')
    .eq('is_active', true)

  if (error || !connections) {
    console.error('Failed to fetch connections:', error)
    return { synced: 0, failed: 0 }
  }

  let synced = 0
  let failed = 0

  for (const connection of connections) {
    const result = await syncAccount(connection.id)
    if (result.success) {
      synced++
    } else {
      failed++
      console.error(`Sync failed for connection ${connection.id}:`, result.errors)
    }
  }

  return { synced, failed }
}
