
CREATE TABLE IF NOT EXISTS public.posts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT,
    body TEXT NOT NULL,
    language TEXT DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read posts" ON public.posts;
DROP POLICY IF EXISTS "Anyone can create posts" ON public.posts;

CREATE POLICY "Anyone can read posts"
ON public.posts
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can create posts"
ON public.posts
FOR INSERT
TO anon, authenticated
WITH CHECK (
    char_length(body) BETWEEN 1 AND 5000
);

GRANT SELECT, INSERT ON public.posts TO anon, authenticated;

GRANT USAGE, SELECT
ON SEQUENCE public.posts_id_seq
TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
