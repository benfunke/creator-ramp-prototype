-- YouTube OAuth Tables for CreatorRamp
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)

-- User profiles (auto-created on signup)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- YouTube OAuth tokens (encrypted)
CREATE TABLE IF NOT EXISTS public.youtube_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, channel_id)
);

-- Channel metadata
CREATE TABLE IF NOT EXISTS public.youtube_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES youtube_connections(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  title TEXT,
  description TEXT,
  custom_url TEXT,
  published_at TIMESTAMPTZ,
  thumbnail_url TEXT,
  banner_url TEXT,
  country TEXT,
  subscriber_count BIGINT,
  view_count BIGINT,
  video_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id)
);

-- Historical snapshots for tracking over time
CREATE TABLE IF NOT EXISTS public.youtube_channel_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES youtube_channels(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  subscriber_count BIGINT,
  view_count BIGINT,
  video_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, snapshot_date)
);

-- Video data
CREATE TABLE IF NOT EXISTS public.youtube_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES youtube_channels(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  title TEXT,
  description TEXT,
  published_at TIMESTAMPTZ,
  thumbnail_url TEXT,
  duration TEXT,
  privacy_status TEXT,
  tags TEXT[],
  view_count BIGINT,
  like_count BIGINT,
  comment_count BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, video_id)
);

-- Analytics snapshots
CREATE TABLE IF NOT EXISTS public.youtube_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES youtube_channels(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  watch_time_minutes BIGINT,
  average_view_duration_seconds INTEGER,
  views BIGINT,
  impressions BIGINT,
  click_through_rate DECIMAL(5,4),
  subscribers_gained INTEGER,
  subscribers_lost INTEGER,
  estimated_revenue_cents BIGINT,
  demographics_json JSONB,
  traffic_sources_json JSONB,
  geography_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, snapshot_date, period_start, period_end)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_channel_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for youtube_connections
CREATE POLICY "Users can view own connections"
  ON public.youtube_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connections"
  ON public.youtube_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connections"
  ON public.youtube_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own connections"
  ON public.youtube_connections FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for youtube_channels (access through connections)
CREATE POLICY "Users can view own channels"
  ON public.youtube_channels FOR SELECT
  USING (
    connection_id IN (
      SELECT id FROM public.youtube_connections WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own channels"
  ON public.youtube_channels FOR INSERT
  WITH CHECK (
    connection_id IN (
      SELECT id FROM public.youtube_connections WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own channels"
  ON public.youtube_channels FOR UPDATE
  USING (
    connection_id IN (
      SELECT id FROM public.youtube_connections WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for youtube_channel_snapshots
CREATE POLICY "Users can view own channel snapshots"
  ON public.youtube_channel_snapshots FOR SELECT
  USING (
    channel_id IN (
      SELECT yc.id FROM public.youtube_channels yc
      JOIN public.youtube_connections conn ON yc.connection_id = conn.id
      WHERE conn.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own channel snapshots"
  ON public.youtube_channel_snapshots FOR INSERT
  WITH CHECK (
    channel_id IN (
      SELECT yc.id FROM public.youtube_channels yc
      JOIN public.youtube_connections conn ON yc.connection_id = conn.id
      WHERE conn.user_id = auth.uid()
    )
  );

-- RLS Policies for youtube_videos
CREATE POLICY "Users can view own videos"
  ON public.youtube_videos FOR SELECT
  USING (
    channel_id IN (
      SELECT yc.id FROM public.youtube_channels yc
      JOIN public.youtube_connections conn ON yc.connection_id = conn.id
      WHERE conn.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own videos"
  ON public.youtube_videos FOR INSERT
  WITH CHECK (
    channel_id IN (
      SELECT yc.id FROM public.youtube_channels yc
      JOIN public.youtube_connections conn ON yc.connection_id = conn.id
      WHERE conn.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own videos"
  ON public.youtube_videos FOR UPDATE
  USING (
    channel_id IN (
      SELECT yc.id FROM public.youtube_channels yc
      JOIN public.youtube_connections conn ON yc.connection_id = conn.id
      WHERE conn.user_id = auth.uid()
    )
  );

-- RLS Policies for youtube_analytics_snapshots
CREATE POLICY "Users can view own analytics"
  ON public.youtube_analytics_snapshots FOR SELECT
  USING (
    channel_id IN (
      SELECT yc.id FROM public.youtube_channels yc
      JOIN public.youtube_connections conn ON yc.connection_id = conn.id
      WHERE conn.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own analytics"
  ON public.youtube_analytics_snapshots FOR INSERT
  WITH CHECK (
    channel_id IN (
      SELECT yc.id FROM public.youtube_channels yc
      JOIN public.youtube_connections conn ON yc.connection_id = conn.id
      WHERE conn.user_id = auth.uid()
    )
  );

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_youtube_channels_updated_at
  BEFORE UPDATE ON public.youtube_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_youtube_videos_updated_at
  BEFORE UPDATE ON public.youtube_videos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
