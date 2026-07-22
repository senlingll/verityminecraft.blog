-- Migration: Add anonymous API rate limiting for attractiveness test
-- Created: 2025-01-XX

CREATE TABLE IF NOT EXISTS anonymous_api_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,
  api_endpoint TEXT NOT NULL,
  call_count INTEGER DEFAULT 0,
  last_call_date TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_anonymous_limits_identifier_endpoint 
ON anonymous_api_limits(identifier, api_endpoint, last_call_date);

-- Create unique constraint to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_anonymous_limits_unique
ON anonymous_api_limits(identifier, api_endpoint);
