import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Clean Bus to Crew & Route Mapping
const BUS_MASTER = {
  "bus-02": { busNumber: "Bus 2", reg: "UK04PA 2158", driverId: "staff-drv-02", conductorId: "staff-cnd-02", routeId: "route-bus-2", capacity: 40 },
  "bus-03": { busNumber: "Bus 3", reg: "UK04PA 2165", driverId: "staff-drv-03", conductorId: "staff-cnd-03", routeId: "route-bus-3", capacity: 40 },
  "bus-08": { busNumber: "Bus 8", reg: "UK04PA 2172", driverId: "staff-drv-08", conductorId: "staff-cnd-08", routeId: "route-bus-8", capacity: 38 },
  "bus-09": { busNumber: "Bus 9", reg: "UK04PA 1613", driverId: "staff-drv-09", conductorId: "staff-cnd-09", routeId: "route-bus-9", capacity: 36 },
  "bus-11": { busNumber: "Bus 11", reg: "UK04PA 0742", driverId: "staff-drv-11", conductorId: "staff-cnd-11", routeId: "route-bus-11", capacity: 34 },
  "bus-21": { busNumber: "Bus 21", reg: "UK04PA 2021", driverId: "staff-drv-44", conductorId: "staff-cnd-44", routeId: "route-bht-ddn-placement", capacity: 42, isSpecial: true },
  "bus-36": { busNumber: "Bus 36", reg: "UK04PA 2012", driverId: "staff-drv-36", conductorId: "staff-cnd-36", routeId: "route-bus-36", capacity: 40 },
  "bus-37": { busNumber: "Bus 37", reg: "UK04PA 2354", driverId: "staff-drv-37", conductorId: "staff-cnd-37", routeId: "route-bus-37", capacity: 36 },
  "bus-40": { busNumber: "Bus 40", reg: "UK04PA 2353", driverId: "staff-drv-40", conductorId: "staff-cnd-40", routeId: "route-bus-40", capacity: 38 },
  "bus-43": { busNumber: "Bus 43", reg: "UK04PA 2019", driverId: "staff-drv-43", conductorId: "staff-cnd-43", routeId: "route-bus-43", capacity: 40 },
  "bus-44": { busNumber: "Bus 44", reg: "UK04PA 2044", driverId: "staff-drv-44", conductorId: "staff-cnd-44", routeId: "route-bus-44", capacity: 42 },
  "bus-45": { busNumber: "Bus 45", reg: "UK04PA 2022", driverId: "staff-drv-45", conductorId: "staff-cnd-45", routeId: "route-bus-45", capacity: 34 },
  "bus-49": { busNumber: "Bus 49", reg: "UK04PA 2149", driverId: "staff-drv-49", conductorId: "staff-cnd-49", routeId: "route-bus-49", capacity: 36 },
  "bus-50": { busNumber: "Bus 50", reg: "UK04PA 2150", driverId: "staff-drv-50", conductorId: "staff-cnd-50", routeId: "route-bus-50", capacity: 36 },
  "bus-tempo": { busNumber: "Tempo Shuttle", reg: "UK04PA 1792", driverId: "staff-drv-tempo", conductorId: "staff-cnd-tempo", routeId: "route-bus-tempo", capacity: 12 },
};

