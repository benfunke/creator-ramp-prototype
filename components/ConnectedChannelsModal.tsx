'use client'

import { formatTimeAgo, formatNumber } from '../lib/utils'

export interface ChannelDetail {
  id: string
  channel_id: string
  last_sync_at: string | null
  youtube_channels: {
    title: string
    thumbnail_url: string | null
    subscriber_count: number
    view_count: number
    video_count: number
  } | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  channels: ChannelDetail[]
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
            channels.map((channel) => (
              <div key={channel.id} className="channel-card">
                <div className="channel-card-header">
                  {channel.youtube_channels?.thumbnail_url ? (
                    <img
                      src={channel.youtube_channels.thumbnail_url}
                      alt=""
                      className="channel-card-avatar"
                    />
                  ) : (
                    <div className="channel-card-avatar placeholder">YT</div>
                  )}
                  <div className="channel-card-info">
                    <span className="channel-card-name">
                      {channel.youtube_channels?.title || 'YouTube Channel'}
                    </span>
                    <span className="channel-card-platform">YouTube</span>
                  </div>
                </div>
                <div className="channel-card-stats">
                  <div className="stat">
                    <span className="stat-value">
                      {formatNumber(channel.youtube_channels?.subscriber_count || 0)}
                    </span>
                    <span className="stat-label">subscribers</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">
                      {formatNumber(channel.youtube_channels?.view_count || 0)}
                    </span>
                    <span className="stat-label">views</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">
                      {channel.youtube_channels?.video_count || 0}
                    </span>
                    <span className="stat-label">videos</span>
                  </div>
                </div>
                {channel.last_sync_at && (
                  <span className="channel-card-sync">
                    Synced {formatTimeAgo(channel.last_sync_at)}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
