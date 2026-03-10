-- Migration: Add Google OAuth Support
-- Run this SQL in your Supabase SQL Editor to add Google OAuth fields

-- Add google_id and profile_picture columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS profile_picture TEXT;

-- Make password field nullable (since OAuth users won't have passwords)
ALTER TABLE users 
ALTER COLUMN password DROP NOT NULL;

-- Create index for faster google_id lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Update comments
COMMENT ON COLUMN users.google_id IS 'Google OAuth unique identifier';
COMMENT ON COLUMN users.profile_picture IS 'URL to user profile picture from OAuth provider';
COMMENT ON COLUMN users.password IS 'Hashed password (NULL for OAuth users)';
