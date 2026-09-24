-- 1. Add photo_locked to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS photo_locked BOOLEAN DEFAULT false;

-- 2. Migrate existing data from students to users
UPDATE public.users u
SET 
  avatar_url = COALESCE(s.photo_url, u.avatar_url),
  photo_locked = COALESCE(s.photo_locked, false)
FROM public.students s
WHERE s.user_id = u.id;

-- 3. Drop columns from students
ALTER TABLE public.students DROP COLUMN IF EXISTS photo_url;
ALTER TABLE public.students DROP COLUMN IF EXISTS photo_locked;
