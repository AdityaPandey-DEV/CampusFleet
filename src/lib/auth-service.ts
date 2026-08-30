import { UserRole } from "./types";
import { supabase } from "./supabaseClient";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  studentId?: string;
  campus?: string;
  avatarUrl?: string;
  token?: string;
  createdAt: string;
}

class AuthService {
  private currentUser: AuthUser | null = null;
  private listeners: Set<(user: AuthUser | null) => void> = new Set();
  private initialized = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.initialize();
    }
  }

  private async initialize() {
    // 1. Restore from Supabase session (the single source of truth)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await this.resolveUserFromSupabase(session.user);
      } else {
        // Try localStorage fallback for OTP-verified users
        this.restoreLocalSession();
      }
    } catch (e) {
      console.warn("Auth init: Supabase session check failed, using local fallback", e);
      this.restoreLocalSession();
    }
    this.initialized = true;

    // 2. Listen for future auth state changes (login, logout, token refresh)
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        await this.resolveUserFromSupabase(session.user);
      } else if (event === "SIGNED_OUT") {
        this.currentUser = null;
        this.clearLocalSession();
        this.notify();
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        await this.resolveUserFromSupabase(session.user);
      }
    });
  }

  /**
   * Resolves user role and profile from the `public.users` table.
   * If user doesn't exist in the DB, inserts a new row with default "student" role.
   */
  private async resolveUserFromSupabase(supabaseUser: any) {
    const email = (supabaseUser.email || "").toLowerCase();
    const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").toLowerCase();

    // 1. Check if user exists in our users table
    let role: UserRole = "student";
    let fullName = supabaseUser.user_metadata?.full_name
      || supabaseUser.user_metadata?.name
      || email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    let campus = "GEHU Bhimtal";

    try {
      const { data: existingUser } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

      if (existingUser) {
        role = existingUser.role || "student";
        fullName = existingUser.full_name || fullName;
        campus = existingUser.campus || campus;
      } else {
        // New user — determine role and insert
        if (adminEmail && email === adminEmail) {
          role = "admin";
        }

        await supabase.from("users").insert({
          id: supabaseUser.id,
          email,
          full_name: fullName,
          role,
          campus,
          provider: supabaseUser.app_metadata?.provider || "email",
        });
      }
    } catch (e) {
      // If DB query fails, use email-based fallback for admin
      if (adminEmail && email === adminEmail) {
        role = "admin";
      }
      console.warn("User DB lookup failed, using fallback role:", e);
    }

    this.currentUser = {
      id: supabaseUser.id,
      email,
      fullName,
      role,
      campus,
      avatarUrl: supabaseUser.user_metadata?.avatar_url,
      studentId: role === "student" ? supabaseUser.id : undefined,
      token: `tok_sb_${Date.now()}`,
      createdAt: supabaseUser.created_at || new Date().toISOString(),
    };

    this.saveLocalSession();
    this.notify();
  }

  // ─── Session Persistence ────────────────────────────────────────────

  private saveLocalSession() {
    if (typeof window === "undefined") return;
    try {
      if (this.currentUser) {
        localStorage.setItem("campusfleet_auth_user", JSON.stringify(this.currentUser));
      }
    } catch (e) {
      console.warn("Failed to save session", e);
    }
  }

  private restoreLocalSession() {
    try {
      const stored = localStorage.getItem("campusfleet_auth_user") || localStorage.getItem("campusride_auth_user");
      if (stored) {
        this.currentUser = JSON.parse(stored);
        this.notify();
      }
    } catch (e) {
      console.warn("Failed to restore session", e);
    }
  }

  private clearLocalSession() {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem("campusfleet_auth_user");
      localStorage.removeItem("campusride_auth_user");
    } catch (e) {
      console.warn("Failed to clear session", e);
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────

  public subscribe(cb: (user: AuthUser | null) => void) {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  private notify() {
    this.listeners.forEach(cb => cb(this.currentUser));
  }

  public getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  public getTargetRouteForRole(role: UserRole): string {
    switch (role) {
      case "admin":
      case "transport_manager":
        return "/admin";
      case "driver":
        return "/staff/driver";
      case "conductor":
        return "/staff/conductor";
      default:
        return "/portal";
    }
  }

  // ─── Auth Methods ───────────────────────────────────────────────────

  /**
   * Sign in with Google OAuth via Supabase (real redirect flow).
   */
  public async signInWithGoogle(): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        return { success: false, message: error.message };
      }
      return { success: true, message: "Redirecting to Google..." };
    } catch (e: any) {
      return { success: false, message: e.message || "Google OAuth failed" };
    }
  }

  /**
   * Send a magic link / OTP email via Supabase Auth.
   * Supabase handles the email delivery and token validation server-side.
   */
  public async sendOtp(email: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, message: "Please enter a valid email address." };
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        return { success: false, message: error.message };
      }

      return {
        success: true,
        message: `A verification link has been sent to ${cleanEmail}. Check your inbox and click the link to sign in.`,
      };
    } catch (e: any) {
      return { success: false, message: e.message || "Failed to send verification email." };
    }
  }

  /**
   * Verify OTP token entered by user (Supabase server-side validation).
   */
  public async verifyOtp(email: string, token: string): Promise<{ success: boolean; user?: AuthUser; message: string }> {
    const cleanEmail = email.trim().toLowerCase();

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token,
        type: "email",
      });

      if (error) {
        return { success: false, message: error.message || "Invalid or expired code. Please request a new one." };
      }

      if (data?.user) {
        await this.resolveUserFromSupabase(data.user);
        return { success: true, user: this.currentUser!, message: "Authentication successful!" };
      }

      return { success: false, message: "Verification failed. Please try again." };
    } catch (e: any) {
      return { success: false, message: e.message || "Verification failed." };
    }
  }

  /**
   * Direct login for development/demo — creates a local session without Supabase auth.
   * This should ONLY be used as fallback when Supabase auth is not configured.
   */
  public instantLogin(email: string, requestedRole?: UserRole): AuthUser {
    const cleanEmail = email.trim().toLowerCase();
    const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").toLowerCase();
    const isUserAdmin = Boolean(adminEmail && cleanEmail === adminEmail);

    const role: UserRole = requestedRole
      ? requestedRole
      : isUserAdmin ? "admin" : "student";

    const displayName = isUserAdmin
      ? "Aditya Pandey (Admin)"
      : cleanEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

    const user: AuthUser = {
      id: `usr_${Date.now()}`,
      email: cleanEmail,
      fullName: displayName,
      role,
      campus: "GEHU Bhimtal",
      studentId: role === "student" ? `stud_${Date.now()}` : undefined,
      token: `tok_local_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    this.currentUser = user;
    this.saveLocalSession();
    this.notify();

    // Also persist to users table in background
    supabase.from("users").upsert({
      id: user.id,
      email: cleanEmail,
      full_name: user.fullName,
      role,
      campus: user.campus,
      provider: "local",
    }).then(() => {}, () => {});

    return user;
  }

  /**
   * Update user profile in both local state and Supabase users table.
   */
  public async updateProfile(updates: { fullName?: string; campus?: string; primaryStopId?: string }): Promise<void> {
    if (!this.currentUser) return;

    this.currentUser = {
      ...this.currentUser,
      fullName: updates.fullName || this.currentUser.fullName,
      campus: updates.campus || this.currentUser.campus,
    };
    this.saveLocalSession();
    this.notify();

    try {
      await supabase.from("users").update({
        full_name: this.currentUser.fullName,
        campus: this.currentUser.campus,
      }).eq("id", this.currentUser.id);
    } catch (e) {
      console.warn("Profile update to DB failed:", e);
    }
  }

  /**
   * Sign out from both Supabase and local session.
   */
  public async logout() {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Supabase signout:", e);
    }
    this.currentUser = null;
    this.clearLocalSession();
    this.notify();
  }
}

export const authService = new AuthService();
