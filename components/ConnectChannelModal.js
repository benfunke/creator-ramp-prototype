'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ConnectChannelModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState(null)

  if (!isOpen) return null

  const handleYouTubeConnect = async () => {
    setLoading('youtube')
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Please log in first')
      }

      const response = await fetch('/api/auth/youtube', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to initiate YouTube connection')
      }

      const { authUrl } = await response.json()

      // Redirect to Google OAuth
      window.location.href = authUrl

    } catch (err) {
      setError(err.message || 'Connection failed')
      setLoading(null)
    }
  }

  const handleInstagramConnect = async () => {
    setLoading('instagram')
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Please log in first')
      }

      const response = await fetch('/api/auth/instagram', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to initiate Instagram connection')
      }

      const { authUrl } = await response.json()

      // Redirect to Facebook OAuth
      window.location.href = authUrl

    } catch (err) {
      setError(err.message || 'Connection failed')
      setLoading(null)
    }
  }

  const handleTikTokConnect = async () => {
    setLoading('tiktok')
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Please log in first')
      }

      const response = await fetch('/api/auth/tiktok', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to initiate TikTok connection')
      }

      const { authUrl } = await response.json()

      // Redirect to TikTok OAuth
      window.location.href = authUrl

    } catch (err) {
      setError(err.message || 'Connection failed')
      setLoading(null)
    }
  }

  const handleConnect = (platform) => {
    if (platform === 'youtube') {
      handleYouTubeConnect()
    } else if (platform === 'instagram') {
      handleInstagramConnect()
    } else if (platform === 'tiktok') {
      handleTikTokConnect()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Connect Your Channel</h2>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            Connect your social media channel to track your monetization progress in real-time.
          </p>

          {error && (
            <div style={{
              padding: '0.75rem',
              background: '#f8d7da',
              color: '#721c24',
              borderRadius: '6px',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}

          <div className="platform-grid">
            <button
              className="platform-connect-card youtube"
              onClick={() => handleConnect('youtube')}
              disabled={loading === 'youtube'}
            >
              <div className="platform-icon">▶</div>
              <h3>YouTube</h3>
              <p>Track subscribers & watch hours</p>
              <span className="connect-label">
                {loading === 'youtube' ? 'Connecting...' : 'Connect'}
              </span>
            </button>

            <button
              className="platform-connect-card instagram"
              onClick={() => handleConnect('instagram')}
              disabled={loading === 'instagram'}
            >
              <div className="platform-icon">📷</div>
              <h3>Instagram</h3>
              <p>Track followers & reels plays</p>
              <span className="connect-label">
                {loading === 'instagram' ? 'Connecting...' : 'Connect'}
              </span>
            </button>

            <button
              className="platform-connect-card tiktok"
              onClick={() => handleConnect('tiktok')}
              disabled={loading === 'tiktok'}
            >
              <div className="platform-icon">🎵</div>
              <h3>TikTok</h3>
              <p>Track followers & video views</p>
              <span className="connect-label">
                {loading === 'tiktok' ? 'Connecting...' : 'Connect'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
