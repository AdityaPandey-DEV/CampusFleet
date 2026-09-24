import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

/**
 * Helper to map DB row to Campus type
 */
function mapCampusRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    address: row.address || "",
    landmark: row.landmark || "",
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    geofenceRadiusMeters: Number(row.geofence_radius ?? 100),
    fleetCapacity: Number(row.fleet_capacity ?? 50),
    parkingBays: Number(row.parking_bays ?? 20),
    contactPhone: row.contact_phone || "",
    contactEmail: row.contact_email || "",
    isPrimary: Boolean(row.is_primary),
    isActive: Boolean(row.is_active ?? true),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * GET /api/campus
 * Fetches all campus locations and identifies the primary campus hub.
 */
export async function GET(req: NextRequest) {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from("campuses")
      .select("*")
      .order("is_primary", { ascending: false })
      .order("name", { ascending: true });

    if (error) throw error;

    const campuses = (rows || []).map(mapCampusRow);
    const primaryCampus = campuses.find((c) => c.isPrimary) || campuses[0] || null;

    return NextResponse.json(
      {
        success: true,
        campuses,
        primaryCampus,
        campus: primaryCampus, // Backwards-compatibility
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error: any) {
    console.error("GET /api/campus error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch campuses." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/campus
 * Creates a new institutional campus location.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      name,
      code,
      address,
      landmark,
      latitude,
      longitude,
      geofenceRadiusMeters,
      fleetCapacity,
      parkingBays,
      contactPhone,
      contactEmail,
      isPrimary,
      isActive,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Campus name is required." }, { status: 400 });
    }
    if (!code?.trim()) {
      return NextResponse.json({ error: "Campus code is required." }, { status: 400 });
    }
    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: "Latitude and longitude are required." }, { status: 400 });
    }

    const campusId = id?.trim() || `campus-${code.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString(36)}`;

    // If setting as primary, demote other campuses
    if (isPrimary) {
      await supabaseAdmin.from("campuses").update({ is_primary: false }).neq("id", campusId);
    }

    const insertData = {
      id: campusId,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      address: address ? address.trim() : null,
      landmark: landmark ? landmark.trim() : null,
      latitude: Number(latitude),
      longitude: Number(longitude),
      geofence_radius: Number(geofenceRadiusMeters ?? 100),
      fleet_capacity: Number(fleetCapacity ?? 50),
      parking_bays: Number(parkingBays ?? 20),
      contact_phone: contactPhone ? contactPhone.trim() : null,
      contact_email: contactEmail ? contactEmail.trim() : null,
      is_primary: Boolean(isPrimary),
      is_active: isActive !== undefined ? Boolean(isActive) : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: newRow, error } = await supabaseAdmin
      .from("campuses")
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // Log to audit_logs
    await supabaseAdmin.from("audit_logs").insert({
      action: "CREATE_CAMPUS_LOCATION",
      entity: "Campus",
      entity_id: campusId,
      reason: `Created new institutional campus location: ${newRow.name} (${newRow.code})`,
      new_value: newRow,
    });

    const campus = mapCampusRow(newRow);
    return NextResponse.json({ success: true, campus }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/campus error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create campus." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/campus
 * Updates an existing campus location.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      name,
      code,
      address,
      landmark,
      latitude,
      longitude,
      geofenceRadiusMeters,
      fleetCapacity,
      parkingBays,
      contactPhone,
      contactEmail,
      isPrimary,
      isActive,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Campus ID is required." }, { status: 400 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name.trim();
    if (code !== undefined) updates.code = code.trim().toUpperCase();
    if (address !== undefined) updates.address = address ? address.trim() : null;
    if (landmark !== undefined) updates.landmark = landmark ? landmark.trim() : null;
    if (latitude !== undefined) updates.latitude = Number(latitude);
    if (longitude !== undefined) updates.longitude = Number(longitude);
    if (geofenceRadiusMeters !== undefined) updates.geofence_radius = Number(geofenceRadiusMeters);
    if (fleetCapacity !== undefined) updates.fleet_capacity = Number(fleetCapacity);
    if (parkingBays !== undefined) updates.parking_bays = Number(parkingBays);
    if (contactPhone !== undefined) updates.contact_phone = contactPhone ? contactPhone.trim() : null;
    if (contactEmail !== undefined) updates.contact_email = contactEmail ? contactEmail.trim() : null;
    if (isActive !== undefined) updates.is_active = Boolean(isActive);

    // If marked as primary, reset other campuses
    if (isPrimary === true) {
      updates.is_primary = true;
      await supabaseAdmin.from("campuses").update({ is_primary: false }).neq("id", id);
    } else if (isPrimary === false) {
      updates.is_primary = false;
    }

    const { data: updatedRow, error } = await supabaseAdmin
      .from("campuses")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Synchronize matching terminal stop in stops table if updated
    if (updatedRow.is_primary || updatedRow.code === "GEHU-BHT") {
      await supabaseAdmin
        .from("stops")
        .update({
          name: `${updatedRow.name} Terminal`,
          latitude: updatedRow.latitude,
          longitude: updatedRow.longitude,
          landmark: updatedRow.landmark || updatedRow.address,
          geofence_radius: updatedRow.geofence_radius,
          campus: updatedRow.name,
        })
        .or(`id.eq.stop-bhimtal-campus,code.eq.${updatedRow.code}`);
    }

    // Insert audit log record
    await supabaseAdmin.from("audit_logs").insert({
      action: "UPDATE_CAMPUS_LOCATION",
      entity: "Campus",
      entity_id: id,
      reason: `Updated campus location ${updatedRow.name} (${updatedRow.latitude}, ${updatedRow.longitude})`,
      new_value: updatedRow,
    });

    const campus = mapCampusRow(updatedRow);
    return NextResponse.json({ success: true, campus });
  } catch (error: any) {
    console.error("PATCH /api/campus error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update campus." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/campus
 * Deletes a campus location.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");

    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json({ error: "Campus ID is required." }, { status: 400 });
    }

    // Prevent deletion if it is the only campus or primary
    const { data: target } = await supabaseAdmin
      .from("campuses")
      .select("id, name, is_primary")
      .eq("id", id)
      .single();

    if (!target) {
      return NextResponse.json({ error: "Campus not found." }, { status: 404 });
    }

    const { count } = await supabaseAdmin
      .from("campuses")
      .select("*", { count: "exact", head: true });

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the sole campus location in the system." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("campuses").delete().eq("id", id);
    if (error) throw error;

    // If was primary, promote another campus to primary
    if (target.is_primary) {
      const { data: nextCampus } = await supabaseAdmin
        .from("campuses")
        .select("id")
        .limit(1)
        .single();
      if (nextCampus) {
        await supabaseAdmin.from("campuses").update({ is_primary: true }).eq("id", nextCampus.id);
      }
    }

    // Audit log
    await supabaseAdmin.from("audit_logs").insert({
      action: "DELETE_CAMPUS_LOCATION",
      entity: "Campus",
      entity_id: id,
      reason: `Deleted campus location: ${target.name}`,
    });

    return NextResponse.json({ success: true, message: `Campus ${target.name} deleted.` });
  } catch (error: any) {
    console.error("DELETE /api/campus error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete campus." },
      { status: 500 }
    );
  }
}
