import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/jwt";
import { getRolesWithHierarchy, getSystemCards, createSystemRole } from "@/modules/rbac/rbac-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "admin" && session.role !== "role_manager")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const [roles, cards] = await Promise.all([
      getRolesWithHierarchy(),
      getSystemCards(),
    ]);

    return NextResponse.json({ roles, cards });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch roles" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "admin" && session.role !== "role_manager")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { key, name, description, parentRoleKey, hierarchyLevel, directCards, portalPath, shortLabel, icon, color, gradient } = body;

    if (!key || !name) {
      return NextResponse.json({ error: "Role key and name are required." }, { status: 400 });
    }

    // Role Manager cannot create an admin role
    if (key === "admin" && session.role !== "admin") {
      return NextResponse.json({ error: "Cannot create an administrator role." }, { status: 403 });
    }

    const result = await createSystemRole({
      key,
      name,
      description,
      parentRoleKey,
      hierarchyLevel,
      portalPath,
      shortLabel,
      icon,
      color,
      gradient,
      directCards: Array.isArray(directCards) ? directCards : [],
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create role" }, { status: 500 });
  }
}
