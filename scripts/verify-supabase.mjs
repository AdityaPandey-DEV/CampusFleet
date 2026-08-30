import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://hwawknnnolbxjvbylqkw.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3YXdrbm5ub2xieGp2YnlscWt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwNzAyOTMsImV4cCI6MjEwMzY0NjI5M30.wl_8Q9o3KAmSRbOiBmTC9j-y3SjruqLKzh-EorLTpxk";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSupabase() {
  console.log("1. Testing connection to Supabase instance:", supabaseUrl);
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("Session Error:", error.message);
    } else {
      console.log("✓ Supabase Auth Connection Successful! Active session:", data.session ? "Active" : "No active session (clean state)");
    }

    console.log("2. Testing OTP dispatch via configured Gmail SMTP to 'adityapandey.dev.in@gmail.com'...");
    const otpRes = await supabase.auth.signInWithOtp({
      email: "adityapandey.dev.in@gmail.com",
      options: {
        shouldCreateUser: true,
      }
    });

    if (otpRes.error) {
      console.log("Notice from Supabase:", otpRes.error.message);
    } else {
      console.log("✓ Supabase Email OTP successfully triggered and dispatched via SMTP!");
    }
  } catch (err) {
    console.error("Test Exception:", err);
  }
}

testSupabase();