async function normalizeDemoData() {
  console.log("=== STARTING FAST BATCH DATABASE NORMALIZATION ===");

  // 1. Normalize Shifts
  console.log("1. Normalizing Transit Shifts...");
  await supabase
    .from("shifts")
    .update({
      start_time: "16:45:00",
      end_time: "18:00:00",
      name: "Evening Return Daily Corridor",
      direction: "CAMPUS_TO_HOME",
      booking_cutoff_minutes: 30,
    })
    .eq("id", "shift-2");

  await supabase
    .from("shifts")
    .update({
      start_time: "07:15:00",
      end_time: "08:45:00",
      name: "Morning Academic Daily Shift",
      direction: "HOME_TO_CAMPUS",
      booking_cutoff_minutes: 30,
    })
    .eq("id", "shift-1");

  await supabase
    .from("shifts")
    .update({
      start_time: "13:30:00",
      end_time: "14:15:00",
      name: "Afternoon Half-Day Departure",
      direction: "CAMPUS_TO_HOME",
      booking_cutoff_minutes: 20,
    })
    .eq("id", "shift-halfday");
  console.log("✓ Shifts normalized (Evening return: 16:45 PM).");

  // 2. Normalize Buses
  console.log("2. Normalizing Bus Fleet Registrations & Corridors...");
  for (const [busId, config] of Object.entries(BUS_MASTER)) {
    await supabase
      .from("buses")
      .update({
        registration_no: config.reg,
        current_route_id: config.routeId,
        capacity: config.capacity,
        status: "ACTIVE",
      })
      .eq("id", busId);
  }
  console.log("✓ Buses normalized.");

  // 3. Fast Batch Normalization of Trips by Bus ID (15 queries total!)
  console.log("3. Batch Aligning Trip Crew Allocations by Bus...");
  for (const [busId, config] of Object.entries(BUS_MASTER)) {
    const isSpecial = Boolean(config.isSpecial);
    await supabase
      .from("trips")
      .update({
        driver_id: config.driverId,
        conductor_id: config.conductorId,
        route_id: config.routeId,
        is_special: isSpecial,
        facility_type: isSpecial ? "PLACEMENT_DRIVE" : "REGULAR",
      })
      .eq("bus_id", busId);
  }
  console.log("✓ All trips cleanly mapped to matching bus crew & route.");

  // 4. Normalize Students
  console.log("4. Normalizing Student Profiles...");
  await supabase
    .from("students")
    .update({
      full_name: "Pooja Joshi",
      student_id_code: "GEHU/2023/1102",
      semester: "5",
    })
    .eq("id", "stud-4ec04853-9aa0-4de4-a196-ebf810d6b41c");

  await supabase
    .from("students")
    .update({
      full_name: "Hari Mohan Das",
      student_id_code: "GEHU/2023/1188",
      semester: "5",
    })
    .eq("id", "stud-usr-drv-bus-tempo");

  const { data: unassignedStudents } = await supabase
    .from("students")
    .select("id, student_id_code")
    .or("student_id_code.is.null,student_id_code.eq.PENDING");

  let codeCounter = 1200;
  for (const st of unassignedStudents || []) {
    await supabase
      .from("students")
      .update({
        student_id_code: `GEHU/2023/${codeCounter++}`,
      })
      .eq("id", st.id);
  }
  console.log("✓ Students normalized.");

  // 5. Populate Realistic Occupancy Bookings for 2026-10-31
  console.log("5. Generating Realistic Bookings for 2026-10-31...");
  const { data: todayTrips } = await supabase
    .from("trips")
    .select("id, bus_id, trip_date, shift_id")
    .eq("trip_date", "2026-10-31");

  const { data: realStudents } = await supabase
    .from("students")
    .select("id, primary_stop_id")
    .limit(45);

  // Clear existing bookings for today
  await supabase.from("bookings").delete().eq("booking_date", "2026-10-31");

  const stops = [
    "stop-lamachaur",
    "stop-fatehpur",
    "stop-mukhani",
    "stop-kaladhungi",
    "stop-panchakki",
    "stop-kathgodam",
    "stop-tikonia",
    "stop-haldwani-stn",
    "stop-gaulapar",
    "stop-kamluvaganja",
  ];

  const newBookings = [];
  for (const trip of todayTrips || []) {
    const busConfig = BUS_MASTER[trip.bus_id];
    const capacity = busConfig?.capacity || 40;
    // 50% to 80% realistic occupancy
    const targetBookings = Math.min(
      Math.floor(capacity * (0.50 + Math.random() * 0.30)),
      realStudents?.length || 20
    );

    for (let i = 0; i < targetBookings; i++) {
      const student = realStudents[i % realStudents.length];
      const stopId = student?.primary_stop_id || stops[i % stops.length];
      const row = Math.floor(i / 4) + 1;
      const col = ["A", "B", "C", "D"][i % 4];

      newBookings.push({
        id: `bk_20261031_${trip.id.substring(5, 18)}_${i}`,
        booking_code: `BK-GEHU-${trip.bus_id.replace("bus-", "B")}-${100 + i}`,
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

  // Insert in chunks of 50
  for (let i = 0; i < newBookings.length; i += 50) {
    const chunk = newBookings.slice(i, i + 50);
    const { error } = await supabase.from("bookings").insert(chunk);
    if (error) {
      console.warn("Insert chunk error:", error.message);
    }
  }

  console.log(`✓ Inserted ${newBookings.length} realistic passenger bookings for today.`);
  console.log("=== COMPLETED ALL NORMALIZATIONS! ===");
}

normalizeDemoData().catch(console.error);
