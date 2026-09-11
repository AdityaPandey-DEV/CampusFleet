import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/merges - List merge suggestions and history
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let query = supabaseAdmin
      .from("bus_merge_suggestions")
      .select("*, bus_merge_points(*)")
      .order("created_at", { ascending: false });

    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }

    const { data: suggestions, error } = await query;
    if (error) throw error;

    // Fetch buses and routes to enrich
    const { data: buses } = await supabaseAdmin.from("buses").select("id, bus_number, registration_no, capacity, current_route_id, status");
    const { data: routes } = await supabaseAdmin.from("routes").select("id, name, code");

    const busMap = new Map((buses || []).map((b) => [b.id, b]));
    const routeMap = new Map((routes || []).map((r) => [r.id, r]));

    const enriched = (suggestions || []).map((s) => {
      const sourceBus = busMap.get(s.source_bus_id);
      const targetBus = busMap.get(s.target_bus_id);
      const route = routeMap.get(s.route_id);
      const mp = s.bus_merge_points;

      return {
        id: s.id,
        mergePointId: s.merge_point_id,
        mergePointCode: mp?.code || "MP",
        mergePointName: mp?.name || "Designated Merge Stop",
        routeId: s.route_id,
        routeName: route ? route.name : s.route_id,
        sourceBusId: s.source_bus_id,
        sourceBusName: sourceBus ? (sourceBus.bus_number || sourceBus.registration_no) : s.source_bus_id,
        sourceOccupancy: s.source_occupancy,
        targetBusId: s.target_bus_id,
        targetBusName: targetBus ? (targetBus.bus_number || targetBus.registration_no) : s.target_bus_id,
        targetOccupancy: s.target_occupancy,
        targetCapacity: s.target_capacity,
        combinedOccupancy: s.combined_occupancy,
        remainingSeats: Math.max(0, s.target_capacity - s.combined_occupancy),
        status: s.status,
        rejectionReason: s.rejection_reason,
        suggestedBy: s.suggested_by,
        reviewedBy: s.reviewed_by,
        reviewedAt: s.reviewed_at,
        createdAt: s.created_at,
      };
    });

    return NextResponse.json({ success: true, suggestions: enriched });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load merge suggestions." },
      { status: 500 }
    );
  }
}

