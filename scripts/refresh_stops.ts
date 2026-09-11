import fs from "fs";
import { createClient } from "@supabase/supabase-js";

// Load environment variables
const env: Record<string, string> = {};
fs.readFileSync(".env.local", "utf8").split("\n").forEach(line => {
  const idx = line.indexOf("=");
  if (idx > 0) {
    const k = line.substring(0, idx).trim();
    let v = line.substring(idx + 1).trim();
    if (v.startsWith("\"") && v.endsWith("\"")) v = v.slice(1, -1);
    env[k] = v;
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const VERIFIED_STOPS = [
  {
    id: "stop-bhimtal-campus",
    name: "GEHU Bhimtal Campus Terminal",
    code: "GEHU-BHT",
    latitude: 29.375015,
    longitude: 79.529479,
    landmark: "GEHU Main Gate & Fleet Parking Depot, Sattal Road",
    geofence_radius: 90,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_D",
    is_bus_merge_stop: false
  },
  {
    id: "stop-mukhani",
    name: "Mukhani Chauraha",
    code: "BHT-MKH",
    latitude: 29.217931,
    longitude: 79.518550,
    landmark: "Kaladhungi Road & Panchakki Road Junction",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: false
  },
  {
    id: "stop-pilikothi",
    name: "Pilikothi Chauraha",
    code: "PLKT",
    latitude: 29.214449,
    longitude: 79.507949,
    landmark: "Pilikothi Main Crossing & Nawabi Road",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: false
  },
  {
    id: "stop-panchakki",
    name: "Panchakki Chauraha",
    code: "PNCHK",
    latitude: 29.241580,
    longitude: 79.529106,
    landmark: "Panchakki Main Crossing & Haripur Seel",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: false
  },
  {
    id: "stop-kusumkhera",
    name: "Kusumkhera Point",
    code: "BHT-KSK",
    latitude: 29.218995,
    longitude: 79.502493,
    landmark: "Kusumkhera Main Highway Crossing",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: false
  },
  {
    id: "stop-unchapul",
    name: "Unchapul Crossing",
    code: "BHT-UCH",
    latitude: 29.225863,
    longitude: 79.497362,
    landmark: "Unchapul Market Crossing, Kaladhungi Road",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: false
  },
  {
    id: "stop-bhakda-laldant",
    name: "Bhakda & Laldant Road Chauraha",
    code: "BHT-BHK",
    latitude: 29.220554,
    longitude: 79.510529,
    landmark: "Lal Danth Tiraha / Kaladhungi Road",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: true
  },
  {
    id: "stop-kamluvaganja",
    name: "Kamluvaganja Chauraha",
    code: "BHT-KLV",
    latitude: 29.208323,
    longitude: 79.458978,
    landmark: "Kamaluwaganja Mehta Crossing",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: true
  },
  {
    id: "stop-lamachaur",
    name: "Lamachaur Starting Point",
    code: "BHT-LMC",
    latitude: 29.223031,
    longitude: 79.431084,
    landmark: "Lamachaur Chauraha / Fatehpur Road",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_A",
    is_bus_merge_stop: false
  },
  {
    id: "stop-fatehpur",
    name: "Fatehpur (Katghariya)",
    code: "FTPR",
    latitude: 29.259825,
    longitude: 79.453326,
    landmark: "Fatehpur Katghariya Junction",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_A",
    is_bus_merge_stop: false
  },
  {
    id: "stop-bhagwanpur",
    name: "Bhagwanpur Starting Point",
    code: "BHT-BGW",
    latitude: 29.223845,
    longitude: 79.469714,
    landmark: "Bhagwanpur Bichala Main Chauraha",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: false
  },
  {
    id: "stop-gas-godam",
    name: "Gas Godam Road",
    code: "GSGD",
    latitude: 29.199662,
    longitude: 79.486769,
    landmark: "Gas Godam Road Near HP Gas Plant",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: false
  },
  {
    id: "stop-chharayal",
    name: "Chharayal (S.Mod)",
    code: "CHRY",
    latitude: 29.203250,
    longitude: 79.489980,
    landmark: "Chharayal S-Mod Junction",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: false
  },
  {
    id: "stop-gusaipur",
    name: "Gusai Pur & Gas Godam Road",
    code: "BHT-GSP",
    latitude: 29.205800,
    longitude: 79.488200,
    landmark: "Gusai Pur / Chharayal Road",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: false
  },
  {
    id: "stop-jadge-farm",
    name: "Jadge Farm Starting Point",
    code: "BHT-JGF",
    latitude: 29.211035,
    longitude: 79.512647,
    landmark: "Judge Farm, Pilikothi Road",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: false
  },
  {
    id: "stop-new-iti",
    name: "New ITI & Pilikothi",
    code: "BHT-ITI",
    latitude: 29.206730,
    longitude: 79.512211,
    landmark: "Government ITI, Dhan Mill ITI Road",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: false
  },
  {
    id: "stop-dewal-chaud",
    name: "Dewal Chaud",
    code: "DWLC",
    latitude: 29.190993,
    longitude: 79.520685,
    landmark: "Dewalchaur Bandobasti / Mandi Crossing",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: false
  },
  {
    id: "stop-ganna-center",
    name: "Ganna Center - Rampur Road",
    code: "BHT-GNC",
    latitude: 29.157838,
    longitude: 79.480542,
    landmark: "Ganna Centre, Rampur Road",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: false
  },
  {
    id: "stop-teenpani",
    name: "Teenpani",
    code: "TNPN",
    latitude: 29.193516,
    longitude: 79.512253,
    landmark: "Transport Nagar & Teenpani Bypass Crossing",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: false
  },
  {
    id: "stop-mangalparao",
    name: "Mangalparao",
    code: "MNGP",
    latitude: 29.211082,
    longitude: 79.528190,
    landmark: "Mangal Parao, Bareilly-Nainital Road",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: false
  },
  {
    id: "stop-sindhi-chauraha",
    name: "Sindhi Chauraha",
    code: "SNDC",
    latitude: 29.212225,
    longitude: 79.528166,
    landmark: "Sindhi Chauraha, SH 5 Junction",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: false
  },
  {
    id: "stop-kathgodam",
    name: "Kathgodam Railway Station Point",
    code: "BHT-KGM",
    latitude: 29.266646,
    longitude: 79.546635,
    landmark: "Kathgodam Railway Station Main Gate",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_C",
    is_bus_merge_stop: true
  },
  {
    id: "stop-amritpur",
    name: "Amritpur",
    code: "AMRT",
    latitude: 29.296037,
    longitude: 79.558920,
    landmark: "Amritpur Highway Bridge Crossing",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_C",
    is_bus_merge_stop: false
  },
  {
    id: "stop-gaulapar",
    name: "Gaulapar - Jhutpur",
    code: "BHT-GLP",
    latitude: 29.231200,
    longitude: 79.556800,
    landmark: "Gaula Barrage / Gaulapar Bypass",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: false
  },
  {
    id: "stop-panchayat-ghar",
    name: "Panchayat Ghar & Mehta Colony",
    code: "BHT-PNG",
    latitude: 29.171391,
    longitude: 79.488633,
    landmark: "Panchayat Ghar, Kishanpur",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: false
  },
  {
    id: "stop-gurukul-mod",
    name: "Gurukul Mod",
    code: "GRKL",
    latitude: 29.217788,
    longitude: 79.503506,
    landmark: "Gurukul Vihar West, Kusumkhera",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: false
  },
  {
    id: "stop-trimurti-mandir",
    name: "Trimurti Mandir",
    code: "TRMT",
    latitude: 29.213264,
    longitude: 79.475082,
    landmark: "Trimurti Devi Mandir, Kamaluwaganja Road",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: false
  },
  {
    id: "stop-hanuman-mandir",
    name: "Hanuman Mandir",
    code: "HNMN",
    latitude: 29.221102,
    longitude: 79.498990,
    landmark: "Hanuman Mandir, RTO Road, Kusumkhera",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: false
  },
  {
    id: "stop-halduchaur",
    name: "Halduchaur",
    code: "HLDC",
    latitude: 29.110160,
    longitude: 79.519553,
    landmark: "Halduchaur Main Highway Junction",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: false
  },
  {
    id: "stop-motahaldu",
    name: "Motahaldu",
    code: "MTHD",
    latitude: 29.140418,
    longitude: 79.520928,
    landmark: "Motahaldu Main Bareilly Road",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_B",
    is_bus_merge_stop: false
  },
  {
    id: "stop-lalkuan-nagla",
    name: "Nagla, Lalkuan & Halduchaur",
    code: "BHT-LKU",
    latitude: 29.067863,
    longitude: 79.516614,
    landmark: "Lalkuan Junction / Market",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_A",
    is_bus_merge_stop: false
  },
  {
    id: "stop-bhowali",
    name: "Bhowali Sanatorium Junction",
    code: "BHT-BHW",
    latitude: 29.383497,
    longitude: 79.518839,
    landmark: "Bhowali Main Bus & Taxi Stand",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_C",
    is_bus_merge_stop: false
  },
  {
    id: "stop-nainital-tallital",
    name: "Nainital Bus Stand & Tallital",
    code: "BHT-NTL",
    latitude: 29.375103,
    longitude: 79.463577,
    landmark: "Tallital Bus Station & Rickshaw Stand, Nainital",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_D",
    is_bus_merge_stop: true
  },
  {
    id: "stop-naukuchiatal",
    name: "Naukuchiatal Starting Point",
    code: "BHT-NKH",
    latitude: 29.322630,
    longitude: 79.585568,
    landmark: "Naukuchiatal Lake Bay & Resort Road",
    geofence_radius: 80,
    campus: "GEHU Bhimtal",
    zone_code: "ZONE_D",
    is_bus_merge_stop: false
  }
];

async function execute() {
  console.log("1. Backing up existing route_stops...");
  const { data: routeStopsBackup, error: rsBackupErr } = await supabase.from("route_stops").select("*");
  if (rsBackupErr) throw rsBackupErr;
  console.log(`Backed up ${routeStopsBackup?.length || 0} route_stops`);

  console.log("2. Deleting route_stops referencing stops...");
  const { error: delRsErr } = await supabase.from("route_stops").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delRsErr) throw delRsErr;
  console.log("Route stops cleared.");

  console.log("3. Deleting all existing stops from database...");
  const { error: delStopsErr } = await supabase.from("stops").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delStopsErr) throw delStopsErr;
  console.log("All stops deleted from database.");

  console.log(`4. Pushing ${VERIFIED_STOPS.length} verified stops with accurate OpenStreetMap coordinates...`);
  const { data: insertedStops, error: insErr } = await supabase.from("stops").insert(VERIFIED_STOPS).select();
  if (insErr) throw insErr;
  console.log(`Successfully inserted ${insertedStops.length} stops!`);

  console.log("5. Restoring route_stops...");
  if (routeStopsBackup && routeStopsBackup.length > 0) {
    const { error: restoreErr } = await supabase.from("route_stops").insert(routeStopsBackup);
    if (restoreErr) {
      console.error("Warning restoring route stops:", restoreErr);
    } else {
      console.log(`Successfully restored all ${routeStopsBackup.length} route stops!`);
    }
  }

  // 6. Update routes stops_data JSON cache to keep in sync
  console.log("6. Updating routes cached stops_data...");
  const stopMap = new Map(VERIFIED_STOPS.map(s => [s.id, s]));
  const { data: routes } = await supabase.from("routes").select("*");
  if (routes) {
    for (const route of routes) {
      if (routeStopsBackup) {
        const assigned = routeStopsBackup
          .filter(rs => rs.route_id === route.id)
          .sort((a, b) => a.stop_order - b.stop_order)
          .map(rs => {
            const st = stopMap.get(rs.stop_id);
            return {
              stopId: rs.stop_id,
              stopOrder: rs.stop_order,
              arrivalOffsetMinutes: rs.arrival_offset_minutes || 0,
              bufferTimeMinutes: rs.buffer_time_minutes || 2,
              stop: st ? {
                id: st.id,
                name: st.name,
                code: st.code,
                latitude: st.latitude,
                longitude: st.longitude,
                landmark: st.landmark,
                geofenceRadiusMeters: st.geofence_radius,
                campus: st.campus,
                isBusMergeStop: st.is_bus_merge_stop,
                zoneCode: st.zone_code
              } : null
            };
          });

        await supabase.from("routes").update({ stops_data: assigned }).eq("id", route.id);
      }
    }
    console.log("All routes synchronized with new coordinates.");
  }

  console.log("✓ ALL DONE! Database completely refreshed with accurate GPS coordinates.");
}

execute().catch(e => {
  console.error("FATAL ERROR:", e);
  process.exit(1);
});
