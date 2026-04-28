-- Migration: Supabase Storage → ImageKit for Video Stories
-- Adds ImageKit fileId tracking columns to stories_videos.
-- Run this in Supabase SQL Editor.

ALTER TABLE stories_videos
  ADD COLUMN IF NOT EXISTS imagekit_file_id TEXT,
  ADD COLUMN IF NOT EXISTS imagekit_thumbnail_file_id TEXT;

-- Optional helper index for the migration script's "where imagekit_file_id is null" filter.
-- Useful while running the one-shot migrate script; can be dropped after migration.
CREATE INDEX IF NOT EXISTS idx_stories_videos_imagekit_file_id_null
  ON stories_videos (id)
  WHERE imagekit_file_id IS NULL;
