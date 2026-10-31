import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function populateAllTripBookings() {
  console.log("=== POPULATING BALANCED REALISTIC BOOKINGS ACROSS ALL TRIPS ===");

  // 1. Fetch all stops, students, and today's trips
  const [{ data: validStops }, { data: students }, { data: todayTrips }, { data: buses }] = await Promise.all([
    supabase.from("stops").select("id"),
    supabase.from("students").select("id, primary_stop_id"),
    supabase.from("trips").select("id, bus_id, trip_date, shift_id").eq("trip_date", "2026-10-31"),
    supabase.from("buses").select("id, capacity"),
  ]);

  const busCapacityMap = new Map((buses || []).map(b => [b.id, b.capacity || 40]));
  const stopIds = (validStops || []).map(s => s.id);

  // Clear existing bookings for 2026-10-31
  await supabase.from("bookings").delete().eq("booking_date", "2026-10-31");

  const bookingsToInsert = [];

  for (const trip of todayTrips || []) {
    const capacity = busCapacityMap.get(trip.bus_id) || 40;
    // Target 40% to 75% capacity per trip
    const passengerCount = Math.floor(capacity * (0.40 + Math.random() * 0.35));

    for (let i = 0; i < passengerCount; i++) {
      const student = students[i % students.length];
      const stopId = student?.primary_stop_id && stopIds.includes(student.primary_stop_id)
        ? student.primary_stop_id
        : stopIds[i % stopIds.length];

      const row = Math.floor(i / 4) + 1;
      const col = ["A", "B", "C", "D"][i % 4];

      bookingsToInsert.push({
        id: crypto.randomUUID(),
        booking_code: `BK-GEHU-${trip.bus_id.replace("bus-", "B")}-${Math.floor(1000 + Math.random() * 9000)}`,
        student_id: student.id,
        trip_id: trip.id,
        boarding_stop_id: stopId,
        seat_number: `${row}${col}`,
        status: "CONFIRMED",
        booking_date: "2026-10-31",
        passenger_type: "SEATED",
        bus_id: trip.bus_id,
        roaming_status: "CONFIRMED",
      });
    }
  }

  console.log(`Generated ${bookingsToInsert.length} bookings for ${todayTrips.length} trips.`);

  // Insert in clean batches of 100
  let inserted = 0;
  for (let i = 0; i < bookingsToInsert.length; i += 100) {
    const batch = bookingsToInsert.slice(i, i + 100);
    const { error } = await supabase.from("bookings").insert(batch);
    if (error) {
      console.warn("Batch insert error:", error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`✓ Successfully inserted ${inserted} realistic passenger bookings!`);
}

populateAllTripBookings().catch(console.error);
