import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Supabase client that uses Next.js aggressive caching (revalidate every 1 hour)
// Used EXCLUSIVELY for static master data (Routes, Stops, Zones, Campuses)
export const supabaseCached = createClient(
  supabaseUrl,
  serviceRoleKey, // Use service key for fetching static data safely server-side
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: (url, options) => {
        return fetch(url, { 
          ...options, 
          next: { revalidate: 3600, tags: ['master-data'] } 
        });
      },
    },
  }
);
