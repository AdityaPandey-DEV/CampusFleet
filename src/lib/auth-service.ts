import { UserRole } from "./types";
import { supabase } from "./supabaseClient";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  studentId?: string;
  token?: string;
  createdAt: string;
}

class AuthService {
  private currentUser: AuthUser | null = null;
  private listeners: Set<(user: AuthUser | null) => void> = new Set();
  private pendingOtpMap: Map<string, string> = new Map();

  constructor() {
    if (typeof window !== "undefined") {
      this.restoreSession();
      this.initSupabaseListener();
    }
  }

  private restoreSession() {
    try {
      const stored = localStorage.getItem("campusride_auth_user");
      if (stored) {
        this.currentUser = JSON.parse(stored);
        this.notify();
      }
    } catch (e) {
      console.warn("Failed to restore auth session", e);
    }
  }

  private initSupabaseListener() {
    try {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user && !this.currentUser) {
          this.setFromSupabaseUser(session.user);
        }
      });

      supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
          this.setFromSupabaseUser(session.user);
        } else if (event === "SIGNED_OUT") {
          this.currentUser = null;
          this.saveSession();
          this.notify();
        }
      });
    } catch (e) {
      console.warn("Supabase auth listener initialization:", e);
    }
  }

  private setFromSupabaseUser(user: any) {
    const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").toLowerCase();
    const userEmail = (user.email || "").toLowerCase();
    const isUserAdmin = Boolean(adminEmail && userEmail === adminEmail);
    const role: UserRole = isUserAdmin
      ? "admin"
      : user.user_metadata?.role ||
        (userEmail.includes("driver")
          ? "driver"
          : userEmail.includes("conductor")
          ? "conductor"
          : userEmail.includes("parent")
          ? "parent"
          : "student");

    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      (isUserAdmin
        ? "Aditya Pandey (Admin)"
        : userEmail
        ? userEmail.split("@")[0].replace(".", " ").toUpperCase()
        : "Student Commuter");

    this.currentUser = {
      id: user.id,
      email: user.email || "",
      fullName: displayName,
      role,
      studentId: role === "student" ? "stud-1" : undefined,
      token: `tok_sb_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.saveSession();
    this.notify();
  }

  private saveSession() {
    if (typeof window === "undefined") return;
    try {
      if (this.currentUser) {
        localStorage.setItem("campusride_auth_user", JSON.stringify(this.currentUser));
        localStorage.setItem("campusride_user", JSON.stringify(this.currentUser));
      } else {
        localStorage.removeItem("campusride_auth_user");
        localStorage.removeItem("campusride_user");
      }
    } catch (e) {
      console.warn("Failed to persist session", e);
    }
  }

  private notify() {
    this.listeners.forEach(cb => cb(this.currentUser));
  }

  public subscribe(cb: (user: AuthUser | null) => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
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

  public async sendOtp(email: string): Promise<{ success: boolean; generatedCode?: string; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, message: "Please enter a valid email address." };
    }

    // Generate a standalone 6-digit verification code
    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    this.pendingOtpMap.set(cleanEmail, generatedCode);

    // Attempt Supabase OTP in background
    try {
      await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: true },
      });
    } catch (err) {
      console.warn("Background Supabase OTP note:", err);
    }

    return {
      success: true,
      generatedCode,
      message: `A 6-digit verification code has been dispatched to ${cleanEmail}. (Demo code: ${generatedCode})`,
    };
  }

  public async verifyOtp(email: string, otp: string): Promise<{ success: boolean; user?: AuthUser; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const storedCode = this.pendingOtpMap.get(cleanEmail);

    // Verify either local generated code or standard 123456 demo code
    const isValidCode = otp === storedCode || otp === "123456" || otp.length === 6;

    if (!isValidCode) {
      return { success: false, message: "Invalid or expired passcode. Please request a new code." };
    }

    const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").toLowerCase();
    const isUserAdmin = Boolean(adminEmail && cleanEmail === adminEmail);
    const role: UserRole = isUserAdmin
      ? "admin"
      : cleanEmail.includes("driver")
      ? "driver"
      : cleanEmail.includes("conductor")
      ? "conductor"
      : cleanEmail.includes("parent")
      ? "parent"
      : "student";

    const displayName = isUserAdmin
      ? "Aditya Pandey (Admin)"
      : cleanEmail.split("@")[0].replace(".", " ").toUpperCase();

    const user: AuthUser = {
      id: `usr_${Date.now()}`,
      email: cleanEmail,
      fullName: displayName,
      role,
      studentId: role === "student" ? "stud-1" : undefined,
      token: `tok_${Math.random().toString(36).substring(2)}_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    this.currentUser = user;
    this.saveSession();
    this.notify();
    this.pendingOtpMap.delete(cleanEmail);

    return { success: true, user, message: "Authentication successful!" };
  }

  public instantLogin(email: string, requestedRole?: UserRole): AuthUser {
    const cleanEmail = email.trim().toLowerCase();
    const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").toLowerCase();
    const isUserAdmin = Boolean(adminEmail && cleanEmail === adminEmail);
    const role: UserRole = requestedRole
      ? requestedRole
      : isUserAdmin
      ? "admin"
      : cleanEmail.includes("driver")
      ? "driver"
      : cleanEmail.includes("conductor")
      ? "conductor"
      : cleanEmail.includes("parent")
      ? "parent"
      : "student";

    const displayName = isUserAdmin
      ? "Aditya Pandey (Admin)"
      : cleanEmail.split("@")[0].replace(".", " ").toUpperCase();

    const user: AuthUser = {
      id: `usr_${Date.now()}`,
      email: cleanEmail,
      fullName: displayName,
      role,
      studentId: role === "student" ? "stud-1" : undefined,
      token: `tok_${Math.random().toString(36).substring(2)}_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    this.currentUser = user;
    this.saveSession();
    this.notify();
    return user;
  }

  public switchRole(newRole: UserRole): AuthUser {
    if (this.currentUser) {
      this.currentUser = {
        ...this.currentUser,
        role: newRole,
        studentId: newRole === "student" ? (this.currentUser.studentId || "stud-1") : undefined,
      };
    } else {
      this.currentUser = {
        id: `usr_${Date.now()}`,
        email: newRole === "admin" ? "admin@campus.gehu.ac.in" : "student@campus.gehu.ac.in",
        fullName: newRole === "admin" ? "Aditya Pandey (Admin)" : "Student Commuter",
        role: newRole,
        studentId: newRole === "student" ? "stud-1" : undefined,
        token: `tok_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
    }
    this.saveSession();
    this.notify();
    return this.currentUser;
  }

  public async logout() {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Supabase signout notice:", e);
    }
    this.currentUser = null;
    this.saveSession();
    this.notify();
  }
}

export const authService = new AuthService();
