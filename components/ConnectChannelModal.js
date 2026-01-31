'use client'

import { useState } from 'react'

export default function ConnectChannelModal({ isOpen, onClose }) {
  const [selectedPlatform, setSelectedPlatform] = useState(null)

  if (!isOpen) return null

  const handleConnect = (platform) => {
    setSelectedPlatform(platform)
    // OAuth flow will go here later
    console.log(`Connecting to ${platform}...`)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Connect Your Channel</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            Connect your social media channel to track your monetization progress in real-time.
          </p>

          <div className="platform-grid">
            <button
              className="platform-connect-card youtube"
              onClick={() => handleConnect('youtube')}
            >
              <div className="platform-icon">▶</div>
              <h3>YouTube</h3>
              <p>Track subscribers & watch hours</p>
              <span className="connect-label">Connect</span>
            </button>

            <button
              className="platform-connect-card instagram"
              onClick={() => handleConnect('instagram')}
            >
              <div className="platform-icon">📷</div>
              <h3>Instagram</h3>
              <p>Track followers & reels plays</p>
              <span className="connect-label">Connect</span>
            </button>

            <button
              className="platform-connect-card tiktok"
              onClick={() => handleConnect('tiktok')}
            >
              <div className="platform-icon">🎵</div>
              <h3>TikTok</h3>
              <p>Track followers & video views</p>
              <span className="connect-label">Connect</span>
            </button>
          </div>

          {selectedPlatform && (
            <div className="oauth-placeholder">
              <p>🔒 OAuth flow for {selectedPlatform} will be implemented here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
