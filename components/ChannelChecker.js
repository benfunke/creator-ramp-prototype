'use client'

import { useState } from 'react'

const MOCK_RESULTS = {
  youtube: {
    platform: 'YouTube',
    subscribers: 850,
    subscriberGoal: 1000,
    watchHours: 3200,
    watchHoursGoal: 4000,
    eligible: false,
    message: 'You need 150 more subscribers and 800 more watch hours to qualify for the YouTube Partner Program.'
  },
  instagram: {
    platform: 'Instagram',
    followers: 8500,
    followerGoal: 10000,
    reelsPlays: 45000,
    reelsPlaysGoal: 100000,
    eligible: false,
    message: 'You need 1,500 more followers to qualify for Instagram monetization bonuses.'
  },
  tiktok: {
    platform: 'TikTok',
    followers: 12000,
    followerGoal: 10000,
    views: 85000,
    viewsGoal: 100000,
    eligible: false,
    message: 'You have enough followers! You need 15,000 more video views in the last 30 days to qualify for the TikTok Creator Fund.'
  }
}

function ProgressBar({ current, goal, label }) {
  const percentage = Math.min((current / goal) * 100, 100)
  return (
    <div className="progress-item">
      <div className="progress-label">
        <span>{label}</span>
        <span>{current.toLocaleString()} / {goal.toLocaleString()}</span>
      </div>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

export default function ChannelChecker() {
  const [platform, setPlatform] = useState('youtube')
  const [channelId, setChannelId] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleCheck = async (e) => {
    e.preventDefault()
    if (!channelId.trim()) return

    setLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setResult(MOCK_RESULTS[platform])
    setLoading(false)
  }

  const getPlaceholder = () => {
    switch (platform) {
      case 'youtube': return '@channelname or channel URL'
      case 'instagram': return '@username'
      case 'tiktok': return '@username'
      default: return 'Enter channel/username'
    }
  }

  return (
    <div className="checker-container">
      <h2>Check Your Monetization Progress</h2>
      <p className="checker-subtitle">See how close you are to earning money on your favorite platform</p>

      <form onSubmit={handleCheck}>
        <div className="platform-selector">
          <button
            type="button"
            className={`platform-btn ${platform === 'youtube' ? 'active' : ''}`}
            onClick={() => { setPlatform('youtube'); setResult(null) }}
          >
            YouTube
          </button>
          <button
            type="button"
            className={`platform-btn ${platform === 'instagram' ? 'active' : ''}`}
            onClick={() => { setPlatform('instagram'); setResult(null) }}
          >
            Instagram
          </button>
          <button
            type="button"
            className={`platform-btn ${platform === 'tiktok' ? 'active' : ''}`}
            onClick={() => { setPlatform('tiktok'); setResult(null) }}
          >
            TikTok
          </button>
        </div>

        <div className="form-group">
          <input
            type="text"
            placeholder={getPlaceholder()}
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
          />
        </div>

        <button type="submit" disabled={loading || !channelId.trim()}>
          {loading ? 'Checking...' : 'Check Progress'}
        </button>
      </form>

      {result && (
        <div className="result-card">
          <h3>{result.platform} Monetization Status</h3>

          {platform === 'youtube' && (
            <>
              <ProgressBar
                current={result.subscribers}
                goal={result.subscriberGoal}
                label="Subscribers"
              />
              <ProgressBar
                current={result.watchHours}
                goal={result.watchHoursGoal}
                label="Watch Hours (last 12 months)"
              />
            </>
          )}

          {platform === 'instagram' && (
            <>
              <ProgressBar
                current={result.followers}
                goal={result.followerGoal}
                label="Followers"
              />
              <ProgressBar
                current={result.reelsPlays}
                goal={result.reelsPlaysGoal}
                label="Reels Plays (last 60 days)"
              />
            </>
          )}

          {platform === 'tiktok' && (
            <>
              <ProgressBar
                current={result.followers}
                goal={result.followerGoal}
                label="Followers"
              />
              <ProgressBar
                current={result.views}
                goal={result.viewsGoal}
                label="Video Views (last 30 days)"
              />
            </>
          )}

          <p className="result-message">{result.message}</p>

          <p className="cta-text">
            Sign up to track your progress over time and get personalized tips!
          </p>
        </div>
      )}
    </div>
  )
}
