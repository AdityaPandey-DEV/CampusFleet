import { NextRequest, NextResponse } from "next/server";
import { signToken, createSessionCookie } from "@/lib/jwt";
import { supabaseAdmin } from "@/lib/supabaseClient";

/**
 * POST /api/auth/login
 * Email + password login. Verifies credentials against the users table.
 * Falls back to OTP-only flow if password_hash is not set.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    const cleanEmail = (email || "").trim().toLowerCase();

    if (!cleanEmail) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Look up user in database
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", cleanEmail)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: "No account found with this email. Please sign up first." },
        { status: 404 }
      );
    }

    // If user has a password hash, verify it
    if (user.password_hash && password) {
      const bcrypt = await import("bcryptjs");
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return NextResponse.json({ error: "Invalid password" }, { status: 401 });
      }
    }

    // Create JWT session
    const token = await signToken({
      userId: user.id,
      email: user.email,
      fullName: user.full_name || cleanEmail.split("@")[0],
      role: user.role || "student",
      campus: user.campus || "GEHU Bhimtal",
      avatarUrl: user.avatar_url,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name || cleanEmail.split("@")[0],
        role: user.role || "student",
        campus: user.campus || "GEHU Bhimtal",
        avatarUrl: user.avatar_url,
        studentId: user.role === "student" ? user.id : undefined,
        token: `tok_jwt_${Date.now()}`,
        createdAt: user.created_at || new Date().toISOString(),
      },
    });

    response.headers.set("Set-Cookie", createSessionCookie(token));
    return response;
  } catch (e: any) {
    console.error("Login error:", e);
    return NextResponse.json({ error: e.message || "Login failed" }, { status: 500 });
  }
}
