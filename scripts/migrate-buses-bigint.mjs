import fs from "fs";
import pg from "pg";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf-8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^['\"]|['\"]$/g, "")];
    })
);

const client = new pg.Client({ connectionString: env.POSTGRES_PRISMA_URL });

async function runMigration() {
  console.log("=== STARTING BUSES BIGINT IDENTITY MIGRATION ===");
  await client.connect();

  try {
    await client.query("BEGIN;");

    console.log("1. Dropping dependent views...");
    await client.query(`
      DROP VIEW IF EXISTS bookings_full CASCADE;
      DROP VIEW IF EXISTS bookings CASCADE;
      DROP VIEW IF EXISTS vehicle_issues_full CASCADE;
      DROP VIEW IF EXISTS v_transport_shift_demands CASCADE;
      DROP VIEW IF EXISTS stop_routes CASCADE;
    `);

    console.log("2. Dropping existing foreign key constraints on buses(id)...");
    const dropFks = [
      "ALTER TABLE trips DROP CONSTRAINT IF EXISTS fk_trips_buses;",
      "ALTER TABLE seat_attendance DROP CONSTRAINT IF EXISTS fk_bookings_buses;",
      "ALTER TABLE bus_merge_suggestions DROP CONSTRAINT IF EXISTS fk_bms_source_bus;",
      "ALTER TABLE bus_merge_suggestions DROP CONSTRAINT IF EXISTS fk_bms_target_bus;",
      "ALTER TABLE bus_switch_requests DROP CONSTRAINT IF EXISTS fk_bsr_curr_bus;",
      "ALTER TABLE bus_switch_requests DROP CONSTRAINT IF EXISTS fk_bsr_req_bus;",
      "ALTER TABLE bus_switch_requests DROP CONSTRAINT IF EXISTS fk_bsr_alt_bus;",
      "ALTER TABLE bus_reservations DROP CONSTRAINT IF EXISTS fk_br_buses;",
      "ALTER TABLE maintenance_logs DROP CONSTRAINT IF EXISTS fk_ml_buses;",
      "ALTER TABLE maintenance_requests DROP CONSTRAINT IF EXISTS fk_mr_buses;",
      "ALTER TABLE dynamic_route_plans DROP CONSTRAINT IF EXISTS fk_drp_buses;",
      "ALTER TABLE bus_departure_alerts DROP CONSTRAINT IF EXISTS fk_bda_buses;",
      "ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS fk_attendance_buses;",
      "ALTER TABLE vehicle_issues DROP CONSTRAINT IF EXISTS fk_vehicle_issues_buses;",
      "ALTER TABLE shift_demands DROP CONSTRAINT IF EXISTS shift_demands_assigned_bus_id_fkey;"
    ];
    for (const q of dropFks) {
      await client.query(q);
    }

    console.log("3. Mapping text IDs to integer strings in referencing tables...");
    const caseMapping = `
      CASE %COL%
        WHEN 'bus-02' THEN '2'
        WHEN 'bus-03' THEN '3'
        WHEN 'bus-08' THEN '8'
        WHEN 'bus-09' THEN '9'
        WHEN 'bus-11' THEN '11'
        WHEN 'bus-21' THEN '21'
        WHEN 'bus-36' THEN '36'
        WHEN 'bus-37' THEN '37'
        WHEN 'bus-40' THEN '40'
        WHEN 'bus-43' THEN '43'
        WHEN 'bus-44' THEN '44'
        WHEN 'bus-45' THEN '45'
        WHEN 'bus-49' THEN '49'
        WHEN 'bus-50' THEN '50'
        WHEN 'bus-tempo' THEN '51'
        ELSE %COL%
      END
    `;

    const tablesToMap = [
      { table: "trips", col: "bus_id" },
      { table: "seat_attendance", col: "bus_id" },
      { table: "bus_merge_suggestions", col: "source_bus_id" },
      { table: "bus_merge_suggestions", col: "target_bus_id" },
      { table: "bus_switch_requests", col: "current_bus_id" },
      { table: "bus_switch_requests", col: "requested_bus_id" },
      { table: "bus_switch_requests", col: "ai_alternative_bus_id" },
      { table: "bus_reservations", col: "bus_id" },
      { table: "maintenance_logs", col: "bus_id" },
      { table: "maintenance_requests", col: "bus_id" },
      { table: "dynamic_route_plans", col: "bus_id" },
      { table: "bus_departure_alerts", col: "bus_id" },
      { table: "attendance_records", col: "bus_id" },
      { table: "vehicle_issues", col: "bus_id" },
      { table: "shift_demands", col: "assigned_bus_id" }
    ];

    for (const item of tablesToMap) {
      const q = `UPDATE ${item.table} SET ${item.col} = ${caseMapping.replace(/%COL%/g, item.col)} WHERE ${item.col} IS NOT NULL;`;
      await client.query(q);
    }

    console.log("4. Updating buses table values (id, bus_number, model)...");
    await client.query(`
      UPDATE buses SET
        id = CASE id
          WHEN 'bus-02' THEN '2'
          WHEN 'bus-03' THEN '3'
          WHEN 'bus-08' THEN '8'
          WHEN 'bus-09' THEN '9'
          WHEN 'bus-11' THEN '11'
          WHEN 'bus-21' THEN '21'
          WHEN 'bus-36' THEN '36'
          WHEN 'bus-37' THEN '37'
          WHEN 'bus-40' THEN '40'
          WHEN 'bus-43' THEN '43'
          WHEN 'bus-44' THEN '44'
          WHEN 'bus-45' THEN '45'
          WHEN 'bus-49' THEN '49'
          WHEN 'bus-50' THEN '50'
          WHEN 'bus-tempo' THEN '51'
          ELSE id
        END,
        bus_number = CASE id
          WHEN 'bus-02' THEN '2'
          WHEN 'bus-03' THEN '3'
          WHEN 'bus-08' THEN '8'
          WHEN 'bus-09' THEN '9'
          WHEN 'bus-11' THEN '11'
          WHEN 'bus-21' THEN '21'
          WHEN 'bus-36' THEN '36'
          WHEN 'bus-37' THEN '37'
          WHEN 'bus-40' THEN '40'
          WHEN 'bus-43' THEN '43'
          WHEN 'bus-44' THEN '44'
          WHEN 'bus-45' THEN '45'
          WHEN 'bus-49' THEN '49'
          WHEN 'bus-50' THEN '50'
          WHEN 'bus-tempo' THEN '51'
          ELSE bus_number
        END,
        model = CASE id
          WHEN 'bus-tempo' THEN 'Force Traveller 12-Seater (Mini-Bus 51)'
          ELSE model
        END;
    `);

    console.log("5. Converting buses table column types & adding identity sequence...");
    await client.query(`
      -- Alter buses.id to BIGINT
      ALTER TABLE buses ALTER COLUMN id TYPE BIGINT USING id::bigint;
      
      -- Add GENERATED ALWAYS AS IDENTITY sequence starting at 52
      ALTER TABLE buses ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (START WITH 52);
      
      -- Alter bus_number to INTEGER and add UNIQUE
      ALTER TABLE buses ALTER COLUMN bus_number TYPE INTEGER USING bus_number::integer;
      ALTER TABLE buses ALTER COLUMN bus_number SET NOT NULL;
      ALTER TABLE buses ADD CONSTRAINT uq_buses_bus_number UNIQUE (bus_number);

      -- Ensure registration_no is UNIQUE
      ALTER TABLE buses ALTER COLUMN registration_no SET NOT NULL;
      ALTER TABLE buses ADD CONSTRAINT uq_buses_registration_no UNIQUE (registration_no);
    `);

    console.log("6. Converting referencing table columns to BIGINT...");
    for (const item of tablesToMap) {
      await client.query(`
        ALTER TABLE ${item.table} ALTER COLUMN ${item.col} TYPE BIGINT USING ${item.col}::bigint;
      `);
    }

    console.log("7. Re-adding foreign key constraints pointing to buses(id)...");
    const reAddFks = [
      "ALTER TABLE trips ADD CONSTRAINT fk_trips_buses FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE RESTRICT;",
      "ALTER TABLE seat_attendance ADD CONSTRAINT fk_bookings_buses FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE;",
      "ALTER TABLE bus_merge_suggestions ADD CONSTRAINT fk_bms_source_bus FOREIGN KEY (source_bus_id) REFERENCES buses(id) ON DELETE CASCADE;",
      "ALTER TABLE bus_merge_suggestions ADD CONSTRAINT fk_bms_target_bus FOREIGN KEY (target_bus_id) REFERENCES buses(id) ON DELETE CASCADE;",
      "ALTER TABLE bus_switch_requests ADD CONSTRAINT fk_bsr_curr_bus FOREIGN KEY (current_bus_id) REFERENCES buses(id) ON DELETE CASCADE;",
      "ALTER TABLE bus_switch_requests ADD CONSTRAINT fk_bsr_req_bus FOREIGN KEY (requested_bus_id) REFERENCES buses(id) ON DELETE CASCADE;",
      "ALTER TABLE bus_switch_requests ADD CONSTRAINT fk_bsr_alt_bus FOREIGN KEY (ai_alternative_bus_id) REFERENCES buses(id) ON DELETE SET NULL;",
      "ALTER TABLE bus_reservations ADD CONSTRAINT fk_br_buses FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE;",
      "ALTER TABLE maintenance_logs ADD CONSTRAINT fk_ml_buses FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE;",
      "ALTER TABLE maintenance_requests ADD CONSTRAINT fk_mr_buses FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE;",
      "ALTER TABLE dynamic_route_plans ADD CONSTRAINT fk_drp_buses FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE;",
      "ALTER TABLE bus_departure_alerts ADD CONSTRAINT fk_bda_buses FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE;",
      "ALTER TABLE attendance_records ADD CONSTRAINT fk_attendance_buses FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE;",
      "ALTER TABLE vehicle_issues ADD CONSTRAINT fk_vehicle_issues_buses FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE;",
      "ALTER TABLE shift_demands ADD CONSTRAINT shift_demands_assigned_bus_id_fkey FOREIGN KEY (assigned_bus_id) REFERENCES buses(id) ON DELETE SET NULL;"
    ];
    for (const q of reAddFks) {
      await client.query(q);
    }

    console.log("8. Recreating views with updated types...");
    await client.query(`
      CREATE OR REPLACE VIEW vehicle_issues_full AS
       SELECT vi.id,
          vi.bus_id,
          bus.bus_number,
          vi.reported_by,
          vi.issue_type,
          vi.severity,
          vi.description,
          vi.status,
          vi.latitude,
          vi.longitude,
          vi.reported_at,
          vi.resolved_at
         FROM vehicle_issues vi
           LEFT JOIN buses bus ON bus.id = vi.bus_id;

      CREATE OR REPLACE VIEW v_transport_shift_demands AS
       SELECT sd.id AS demand_id,
          sd.day_of_week,
          sd.is_today_off,
          sd.incoming_shift_id,
          s_in.name AS incoming_shift_name,
          s_in.start_time AS incoming_start_time,
          sd.outgoing_shift_id,
          s_out.name AS outgoing_shift_name,
          s_out.start_time AS outgoing_start_time,
          c.id AS class_id,
          c.name AS class_name,
          sd.total_students AS enrolled_students_count,
          sd.active_commuters AS active_commuters_count,
          sd.assigned_bus_id,
          b.bus_number AS assigned_bus_number,
          b.capacity AS assigned_bus_capacity
         FROM shift_demands sd
           JOIN classes c ON c.id = sd.class_id
           LEFT JOIN shifts s_in ON s_in.id = sd.incoming_shift_id
           LEFT JOIN shifts s_out ON s_out.id = sd.outgoing_shift_id
           LEFT JOIN buses b ON b.id = sd.assigned_bus_id;

      CREATE OR REPLACE VIEW stop_routes AS
       SELECT route_id,
          stop_id,
          stop_order,
          NULL::bigint AS bus_id,
          now() AS created_at
         FROM route_stops;

      CREATE OR REPLACE VIEW bookings AS
       SELECT id,
          booking_code,
          student_id,
          trip_id,
          boarding_stop_id,
          seat_number,
          status,
          waitlist_position,
          created_at,
          booking_date,
          passenger_type,
          merge_stop_id,
          boarded_at,
          bus_id,
          roaming_status,
          running_grace_until
         FROM seat_attendance;

      CREATE OR REPLACE VIEW bookings_full AS
       SELECT b.id,
          b.booking_code,
          b.student_id,
          b.trip_id,
          COALESCE(b.bus_id, t.bus_id) AS bus_id,
          t.trip_code,
          COALESCE(b.booking_date, t.trip_date::text) AS booking_date,
          b.boarding_stop_id,
          bs.name AS boarding_stop_name,
          b.status,
          b.waitlist_position,
          b.seat_number,
          b.passenger_type,
          b.merge_stop_id,
          b.boarded_at,
          b.created_at
         FROM seat_attendance b
           LEFT JOIN trips t ON t.id = b.trip_id
           LEFT JOIN stops bs ON bs.id = b.boarding_stop_id;
    `);

    await client.query("COMMIT;");
    console.log("✅ MIGRATION COMMITTED SUCCESSFULLY!");
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("❌ MIGRATION FAILED, ROLLED BACK:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
