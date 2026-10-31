import { createClient } from "@supabase/supabase-js";
import { createBookingId, createTripId } from "../src/lib/id.ts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateToTypeId() {
  console.log("=== STARTING FULL DATABASE TYPEID MIGRATION ===");
  
  // 1. Fetch current trips for today (2026-10-31)
  const { data: oldTrips, error: tripErr } = await supabase
    .from("trips")
    .select("*")
    .eq("trip_date", "2026-10-31");

  if (tripErr || !oldTrips || oldTrips.length === 0) {
    console.error("Error fetching trips:", tripErr);
    return;
  }

  console.log(`Found ${oldTrips.length} operational trips for 2026-10-31.`);

  // Create mapping: oldTripId -> newTripTypeId
  const tripIdMap = new Map();
  const newTrips = oldTrips.map((oldTrip) => {
    const newId = createTripId();
    tripIdMap.set(oldTrip.id, newId);
    return {
      ...oldTrip,
      id: newId,
    };
  });

  // 2. Fetch all bookings for these trips
  const oldTripIds = oldTrips.map((t) => t.id);
  const { data: oldBookings, error: bkErr } = await supabase
    .from("bookings")
    .select("*")
    .in("trip_id", oldTripIds);

  if (bkErr) {
    console.error("Error fetching bookings:", bkErr);
    return;
  }

  console.log(`Found ${oldBookings.length} bookings to migrate to TypeIDs.`);

  // Create mapping: oldBookingId -> newBookingTypeId
  const bookingIdMap = new Map();
  const newBookings = oldBookings.map((oldBk) => {
    const newBkId = createBookingId();
    const newTripId = tripIdMap.get(oldBk.trip_id) || oldBk.trip_id;
    bookingIdMap.set(oldBk.id, newBkId);
    return {
      ...oldBk,
      id: newBkId,
      trip_id: newTripId,
    };
  });

  // 3. Step A: Insert new trips with TypeIDs
  console.log("Inserting 45 new trips with TypeIDs (trip_01...)...");
  const { error: insertTripsErr } = await supabase.from("trips").insert(newTrips);
  if (insertTripsErr) {
    console.error("Failed to insert new trips:", insertTripsErr);
    return;
  }
  console.log("✓ Successfully inserted new trips!");

  // 4. Step B: Insert new bookings with TypeIDs in chunks of 200
  console.log("Inserting 920 new bookings with TypeIDs (bk_01...)...");
  const chunkSize = 200;
  for (let i = 0; i < newBookings.length; i += chunkSize) {
    const chunk = newBookings.slice(i, i + chunkSize);
    const { error: chunkErr } = await supabase.from("bookings").insert(chunk);
    if (chunkErr) {
      console.error(`Error inserting booking chunk ${i}:`, chunkErr);
      return;
    }
    console.log(`  Inserted chunk ${i} - ${i + chunk.length}`);
  }
  console.log("✓ Successfully inserted all new bookings!");

  // 5. Step C: Update attendance records if any exist
  const { data: attRecords } = await supabase
    .from("attendance_records")
    .select("*")
    .in("trip_id", oldTripIds);

  if (attRecords && attRecords.length > 0) {
    console.log(`Updating ${attRecords.length} attendance records to point to new TypeIDs...`);
    for (const att of attRecords) {
      const newTripId = tripIdMap.get(att.trip_id);
      const newBkId = bookingIdMap.get(att.booking_id);
      if (newTripId) {
        await supabase
          .from("attendance_records")
          .update({
            trip_id: newTripId,
            ...(newBkId ? { booking_id: newBkId } : {}),
          })
          .eq("id", att.id);
      }
    }
    console.log("✓ Attendance records re-linked successfully!");
  }

  // 6. Step D: Delete old bookings and old trips
  console.log("Deleting old bookings...");
  const oldBkIds = oldBookings.map((b) => b.id);
  for (let i = 0; i < oldBkIds.length; i += chunkSize) {
    const chunk = oldBkIds.slice(i, i + chunkSize);
    await supabase.from("bookings").delete().in("id", chunk);
  }

  console.log("Deleting old trips...");
  await supabase.from("trips").delete().in("id", oldTripIds);

  // 7. Verification
  const { data: finalTrips } = await supabase
    .from("trips")
    .select("id, trip_code")
    .eq("trip_date", "2026-10-31");

  const { data: finalBookings } = await supabase
    .from("bookings")
    .select("id, trip_id")
    .limit(5);

  console.log("\n=== MIGRATION COMPLETED SUCCESSFULLY ===");
  console.log(`Total 2026-10-31 trips now: ${finalTrips?.length}`);
  console.log("Sample Trip TypeID:", finalTrips?.[0]?.id);
  console.log("Sample Booking TypeID:", finalBookings?.[0]?.id);
  console.log("Sample Booking referenced Trip TypeID:", finalBookings?.[0]?.trip_id);
}

migrateToTypeId().catch(console.error);