// POST /api/merges - Detect opportunities or Review (Approve/Reject)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, suggestionId, reviewerName, rejectionReason } = body;

    // =========================================================================
    // ACTION 1: TRIGGER AUTO-DETECTION OF MERGE OPPORTUNITIES
    // =========================================================================
    if (action === "DETECT") {
      // 1. Fetch all operational buses
      const { data: allBuses, error: busErr } = await supabaseAdmin
        .from("buses")
        .select("*")
        .not("status", "in", '("MAINTENANCE","OUT_OF_SERVICE","INACTIVE","MERGED")');

      if (busErr) throw busErr;

      // Group buses by assigned route
      const routeBuses = new Map<string, any[]>();
      for (const b of allBuses || []) {
        // Bus route can be in b.current_route_id, b.route_id or b.assigned_route_id
        const rId = b.current_route_id || b.route_id || b.assigned_route_id;
        if (rId) {
          if (!routeBuses.has(rId)) routeBuses.set(rId, []);
          routeBuses.get(rId)!.push(b);
        }
      }

      const generatedSuggestions = [];

      for (const [routeId, busesOnRoute] of Array.from(routeBuses.entries())) {
        if (busesOnRoute.length < 2) continue;

        // CRITICAL BUSINESS RULE: Verify route has an active configured BusMergePoint
        const { data: mergePoints } = await supabaseAdmin
          .from("bus_merge_points")
          .select("*")
          .eq("route_id", routeId)
          .eq("is_active", true);

        // If NO configured merge point on this route, MERGING IS STRICTLY NOT ALLOWED!
        if (!mergePoints || mergePoints.length === 0) {
          continue; // Rule 12: Route without merge point -> No merging
        }

        const designatedPoint = mergePoints[0]; // Use designated merge point

        // Check pairs for merge feasibility
        for (let i = 0; i < busesOnRoute.length; i++) {
          for (let j = i + 1; j < busesOnRoute.length; j++) {
            const b1 = busesOnRoute[i];
            const b2 = busesOnRoute[j];

            const occ1 = b1.occupancy || 0;
            const occ2 = b2.occupancy || 0;
            const cap1 = b1.capacity || 50;
            const cap2 = b2.capacity || 50;
            const combined = occ1 + occ2;

            // Determine if b2 can merge into b1 OR b1 can merge into b2
            let source = null;
            let target = null;

            if (combined <= cap1) {
              source = b2;
              target = b1;
            } else if (combined <= cap2) {
              source = b1;
              target = b2;
            }

            if (source && target) {
              // Check if pending suggestion already exists
              const { data: existing } = await supabaseAdmin
                .from("bus_merge_suggestions")
                .select("id")
                .eq("source_bus_id", source.id)
                .eq("target_bus_id", target.id)
                .eq("status", "PENDING")
                .maybeSingle();

              if (!existing) {
                const { data: newSug, error: insErr } = await supabaseAdmin
                  .from("bus_merge_suggestions")
                  .insert({
                    merge_point_id: designatedPoint.id,
                    route_id: routeId,
                    source_bus_id: source.id,
                    target_bus_id: target.id,
                    source_occupancy: source.occupancy || 0,
                    target_occupancy: target.occupancy || 0,
                    target_capacity: target.capacity || 50,
                    combined_occupancy: combined,
                    status: "PENDING",
                    suggested_by: "CAMPUS_FLEET_OPTIMIZER",
                  })
                  .select()
                  .single();

                if (!insErr && newSug) {
                  generatedSuggestions.push(newSug);
                }
              }
            }
          }
        }
      }

      return NextResponse.json({
        success: true,
        detectedCount: generatedSuggestions.length,
        suggestions: generatedSuggestions,
      });
    }

    // =========================================================================
    // ACTION 2: APPROVE MERGE
    // =========================================================================
    if (action === "APPROVE") {
      if (!suggestionId) {
        return NextResponse.json({ success: false, message: "suggestionId is required." }, { status: 400 });
      }

      // 1. Fetch suggestion
      const { data: suggestion, error: sugErr } = await supabaseAdmin
        .from("bus_merge_suggestions")
        .select("*, bus_merge_points(*)")
        .eq("id", suggestionId)
        .single();

      if (sugErr || !suggestion) {
        return NextResponse.json({ success: false, message: "Merge suggestion not found." }, { status: 404 });
      }

      if (suggestion.status !== "PENDING") {
        return NextResponse.json(
          { success: false, message: `Suggestion is already ${suggestion.status}.` },
          { status: 400 }
        );
      }

      // CRITICAL BUSINESS RULE: Verify merge point belongs to the route
      if (!suggestion.bus_merge_points || suggestion.bus_merge_points.route_id !== suggestion.route_id) {
        return NextResponse.json(
          { success: false, message: "Merge Denied: Merge point is not authorized for this route." },
          { status: 403 }
        );
      }

      // Verify buses and capacities
      const { data: targetBus } = await supabaseAdmin.from("buses").select("*").eq("id", suggestion.target_bus_id).single();
      const { data: sourceBus } = await supabaseAdmin.from("buses").select("*").eq("id", suggestion.source_bus_id).single();

      if (!targetBus || !sourceBus) {
        return NextResponse.json({ success: false, message: "One or both buses not found." }, { status: 404 });
      }

      if (targetBus.status === "MAINTENANCE" || sourceBus.status === "MAINTENANCE") {
        return NextResponse.json(
          { success: false, message: "Merge Denied: One of the buses is currently under maintenance." },
          { status: 400 }
        );
      }

      const combined = (sourceBus.occupancy || 0) + (targetBus.occupancy || 0);
      if (combined > (targetBus.capacity || 50)) {
        return NextResponse.json(
          {
            success: false,
            message: `Merge Denied: Combined occupancy (${combined}) now exceeds receiving bus capacity (${targetBus.capacity}).`,
          },
          { status: 400 }
        );
      }

      // Execute Merge
      // 1. Update suggestion status
      await supabaseAdmin
        .from("bus_merge_suggestions")
        .update({
          status: "APPROVED",
          reviewed_by: reviewerName || "Admin Authority",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", suggestionId);

      // 2. Update target bus occupancy
      await supabaseAdmin
        .from("buses")
        .update({ occupancy: combined })
        .eq("id", targetBus.id);

      // 3. Mark source bus as MERGED & set occupancy to 0
      await supabaseAdmin
        .from("buses")
        .update({
          occupancy: 0,
          status: "MERGED",
        })
        .eq("id", sourceBus.id);

      // 4. Reassign active bookings from source bus to target bus
      await supabaseAdmin
        .from("bookings")
        .update({
          bus_id: targetBus.id,
          merge_stop_id: suggestion.bus_merge_points?.id || suggestion.merge_point_id || null,
        })
        .eq("bus_id", sourceBus.id)
        .in("status", ["CONFIRMED", "BOARDED", "PENDING"]);

      // 5. Audit Log
      await supabaseAdmin.from("audit_logs").insert({
        user_role: "admin",
        action: "APPROVE_BUS_MERGE",
        entity: "BusMergeSuggestion",
        entity_id: suggestionId,
        reason: `Approved merge: ${sourceBus.bus_number || sourceBus.name} merged into ${targetBus.bus_number || targetBus.name} at ${suggestion.bus_merge_points.name} (${suggestion.bus_merge_points.code}). New occupancy: ${combined}/${targetBus.capacity}`,
        previous_value: {
          sourceOccupancy: sourceBus.occupancy,
          targetOccupancy: targetBus.occupancy,
        },
        new_value: {
          targetOccupancy: combined,
          sourceStatus: "MERGED",
        },
      });

      return NextResponse.json({
        success: true,
        message: `Merge approved! Bus ${sourceBus.bus_number || sourceBus.id} merged into ${targetBus.bus_number || targetBus.id} at ${suggestion.bus_merge_points.name}.`,
      });
    }

    // =========================================================================
    // ACTION 3: REJECT MERGE
    // =========================================================================
    if (action === "REJECT") {
      if (!suggestionId) {
        return NextResponse.json({ success: false, message: "suggestionId is required." }, { status: 400 });
      }

      await supabaseAdmin
        .from("bus_merge_suggestions")
        .update({
          status: "REJECTED",
          rejection_reason: rejectionReason || "Operational decision by dispatch controller.",
          reviewed_by: reviewerName || "Admin Authority",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", suggestionId);

      await supabaseAdmin.from("audit_logs").insert({
        user_role: "admin",
        action: "REJECT_BUS_MERGE",
        entity: "BusMergeSuggestion",
        entity_id: suggestionId,
        reason: `Rejected bus merge suggestion: ${rejectionReason || "Operational decision"}`,
      });

      return NextResponse.json({
        success: true,
        message: "Merge suggestion rejected.",
      });
    }

    return NextResponse.json({ success: false, message: "Invalid action specified." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to process merge action." },
      { status: 500 }
    );
  }
}
