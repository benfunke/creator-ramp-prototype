'use client'

import { formatTimeAgo, formatNumber } from '../lib/utils'

export type Platform = 'youtube' | 'instagram' | 'tiktok'

export interface ChannelDetail {
  id: string
  platform: Platform
  last_sync_at: string | null
  // Platform-specific data
  title: string
  username?: string
  thumbnail_url: string | null
  follower_count: number
  view_count?: number
  video_count?: number
  media_count?: number
  likes_count?: number
}

interface Props {
  isOpen: boolean
  onClose: () => void
  channels: ChannelDetail[]
}

const platformConfig: Record<Platform, { label: string; color: string; icon: string }> = {
  youtube: { label: 'YouTube', color: '#FF0000', icon: 'YT' },
  instagram: { label: 'Instagram', color: '#E4405F', icon: 'IG' },
  tiktok: { label: 'TikTok', color: '#000000', icon: 'TT' },
}

export default function ConnectedChannelsModal({ isOpen, onClose, channels }: Props) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="channels-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Connected Channels</h2>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>

        <div className="channels-list">
          {channels.length === 0 ? (
            <p className="no-channels">No channels connected yet.</p>
          ) : (
            channels.map((channel) => {
              const config = platformConfig[channel.platform]
              return (
                <div key={`${channel.platform}-${channel.id}`} className="channel-card">
                  <div className="channel-card-header">
                    {channel.thumbnail_url ? (
                      <img
                        src={channel.thumbnail_url}
                        alt=""
                        className="channel-card-avatar"
                      />
                    ) : (
                      <div
                        className="channel-card-avatar placeholder"
                        style={{ backgroundColor: config.color, color: '#fff' }}
                      >
                        {config.icon}
                      </div>
                    )}
                    <div className="channel-card-info">
                      <span className="channel-card-name">
                        {channel.title || channel.username || 'Unknown'}
                      </span>
                      <span
                        className="channel-card-platform"
                        style={{ color: config.color }}
                      >
                        {config.label}
                      </span>
                    </div>
                  </div>
                  <div className="channel-card-stats">
                    <div className="stat">
                      <span className="stat-value">
                        {formatNumber(channel.follower_count || 0)}
                      </span>
                      <span className="stat-label">
                        {channel.platform === 'youtube' ? 'subscribers' : 'followers'}
                      </span>
                    </div>
                    {channel.view_count !== undefined && (
                      <div className="stat">
                        <span className="stat-value">
                          {formatNumber(channel.view_count)}
                        </span>
                        <span className="stat-label">views</span>
                      </div>
                    )}
                    {channel.likes_count !== undefined && (
                      <div className="stat">
                        <span className="stat-value">
                          {formatNumber(channel.likes_count)}
                        </span>
                        <span className="stat-label">likes</span>
                      </div>
                    )}
                    <div className="stat">
                      <span className="stat-value">
                        {channel.video_count ?? channel.media_count ?? 0}
                      </span>
                      <span className="stat-label">
                        {channel.platform === 'instagram' ? 'posts' : 'videos'}
                      </span>
                    </div>
                  </div>
                  {channel.last_sync_at && (
                    <span className="channel-card-sync">
                      Synced {formatTimeAgo(channel.last_sync_at)}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
