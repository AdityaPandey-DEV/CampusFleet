import { supabaseAdmin } from "@/lib/supabaseClient";

export interface FindOrCreateUserParams {
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  provider: "google" | "email_otp" | "password" | "sso";
}

export interface AuthUserResult {
  id: string;
  email: string;
  full_name: string;
  role: string;
  campus_id?: string | null;
  campus?: string | null;
  avatar_url?: string | null;
  provider?: string;
  created_at?: string;
}

/**
 * Centralized Account Service
 * Single source of truth for user and student account creation:
 * - If user is signing in for the first time:
 *     - Automatically creates account in `users` (default role "student", or "admin" if admin email)
 *     - If role is "student", automatically creates matching record in `students` with real data (no mock data)
 * - If account is already present:
 *     - Signs in as normal, returning the existing user record
 */
export async function findOrCreateUser({
  email,
  fullName,
  avatarUrl,
  provider,
}: FindOrCreateUserParams): Promise<{ user: AuthUserResult; isNewUser: boolean }> {
  const cleanEmail = (email || "").trim().toLowerCase();
  const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").trim().toLowerCase();

  // 1. Check if user already exists
  const { data: existingUser } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("email", cleanEmail)
    .maybeSingle();

  if (existingUser) {
    // Already present account: sign in as normal
    const updates: Record<string, any> = {};
    if (avatarUrl && !existingUser.avatar_url) updates.avatar_url = avatarUrl;
    if (fullName && !existingUser.full_name) updates.full_name = fullName;

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      await supabaseAdmin.from("users").update(updates).eq("id", existingUser.id);
    }

    // Ensure student record exists if role is student (for legacy accounts)
    if (existingUser.role === "student") {
      const { data: existingStudents } = await supabaseAdmin
        .from("students")
        .select("id, user_id, campus_id, campus, full_name, phone")
        .or(`user_id.eq.${existingUser.id},email.ilike.${cleanEmail}`)
        .order("created_at", { ascending: false })
        .limit(1);

      const existingStudent = existingStudents?.[0];

      if (!existingStudent) {
        const newStudentId = crypto.randomUUID();
        const { error: studErr2 } = await supabaseAdmin.from("students").insert({
          id: newStudentId,
          user_id: existingUser.id,
          full_name: existingUser.full_name || cleanEmail.split("@")[0],
          email: cleanEmail,
          created_at: new Date().toISOString(),
        });
        if (studErr2) {
          console.warn("Auto-create student for existing user failed:", studErr2.message);
        }
      } else {
        if (!existingStudent.user_id || existingStudent.user_id !== existingUser.id) {
          // Link existing student row with this user's primary key
          await supabaseAdmin
            .from("students")
            .update({ user_id: existingUser.id })
            .eq("id", existingStudent.id);
        }

        // Sync campus / phone to user record if missing in users table
        const userSync: Record<string, any> = {};
        if (!existingUser.campus_id && existingStudent.campus_id) userSync.campus_id = existingStudent.campus_id;
        if (!existingUser.campus && existingStudent.campus) userSync.campus = existingStudent.campus;
        if (!existingUser.phone && existingStudent.phone) userSync.phone = existingStudent.phone;
        if (Object.keys(userSync).length > 0) {
          await supabaseAdmin.from("users").update(userSync).eq("id", existingUser.id);
          Object.assign(existingUser, userSync);
        }
      }
    }

    return {
      user: {
        id: existingUser.id,
        email: existingUser.email,
        full_name: existingUser.full_name,
        role: existingUser.role || "student",
        campus_id: existingUser.campus_id || null,
        campus: existingUser.campus,
        avatar_url: existingUser.avatar_url || avatarUrl,
        provider: existingUser.provider || provider,
        created_at: existingUser.created_at,
      },
      isNewUser: false,
    };
  }

  // 2. First-time sign-in: automatically create user account
  const role = adminEmail && cleanEmail === adminEmail ? "admin" : "student";
  const userId = crypto.randomUUID();
  const realName =
    fullName?.trim() ||
    cleanEmail
      .split("@")[0]
      .replace(/[._]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  // Check if a pre-existing student record already exists in database for this email
  let existingStudentForNewUser: any = null;
  if (role === "student") {
    const { data: matchedStudents } = await supabaseAdmin
      .from("students")
      .select("id, user_id, campus_id, campus, full_name, phone, photo_url")
      .ilike("email", cleanEmail)
      .order("created_at", { ascending: false })
      .limit(1);

    existingStudentForNewUser = matchedStudents?.[0];
  }

  const effectiveCampusId = existingStudentForNewUser?.campus_id || null;
  const effectiveCampus = existingStudentForNewUser?.campus || null;
  const effectivePhone = existingStudentForNewUser?.phone || null;
  const effectiveFullName = existingStudentForNewUser?.full_name || realName;

  const { data: newUser, error: createErr } = await supabaseAdmin
    .from("users")
    .insert({
      id: userId,
      email: cleanEmail,
      full_name: effectiveFullName,
      role,
      campus_id: effectiveCampusId,
      campus: effectiveCampus,
      phone: effectivePhone,
      avatar_url: avatarUrl || existingStudentForNewUser?.photo_url || null,
      provider,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (createErr) {
    console.error("Failed to create user in findOrCreateUser:", createErr);
  }

  // If role is student, link existing student record or create new one
  if (role === "student") {
    if (existingStudentForNewUser) {
      // LINK existing student record to this user's primary key (user_id)
      await supabaseAdmin
        .from("students")
        .update({
          user_id: userId,
          full_name: effectiveFullName,
        })
        .eq("id", existingStudentForNewUser.id);
    } else {
      const studentId = crypto.randomUUID();
      const { error: studErr } = await supabaseAdmin.from("students").insert({
        id: studentId,
        user_id: userId,
        full_name: realName,
        email: cleanEmail,
        created_at: new Date().toISOString(),
      });

      if (studErr) {
        // Non-fatal: student profile can be created later via profile completion modal
        console.warn("Auto-create student record notice:", studErr.message);
      }
    }
  }

  const createdUser: AuthUserResult = newUser || {
    id: userId,
    email: cleanEmail,
    full_name: effectiveFullName,
    role,
    campus_id: effectiveCampusId,
    campus: effectiveCampus,
    avatar_url: avatarUrl || existingStudentForNewUser?.photo_url || null,
    provider,
    created_at: new Date().toISOString(),
  };

  return {
    user: createdUser,
    isNewUser: true,
  };
}
