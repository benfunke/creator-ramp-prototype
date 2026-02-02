'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { formatTimeAgo } from '../../lib/utils';
import ConnectChannelModal from '../../components/ConnectChannelModal';
import ConnectedChannelsModal, { ChannelDetail } from '../../components/ConnectedChannelsModal';

// Hardcoded dashboard data
const dashboardData = {
  // 1. Creator State Snapshot
  currentStage: {
    name: 'Early Traction',
    description: 'You\'re building momentum with consistent content and growing engagement. Focus on audience retention and content experimentation.',
    stageIndex: 1, // 0: Starting Out, 1: Early Traction, 2: Growth Plateau, 3: Monetization Ramp, 4: Scaling
    stages: ['Starting Out', 'Early Traction', 'Growth Plateau', 'Monetization Ramp', 'Scaling']
  },
  monetizationReadiness: {
    score: 67,
    previousScore: 61,
    insight: 'Your engagement rate is your strongest asset — subscribers trust your recommendations.'
  },

  // 2. Progress & Opportunity
  progressData: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    userTrajectory: [12, 19, 28, 35, 48, 67],
    peerAverage: [15, 22, 29, 38, 45, 52]
  },
  challenges: [
    {
      name: 'Inconsistent Upload Schedule',
      explanation: 'Your posting frequency varies from 1-4 videos per week, making it harder for the algorithm to promote your content.',
      upside: '+23% projected subscriber growth with consistent 3x/week uploads'
    },
    {
      name: 'Low Click-Through Rate',
      explanation: 'Your thumbnails and titles are getting 4.2% CTR vs 6.8% average for your niche.',
      upside: '+$340/month potential ad revenue with improved CTR'
    },
    {
      name: 'Untapped Affiliate Revenue',
      explanation: 'You mention products but rarely include affiliate links or calls-to-action.',
      upside: '+$520/month estimated affiliate income'
    }
  ],

  // 3. Focus Metrics & Actions
  metrics: [
    {
      name: 'Watch Time (Hours)',
      value: '2,847',
      trend: 'up',
      trendValue: '+12%',
      explanation: 'At this stage, watch time signals content quality and directly impacts monetization eligibility.'
    },
    {
      name: 'Subscriber Growth Rate',
      value: '156/week',
      trend: 'up',
      trendValue: '+8%',
      explanation: 'Consistent growth indicates your content resonates. Key for unlocking sponsorship opportunities.'
    },
    {
      name: 'Engagement Rate',
      value: '8.4%',
      trend: 'up',
      trendValue: '+0.6%',
      explanation: 'High engagement means loyal audience. Brands pay premium for engaged creators.'
    },
    {
      name: 'Revenue per 1K Views',
      value: '$3.20',
      trend: 'down',
      trendValue: '-$0.15',
      explanation: 'RPM affects total earnings. Improving content targeting can boost this metric.'
    }
  ],
  actions: [
    {
      title: 'Create thumbnail A/B testing system',
      impact: 'Expect 15-25% CTR improvement within 4 weeks',
      timeHorizon: 'Week 1-2',
      dependency: null
    },
    {
      title: 'Set up affiliate accounts (Amazon, Impact)',
      impact: 'Unlock $400-600/month passive income stream',
      timeHorizon: 'Week 1',
      dependency: null
    },
    {
      title: 'Batch record 6 videos for consistent uploads',
      impact: 'Enables 3x/week schedule, +23% algorithm boost',
      timeHorizon: 'Week 2-3',
      dependency: null
    },
    {
      title: 'Add product links to top 10 performing videos',
      impact: 'Immediate revenue from existing traffic',
      timeHorizon: 'Week 3',
      dependency: 'Affiliate accounts setup'
    },
    {
      title: 'Create sponsorship media kit',
      impact: 'Required for brand deals at $500+ per video',
      timeHorizon: 'Week 4',
      dependency: null
    }
  ]
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isChannelsModalOpen, setIsChannelsModalOpen] = useState(false);
  const [channels, setChannels] = useState<ChannelDetail[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }
      setUser(session.user);

      // Fetch all channel connections with full details
      const { data: connections } = await supabase
        .from('youtube_connections')
        .select(`
          id,
          channel_id,
          last_sync_at,
          youtube_channels (
            title,
            thumbnail_url,
            subscriber_count,
            view_count,
            video_count
          )
        `)
        .eq('user_id', session.user.id)
        .eq('is_active', true);

      if (connections && connections.length > 0) {
        // Transform Supabase array result to single object for youtube_channels
        const transformedChannels: ChannelDetail[] = connections.map(conn => ({
          id: conn.id,
          channel_id: conn.channel_id,
          last_sync_at: conn.last_sync_at,
          youtube_channels: Array.isArray(conn.youtube_channels)
            ? conn.youtube_channels[0] || null
            : conn.youtube_channels
        }));
        setChannels(transformedChannels);

        // Find most recent sync time across all channels
        const mostRecentSync = connections
          .map(c => c.last_sync_at)
          .filter(Boolean)
          .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0];

        setLastSyncAt(mostRecentSync || null);
      }

      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  const scoreDelta = dashboardData.monetizationReadiness.score - dashboardData.monetizationReadiness.previousScore;

  return (
    <div className="dashboard-page">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Creator Dashboard</h1>
          <div className="header-actions">
            {channels.length > 0 && (
              <button
                className="channels-status-btn"
                onClick={() => setIsChannelsModalOpen(true)}
              >
                {channels.length} channel{channels.length !== 1 ? 's' : ''} connected
                {lastSyncAt && ` · Synced ${formatTimeAgo(lastSyncAt)}`}
              </button>
            )}
            <button onClick={() => setIsConnectModalOpen(true)} className="connect-channel-btn">
              + Connect Channel
            </button>
            <span className="user-email">{user?.email}</span>
            <button onClick={handleLogout} className="logout-btn">Log Out</button>
          </div>
        </div>
      </header>

      {/* Modals */}
      <ConnectChannelModal isOpen={isConnectModalOpen} onClose={() => setIsConnectModalOpen(false)} />
      <ConnectedChannelsModal
        isOpen={isChannelsModalOpen}
        onClose={() => setIsChannelsModalOpen(false)}
        channels={channels}
      />

      <main className="dashboard-main">
        {/* Section 1: Creator State Snapshot */}
        <section className="snapshot-section">
          {/* 1.1 Current Stage */}
          <div className="snapshot-card stage-card">
            <span className="card-label">Current Stage</span>
            <h2 className="stage-name">{dashboardData.currentStage.name}</h2>
            <p className="stage-description">{dashboardData.currentStage.description}</p>

            {/* Stage Stepper */}
            <div className="stage-stepper">
              {dashboardData.currentStage.stages.map((stage, index) => (
                <div key={stage} className="stage-step">
                  <div className={`step-dot ${index <= dashboardData.currentStage.stageIndex ? 'completed' : ''} ${index === dashboardData.currentStage.stageIndex ? 'current' : ''}`}>
                    {index < dashboardData.currentStage.stageIndex && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </div>
                  <span className={`step-label ${index === dashboardData.currentStage.stageIndex ? 'current' : ''}`}>
                    {stage}
                  </span>
                  {index < dashboardData.currentStage.stages.length - 1 && (
                    <div className={`step-connector ${index < dashboardData.currentStage.stageIndex ? 'completed' : ''}`}></div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 1.2 Monetization Readiness Score */}
          <div className="snapshot-card score-card">
            <span className="card-label">Monetization Readiness</span>
            <div className="score-display">
              <div className="score-ring">
                <svg viewBox="0 0 120 120">
                  <circle
                    className="score-ring-bg"
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    strokeWidth="12"
                  />
                  <circle
                    className="score-ring-progress"
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    strokeWidth="12"
                    strokeDasharray={`${(dashboardData.monetizationReadiness.score / 100) * 327} 327`}
                    transform="rotate(-90 60 60)"
                  />
                </svg>
                <div className="score-value">
                  <span className="score-number">{dashboardData.monetizationReadiness.score}</span>
                  <span className="score-max">/100</span>
                </div>
              </div>
              <div className="score-meta">
                <span className={`score-delta ${scoreDelta >= 0 ? 'positive' : 'negative'}`}>
                  {scoreDelta >= 0 ? '↑' : '↓'} {Math.abs(scoreDelta)} pts since last check
                </span>
                <p className="score-insight">{dashboardData.monetizationReadiness.insight}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Progress & Opportunity */}
        <section className="progress-section">
          {/* 2.1 Progress vs Similar Creators */}
          <div className="dashboard-card progress-chart-card">
            <h3>Progress vs Similar Creators</h3>
            <div className="chart-container">
              <div className="chart-legend">
                <span className="legend-item user">
                  <span className="legend-dot"></span> Your Growth
                </span>
                <span className="legend-item peer">
                  <span className="legend-dot"></span> Peer Average
                </span>
              </div>
              <div className="simple-chart">
                <div className="chart-y-axis">
                  <span>80</span>
                  <span>60</span>
                  <span>40</span>
                  <span>20</span>
                  <span>0</span>
                </div>
                <div className="chart-area">
                  {/* Peer Average Line (rendered first, behind) */}
                  <svg className="chart-svg" viewBox="0 0 300 100" preserveAspectRatio="none">
                    <polyline
                      className="chart-line peer"
                      points={dashboardData.progressData.peerAverage.map((val, i) =>
                        `${i * 60},${100 - (val / 80) * 100}`
                      ).join(' ')}
                      fill="none"
                    />
                    <polyline
                      className="chart-line user"
                      points={dashboardData.progressData.userTrajectory.map((val, i) =>
                        `${i * 60},${100 - (val / 80) * 100}`
                      ).join(' ')}
                      fill="none"
                    />
                  </svg>
                  <div className="chart-x-axis">
                    {dashboardData.progressData.labels.map(label => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="chart-note">Composite growth index based on subscribers, engagement, and revenue metrics</p>
            </div>
          </div>

          {/* 2.2 Biggest Challenges & Upside */}
          <div className="dashboard-card challenges-card">
            <h3>Biggest Constraints Right Now</h3>
            <div className="challenges-list">
              {dashboardData.challenges.map((challenge, index) => (
                <div key={index} className="challenge-item">
                  <div className="challenge-header">
                    <span className="challenge-number">{index + 1}</span>
                    <h4>{challenge.name}</h4>
                  </div>
                  <p className="challenge-explanation">{challenge.explanation}</p>
                  <div className="challenge-upside">
                    <span className="upside-icon">↗</span>
                    <span className="upside-text">{challenge.upside}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3: Focus Metrics & Action Plan */}
        <section className="focus-section">
          {/* 3.1 Metrics That Matter Now */}
          <div className="dashboard-card metrics-card">
            <h3>Metrics That Matter Now</h3>
            <div className="metrics-grid">
              {dashboardData.metrics.map((metric, index) => (
                <div key={index} className="metric-item">
                  <div className="metric-header">
                    <span className="metric-name">{metric.name}</span>
                    <span className={`metric-trend ${metric.trend}`}>
                      {metric.trend === 'up' ? '↑' : '↓'} {metric.trendValue}
                    </span>
                  </div>
                  <div className="metric-value">{metric.value}</div>
                  <p className="metric-explanation">{metric.explanation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 3.2 Best Next Actions & Timeline */}
          <div className="dashboard-card actions-card">
            <h3>Best Next Actions</h3>
            <div className="actions-timeline">
              {dashboardData.actions.map((action, index) => (
                <div key={index} className="action-item">
                  <div className="action-timeline-marker">
                    <div className="timeline-dot"></div>
                    {index < dashboardData.actions.length - 1 && <div className="timeline-line"></div>}
                  </div>
                  <div className="action-content">
                    <div className="action-header">
                      <h4>{action.title}</h4>
                      <span className="action-time">{action.timeHorizon}</span>
                    </div>
                    <p className="action-impact">{action.impact}</p>
                    {action.dependency && (
                      <span className="action-dependency">
                        Requires: {action.dependency}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
