import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://hwawknnnolbxjvbylqkw.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3YXdrbm5ub2xieGp2YnlscWt3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODA3MDI5MywiZXhwIjoyMTAzNjQ2MjkzfQ.1xtwcUj-4J8y2_lc9gF-6xwf0Qv9fC0aUxCDCsnhOQM";

const supabase = createClient(supabaseUrl, serviceRoleKey);

const STOPS = [
  {
    id: "stop-hld-isbt",
    name: "Haldwani ISBT Terminal",
    code: "HLD-ISBT",
    latitude: 29.2183,
    longitude: 79.5130,
    landmark: "Main Highway Bus Bay 1",
    geofence_radius: 100,
  },
  {
    id: "stop-hld-tikonia",
    name: "Haldwani Tikonia Chauraha",
    code: "HLD-TIK",
    latitude: 29.2245,
    longitude: 79.5240,
    landmark: "Near Nainital Bank Head Office",
    geofence_radius: 80,
  },
  {
    id: "stop-kgm-rly",
    name: "Kathgodam Railway Station Point",
    code: "KGM-RLY",
    latitude: 29.2713,
    longitude: 79.5441,
    landmark: "Opposite Station Main Gate",
    geofence_radius: 90,
  },
  {
    id: "stop-bhowali",
    name: "Bhowali Sanatorium Junction",
    code: "BHW-JNC",
    latitude: 29.3820,
    longitude: 79.5186,
    landmark: "Almora-Nainital Bypass Point",
    geofence_radius: 100,
  },
  {
    id: "stop-gehu-bhimtal",
    name: "GEHU Bhimtal Campus Terminal",
    code: "GEHU-BHT",
    latitude: 29.3516,
    longitude: 79.5583,
    landmark: "Graphic Era Hill University Campus Gate 1",
    geofence_radius: 150,
  },
  {
    id: "stop-gehu-hld",
    name: "GEHU Haldwani Campus Station",
    code: "GEHU-HLD",
    latitude: 29.2310,
    longitude: 79.5320,
    landmark: "University Transport Block",
    geofence_radius: 120,
  },
  {
    id: "stop-ddn-isbt",
    name: "Dehradun ISBT Terminal",
    code: "DDN-ISBT",
    latitude: 30.2858,
    longitude: 78.0098,
    landmark: "Haridwar Bypass Exit",
    geofence_radius: 120,
  },
  {
    id: "stop-ddn-clock",
    name: "Dehradun Clock Tower",
    code: "DDN-CLK",
    latitude: 30.3256,
    longitude: 78.0437,
    landmark: "Rajpur Road Circle",
    geofence_radius: 80,
  },
  {
    id: "stop-gehu-ddn",
    name: "GEHU Dehradun Main Campus (Clement Town)",
    code: "GEHU-DDN",
    latitude: 30.2687,
    longitude: 77.9947,
    landmark: "Graphic Era University Main Gate, Clement Town",
    geofence_radius: 150,
  },
];

const BUSES = [
  {
    id: "bus-1",
    bus_number: "BUS-01 (GEHU Bhimtal Express)",
    registration_no: "UK-04-TA-1001",
    model: "Tata Starbus Ultra 42-Seater",
    capacity: 42,
    seat_layout: "2x2",
    status: "ACTIVE",
    gps_device_id: "GPS-GEHU-901",
    insurance_expiry: "2027-04-15",
    maintenance_due_date: "2026-11-20",
    current_route_id: "route-hld-bht",
  },
  {
    id: "bus-2",
    bus_number: "BUS-02 (Haldwani City Shuttle)",
    registration_no: "UK-04-TA-2002",
    model: "BharatBenz Tourer 36-Seater",
    capacity: 36,
    seat_layout: "2x2",
    status: "ACTIVE",
    gps_device_id: "GPS-GEHU-902",
    insurance_expiry: "2027-06-30",
    maintenance_due_date: "2026-12-05",
    current_route_id: "route-hld-bht",
  },
  {
    id: "bus-3",
    bus_number: "BUS-03 (Dehradun Valley Flyer)",
    registration_no: "UK-07-PA-5544",
    model: "Ashok Leyland Lynx Smart 45-Seater",
    capacity: 45,
    seat_layout: "2x2",
    status: "ACTIVE",
    gps_device_id: "GPS-GEHU-903",
    insurance_expiry: "2027-01-10",
    maintenance_due_date: "2026-10-15",
    current_route_id: "route-ddn-cle",
  },
  {
    id: "bus-4",
    bus_number: "BUS-04 (Bhimtal Hill Loop Mini)",
    registration_no: "UK-04-CA-8899",
    model: "Force Traveller Executive 26",
    capacity: 26,
    seat_layout: "2x2",
    status: "ACTIVE",
    gps_device_id: "GPS-GEHU-904",
    insurance_expiry: "2027-08-25",
    maintenance_due_date: "2026-12-30",
  },
];

const ROUTES = [
  {
    id: "route-hld-bht",
    code: "GEHU-RT-101",
    name: "Haldwani to GEHU Bhimtal Express",
    description: "Daily academic shuttle connecting Haldwani ISBT, Kathgodam, and Bhowali to GEHU Bhimtal Campus",
    direction: "HOME_TO_CAMPUS",
    color: "#2563EB",
    total_distance_km: 28.4,
    estimated_duration_mins: 55,
    is_active: true,
  },
  {
    id: "route-ddn-cle",
    code: "GEHU-RT-202",
    name: "Dehradun City to GEHU Clement Town",
    description: "Express corridor from Dehradun Clock Tower and ISBT to GEHU Dehradun Main Campus",
    direction: "HOME_TO_CAMPUS",
    color: "#0D9488",
    total_distance_km: 12.8,
    estimated_duration_mins: 30,
    is_active: true,
  },
];

const SHIFTS = [
  {
    id: "shift-1",
    name: "Morning Academic Shift",
    type: "MORNING",
    start_time: "07:30:00",
    end_time: "08:45:00",
    booking_cutoff_minutes: 30,
    is_active: true,
  },
  {
    id: "shift-2",
    name: "Evening Return Corridor",
    type: "EVENING",
    start_time: "16:30:00",
    end_time: "17:45:00",
    booking_cutoff_minutes: 45,
    is_active: true,
  },
];

async function seed() {
  console.log("🚀 Seeding Supabase database with GEHU data...");

  // Insert Stops
  const { data: stopData, error: stopErr } = await supabase.from("stops").upsert(STOPS);
  if (stopErr) {
    console.log("Notice on stops upsert:", stopErr.message);
  } else {
    console.log("✓ Stops seeded successfully!");
  }

  // Insert Buses
  const { data: busData, error: busErr } = await supabase.from("buses").upsert(BUSES);
  if (busErr) {
    console.log("Notice on buses upsert:", busErr.message);
  } else {
    console.log("✓ Buses seeded successfully!");
  }

  // Insert Routes
  const { data: routeData, error: routeErr } = await supabase.from("routes").upsert(ROUTES);
  if (routeErr) {
    console.log("Notice on routes upsert:", routeErr.message);
  } else {
    console.log("✓ Routes seeded successfully!");
  }

  // Insert Shifts
  const { data: shiftData, error: shiftErr } = await supabase.from("shifts").upsert(SHIFTS);
  if (shiftErr) {
    console.log("Notice on shifts upsert:", shiftErr.message);
  } else {
    console.log("✓ Shifts seeded successfully!");
  }

  console.log("🎉 Supabase Database Seed Process Complete!");
}

seed();
