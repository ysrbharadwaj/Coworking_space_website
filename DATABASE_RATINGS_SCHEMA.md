# Database Schema for Ratings

Add this table to your Supabase database:

## workspace_ratings table

```sql
CREATE TABLE workspace_ratings (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT REFERENCES workspaces(id) ON DELETE CASCADE,
  booking_id BIGINT REFERENCES bookings(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_email TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_workspace_ratings_workspace ON workspace_ratings(workspace_id);
CREATE INDEX idx_workspace_ratings_booking ON workspace_ratings(booking_id);

-- Enable Row Level Security (optional)
ALTER TABLE workspace_ratings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read ratings
CREATE POLICY "Anyone can view ratings" ON workspace_ratings
  FOR SELECT USING (true);

-- Create policy to allow anyone to insert ratings
CREATE POLICY "Anyone can add ratings" ON workspace_ratings
  FOR INSERT WITH CHECK (true);
```

## Run this SQL in Supabase SQL Editor

1. Go to your Supabase project
2. Navigate to SQL Editor
3. Copy and paste the above SQL
4. Click "Run" to create the table

This will create the ratings table with:
- Rating validation (1-5 stars)
- Link to workspace and booking
- User information
- Review text
- Timestamps
- Proper indexes and security policies
