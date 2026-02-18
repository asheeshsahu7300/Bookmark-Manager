-- 1. Create bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(created_at DESC);

-- 3. Enable Row Level Security
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if they exist (for clean setup)
DROP POLICY IF EXISTS "Users can view their own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can insert their own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can delete their own bookmarks" ON bookmarks;

-- 5. Create RLS policies
CREATE POLICY "Users can view their own bookmarks"
  ON bookmarks
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bookmarks"
  ON bookmarks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarks"
  ON bookmarks
  FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Enable Realtime (for real-time updates across tabs)
ALTER PUBLICATION supabase_realtime ADD TABLE bookmarks;

-- 7. CRITICAL: Without this, DELETE events are silently dropped when using
--    filtered subscriptions (e.g. filter: user_id=eq.xxx) because Postgres
--    only sends the primary key by default. FULL sends all columns so the
--    user_id filter can match on delete events.
ALTER TABLE bookmarks REPLICA IDENTITY FULL;

-- 7. Verify setup
SELECT 'Setup completed successfully!' as status;
SELECT 'Total bookmarks tables: ' || count(*) as info
FROM information_schema.tables 
WHERE table_name = 'bookmarks';
