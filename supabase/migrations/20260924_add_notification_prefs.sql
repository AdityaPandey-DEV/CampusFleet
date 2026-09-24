-- Add notification_preferences column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "allEmails": true,
  "notifDefault": true,
  "notifTrip": true,
  "notifBilling": true,
  "notifGeneral": true
}'::jsonb;
