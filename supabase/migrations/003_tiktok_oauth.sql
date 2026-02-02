-- TikTok OAuth Tables for CreatorRamp
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)

-- TikTok OAuth connections
CREATE TABLE IF NOT EXISTS public.tiktok_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tiktok_open_id TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, tiktok_open_id)
);

-- TikTok account metadata
CREATE TABLE IF NOT EXISTS public.tiktok_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES tiktok_connections(id) ON DELETE CASCADE,
  tiktok_open_id TEXT NOT NULL,
  union_id TEXT,
  username TEXT,
  display_name TEXT,
  bio_description TEXT,
  avatar_url TEXT,
  avatar_large_url TEXT,
  profile_deep_link TEXT,
  follower_count BIGINT,
  following_count BIGINT,
  likes_count BIGINT,
  video_count INTEGER,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id)
);

-- Historical snapshots for tracking over time
CREATE TABLE IF NOT EXISTS public.tiktok_account_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES tiktok_accounts(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  follower_count BIGINT,
  following_count BIGINT,
  likes_count BIGINT,
  video_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, snapshot_date)
);

-- Videos
CREATE TABLE IF NOT EXISTS public.tiktok_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES tiktok_accounts(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  title TEXT,
  description TEXT,
  create_time TIMESTAMPTZ,
  cover_image_url TEXT,
  share_url TEXT,
  embed_link TEXT,
  duration INTEGER,
  width INTEGER,
  height INTEGER,
  view_count BIGINT,
  like_count BIGINT,
  comment_count BIGINT,
  share_count BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, video_id)
);

-- Enable Row Level Security
ALTER TABLE public.tiktok_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_account_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tiktok_connections
CREATE POLICY "Users can view own tiktok connections"
  ON public.tiktok_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tiktok connections"
  ON public.tiktok_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tiktok connections"
  ON public.tiktok_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tiktok connections"
  ON public.tiktok_connections FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for tiktok_accounts (access through connections)
CREATE POLICY "Users can view own tiktok accounts"
  ON public.tiktok_accounts FOR SELECT
  USING (
    connection_id IN (
      SELECT id FROM public.tiktok_connections WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own tiktok accounts"
  ON public.tiktok_accounts FOR INSERT
  WITH CHECK (
    connection_id IN (
      SELECT id FROM public.tiktok_connections WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own tiktok accounts"
  ON public.tiktok_accounts FOR UPDATE
  USING (
    connection_id IN (
      SELECT id FROM public.tiktok_connections WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for tiktok_account_snapshots
CREATE POLICY "Users can view own tiktok account snapshots"
  ON public.tiktok_account_snapshots FOR SELECT
  USING (
    account_id IN (
      SELECT ta.id FROM public.tiktok_accounts ta
      JOIN public.tiktok_connections conn ON ta.connection_id = conn.id
      WHERE conn.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own tiktok account snapshots"
  ON public.tiktok_account_snapshots FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT ta.id FROM public.tiktok_accounts ta
      JOIN public.tiktok_connections conn ON ta.connection_id = conn.id
      WHERE conn.user_id = auth.uid()
    )
  );

-- RLS Policies for tiktok_videos
CREATE POLICY "Users can view own tiktok videos"
  ON public.tiktok_videos FOR SELECT
  USING (
    account_id IN (
      SELECT ta.id FROM public.tiktok_accounts ta
      JOIN public.tiktok_connections conn ON ta.connection_id = conn.id
      WHERE conn.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own tiktok videos"
  ON public.tiktok_videos FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT ta.id FROM public.tiktok_accounts ta
      JOIN public.tiktok_connections conn ON ta.connection_id = conn.id
      WHERE conn.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own tiktok videos"
  ON public.tiktok_videos FOR UPDATE
  USING (
    account_id IN (
      SELECT ta.id FROM public.tiktok_accounts ta
      JOIN public.tiktok_connections conn ON ta.connection_id = conn.id
      WHERE conn.user_id = auth.uid()
    )
  );

-- Auto-update updated_at timestamp triggers
CREATE TRIGGER update_tiktok_accounts_updated_at
  BEFORE UPDATE ON public.tiktok_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_tiktok_videos_updated_at
  BEFORE UPDATE ON public.tiktok_videos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
