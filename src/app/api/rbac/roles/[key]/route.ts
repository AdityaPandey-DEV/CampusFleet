import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/jwt";
import { updateSystemRole, deleteSystemRole, isRoleAuthorized } from "@/modules/rbac/rbac-service";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const session = await getSession();
    const canManageRoles = session && (await isRoleAuthorized(session.role, "role_manager", 2));
    if (!canManageRoles) {
      return NextResponse.json({ error: "Unauthorized: Insufficient role management privileges." }, { status: 403 });
    }

    const roleKey = params.key;
    const body = await req.json();
    const { name, description, parentRoleKey, hierarchyLevel, directCards, portalPath, shortLabel, icon, color, gradient } = body;

    if (!name) {
      return NextResponse.json({ error: "Role name is required." }, { status: 400 });
    }

    // Only Super Administrator (Level 1) can modify the admin role
    const isSuperAdmin = await isRoleAuthorized(session.role, undefined, 1);
    if (roleKey === "admin" && !isSuperAdmin) {
      return NextResponse.json({ error: "Cannot modify the Super Administrator role." }, { status: 403 });
    }

    const result = await updateSystemRole(roleKey, {
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
    return NextResponse.json({ error: err.message || "Failed to update role" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const session = await getSession();
    const canManageRoles = session && (await isRoleAuthorized(session.role, "role_manager", 2));
    if (!canManageRoles) {
      return NextResponse.json({ error: "Unauthorized: Insufficient role management privileges." }, { status: 403 });
    }

    const roleKey = params.key;

    // Guard: Cannot delete system roles
    const result = await deleteSystemRole(roleKey);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete role" }, { status: 500 });
  }
}
