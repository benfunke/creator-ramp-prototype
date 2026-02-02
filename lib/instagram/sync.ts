import { createServerClient } from '../supabase-server'
import { InstagramGraphAPI } from './graph-api'

export interface SyncResult {
  success: boolean
  accountUpdated: boolean
  snapshotCreated: boolean
  mediaSynced: number
  insightsSynced: boolean
  errors: string[]
}

export async function syncAccount(connectionId: string): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    accountUpdated: false,
    snapshotCreated: false,
    mediaSynced: 0,
    insightsSynced: false,
    errors: []
  }

  const supabase = createServerClient()

  try {
    // Initialize API client
    const api = await InstagramGraphAPI.fromConnectionId(connectionId)

    // 1. Sync account info
    const accountInfo = await api.getAccountInfo()
    if (!accountInfo) {
      throw new Error('Failed to fetch account info')
    }

    // Get the internal account record
    const { data: accountRecord, error: accountFetchError } = await supabase
      .from('instagram_accounts')
      .select('id')
      .eq('connection_id', connectionId)
      .single()

    if (accountFetchError || !accountRecord) {
      throw new Error('Account record not found in database')
    }

    // Update account data
    const accountUpdate = {
      username: accountInfo.username,
      name: accountInfo.name,
      biography: accountInfo.biography,
      profile_picture_url: accountInfo.profile_picture_url,
      website: accountInfo.website,
      followers_count: accountInfo.followers_count,
      follows_count: accountInfo.follows_count,
      media_count: accountInfo.media_count,
      account_type: accountInfo.account_type,
      updated_at: new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('instagram_accounts')
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
      .from('instagram_account_snapshots')
      .upsert({
        account_id: accountRecord.id,
        snapshot_date: today,
        followers_count: accountUpdate.followers_count,
        follows_count: accountUpdate.follows_count,
        media_count: accountUpdate.media_count
      }, {
        onConflict: 'account_id,snapshot_date'
      })

    if (snapshotError) {
      result.errors.push(`Snapshot creation failed: ${snapshotError.message}`)
    } else {
      result.snapshotCreated = true
    }

    // 3. Sync media
    try {
      const media = await api.getMedia(100)

      for (const item of media) {
        // Get media-level insights
        const insights = await api.getMediaInsights(item.id, item.media_type)

        let playsCount = null
        let reach = null
        let saved = null
        let shares = null

        if (insights?.data) {
          for (const metric of insights.data) {
            if (metric.name === 'plays') playsCount = metric.values[0]?.value
            if (metric.name === 'reach') reach = metric.values[0]?.value
            if (metric.name === 'saved') saved = metric.values[0]?.value
            if (metric.name === 'shares') shares = metric.values[0]?.value
          }
        }

        const mediaData = {
          account_id: accountRecord.id,
          media_id: item.id,
          media_type: item.media_type,
          media_product_type: item.media_product_type,
          caption: item.caption?.substring(0, 5000),
          permalink: item.permalink,
          thumbnail_url: item.thumbnail_url,
          media_url: item.media_url,
          timestamp: item.timestamp,
          like_count: item.like_count,
          comments_count: item.comments_count,
          plays_count: playsCount,
          reach,
          saved,
          shares
        }

        const { error: mediaError } = await supabase
          .from('instagram_media')
          .upsert(mediaData, {
            onConflict: 'account_id,media_id'
          })

        if (!mediaError) {
          result.mediaSynced++
        }
      }
    } catch (mediaErr: any) {
      result.errors.push(`Media sync failed: ${mediaErr.message}`)
    }

    // 4. Sync insights
    try {
      const accountInsights = await api.getAccountInsights('days_28')
      const demographics = await api.getAudienceDemographics()
      const onlineFollowers = await api.getOnlineFollowers()

      if (accountInsights?.data) {
        const getValue = (name: string) => {
          const metric = accountInsights.data.find((m: any) => m.name === name)
          return metric?.values?.[0]?.value || null
        }

        const getDemographic = (name: string) => {
          if (!demographics?.data) return null
          const metric = demographics.data.find((m: any) => m.name === name)
          return metric?.values?.[0]?.value || null
        }

        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - 28)

        const insightsData = {
          account_id: accountRecord.id,
          snapshot_date: today,
          period_start: startDate.toISOString().split('T')[0],
          period_end: endDate.toISOString().split('T')[0],
          impressions: getValue('impressions'),
          reach: getValue('reach'),
          profile_views: getValue('profile_views'),
          website_clicks: getValue('website_clicks'),
          email_contacts: getValue('email_contacts'),
          phone_call_clicks: getValue('phone_call_clicks'),
          get_directions_clicks: getValue('get_directions_clicks'),
          audience_city_json: getDemographic('audience_city'),
          audience_country_json: getDemographic('audience_country'),
          audience_gender_age_json: getDemographic('audience_gender_age'),
          audience_locale_json: getDemographic('audience_locale'),
          online_followers_json: onlineFollowers?.data?.[0]?.values?.[0]?.value || null
        }

        const { error: insightsError } = await supabase
          .from('instagram_insights_snapshots')
          .upsert(insightsData, {
            onConflict: 'account_id,snapshot_date,period_start,period_end'
          })

        if (insightsError) {
          result.errors.push(`Insights save failed: ${insightsError.message}`)
        } else {
          result.insightsSynced = true
        }
      }
    } catch (insightsErr: any) {
      result.errors.push(`Insights sync failed: ${insightsErr.message}`)
    }

    // Update last_sync_at on the connection
    await supabase
      .from('instagram_connections')
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
    .from('instagram_connections')
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
