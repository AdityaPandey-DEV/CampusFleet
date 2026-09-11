import { NextRequest, NextResponse } from "next/server";
import { signToken, createSessionCookie } from "@/lib/jwt";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { findOrCreateUser } from "@/lib/account-service";

/**
 * POST /api/auth/login
 * Email + password login. Uses centralized findOrCreateUser account service.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    const cleanEmail = (email || "").trim().toLowerCase();

    if (!cleanEmail) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check password if existing user has a password hash set
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("password_hash")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existingUser?.password_hash) {
      if (!password) {
        return NextResponse.json({ error: "Password is required" }, { status: 401 });
      }
      const bcrypt = await import("bcryptjs");
      const valid = await bcrypt.compare(password, existingUser.password_hash);
      if (!valid) {
        return NextResponse.json({ error: "Invalid password" }, { status: 401 });
      }
    }

    // Find existing or auto-create student account via centralized service
    const { user } = await findOrCreateUser({
      email: cleanEmail,
      provider: "password",
    });

    // Create JWT session
    const token = await signToken({
      userId: user.id,
      email: user.email,
      fullName: user.full_name || cleanEmail.split("@")[0],
      role: user.role || "student",
      campus: user.campus || undefined,
      avatarUrl: user.avatar_url || undefined,
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
