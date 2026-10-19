-- Migration: Alter maintenance_requests columns to TEXT
-- Allows custom bus IDs (e.g. 'bus-49'), non-UUID staff IDs, and flexible identifiers

ALTER TABLE maintenance_requests 
  ALTER COLUMN bus_id TYPE TEXT USING bus_id::TEXT,
  ALTER COLUMN requested_by TYPE TEXT USING requested_by::TEXT,
  ALTER COLUMN approved_by TYPE TEXT USING approved_by::TEXT;
