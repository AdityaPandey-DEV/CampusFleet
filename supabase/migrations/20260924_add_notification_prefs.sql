-- Add notification_preferences column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "allEmails": true,
  "notifDefault": true,
  "notifTrip": true,
  "notifBilling": true,
  "notifGeneral": true
}'::jsonb;
