-- Instagram OAuth Tables for CreatorRamp
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)

-- Instagram OAuth connections (via Facebook OAuth)
CREATE TABLE IF NOT EXISTS public.instagram_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instagram_user_id TEXT NOT NULL,
  facebook_page_id TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, instagram_user_id)
);

-- Instagram account metadata
CREATE TABLE IF NOT EXISTS public.instagram_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES instagram_connections(id) ON DELETE CASCADE,
  instagram_user_id TEXT NOT NULL,
  username TEXT,
  name TEXT,
  biography TEXT,
  profile_picture_url TEXT,
  website TEXT,
  followers_count BIGINT,
  follows_count BIGINT,
  media_count INTEGER,
  account_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id)
);

-- Historical snapshots for tracking over time
CREATE TABLE IF NOT EXISTS public.instagram_account_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  followers_count BIGINT,
  follows_count BIGINT,
  media_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, snapshot_date)
);

-- Media (posts, reels, carousels)
CREATE TABLE IF NOT EXISTS public.instagram_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL,
  media_type TEXT NOT NULL,
  media_product_type TEXT,
  caption TEXT,
  permalink TEXT,
  thumbnail_url TEXT,
  media_url TEXT,
  timestamp TIMESTAMPTZ,
  like_count BIGINT,
  comments_count BIGINT,
  plays_count BIGINT,
  reach BIGINT,
  saved BIGINT,
  shares BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, media_id)
);

-- Insights snapshots (28-day analytics)
CREATE TABLE IF NOT EXISTS public.instagram_insights_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  impressions BIGINT,
  reach BIGINT,
  profile_views BIGINT,
  website_clicks BIGINT,
  email_contacts BIGINT,
  phone_call_clicks BIGINT,
  get_directions_clicks BIGINT,
  audience_city_json JSONB,
  audience_country_json JSONB,
  audience_gender_age_json JSONB,
  audience_locale_json JSONB,
  online_followers_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, snapshot_date, period_start, period_end)
);

-- Enable Row Level Security
ALTER TABLE public.instagram_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_account_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_insights_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for instagram_connections
CREATE POLICY "Users can view own instagram connections"
  ON public.instagram_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own instagram connections"
  ON public.instagram_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own instagram connections"
  ON public.instagram_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own instagram connections"
  ON public.instagram_connections FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for instagram_accounts (access through connections)
CREATE POLICY "Users can view own instagram accounts"
  ON public.instagram_accounts FOR SELECT
  USING (
    connection_id IN (
      SELECT id FROM public.instagram_connections WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own instagram accounts"
  ON public.instagram_accounts FOR INSERT
  WITH CHECK (
    connection_id IN (
      SELECT id FROM public.instagram_connections WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own instagram accounts"
  ON public.instagram_accounts FOR UPDATE
  USING (
    connection_id IN (
      SELECT id FROM public.instagram_connections WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for instagram_account_snapshots
CREATE POLICY "Users can view own instagram account snapshots"
  ON public.instagram_account_snapshots FOR SELECT
  USING (
    account_id IN (
      SELECT ia.id FROM public.instagram_accounts ia
      JOIN public.instagram_connections conn ON ia.connection_id = conn.id
      WHERE conn.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own instagram account snapshots"
  ON public.instagram_account_snapshots FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT ia.id FROM public.instagram_accounts ia
      JOIN public.instagram_connections conn ON ia.connection_id = conn.id
      WHERE conn.user_id = auth.uid()
    )
  );

-- RLS Policies for instagram_media
CREATE POLICY "Users can view own instagram media"
  ON public.instagram_media FOR SELECT
  USING (
    account_id IN (
      SELECT ia.id FROM public.instagram_accounts ia
      JOIN public.instagram_connections conn ON ia.connection_id = conn.id
      WHERE conn.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own instagram media"
  ON public.instagram_media FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT ia.id FROM public.instagram_accounts ia
      JOIN public.instagram_connections conn ON ia.connection_id = conn.id
      WHERE conn.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own instagram media"
  ON public.instagram_media FOR UPDATE
  USING (
    account_id IN (
      SELECT ia.id FROM public.instagram_accounts ia
      JOIN public.instagram_connections conn ON ia.connection_id = conn.id
      WHERE conn.user_id = auth.uid()
    )
  );

-- RLS Policies for instagram_insights_snapshots
CREATE POLICY "Users can view own instagram insights"
  ON public.instagram_insights_snapshots FOR SELECT
  USING (
    account_id IN (
      SELECT ia.id FROM public.instagram_accounts ia
      JOIN public.instagram_connections conn ON ia.connection_id = conn.id
      WHERE conn.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own instagram insights"
  ON public.instagram_insights_snapshots FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT ia.id FROM public.instagram_accounts ia
      JOIN public.instagram_connections conn ON ia.connection_id = conn.id
      WHERE conn.user_id = auth.uid()
    )
  );

-- Auto-update updated_at timestamp triggers
CREATE TRIGGER update_instagram_accounts_updated_at
  BEFORE UPDATE ON public.instagram_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_instagram_media_updated_at
  BEFORE UPDATE ON public.instagram_media
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
