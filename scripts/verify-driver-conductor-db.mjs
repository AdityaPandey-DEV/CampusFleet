import fs from "fs";
import pg from "pg";
const { Client } = pg;

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const client = new Client({
  connectionString: env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function verify() {
  console.log("=== VERIFYING DRIVER & CONDUCTOR DATABASE PERSISTENCE ===\n");
  await client.connect();

  // Test 1: Driver Trip Progression in Database
  console.log("1. Testing Driver Trip Status & Milestone Updates in PostgreSQL...");
  const testTripId = "trip-bus-44-m";
  const now = new Date().toISOString();

  // Simulate Start Trip
  await client.query(`
    UPDATE public.trips
    SET status = 'IN_PROGRESS', started_at = $1, current_stop_index = 0
    WHERE id = $2
  `, [now, testTripId]);

  const tripStart = await client.query(`SELECT id, status, started_at, current_stop_index FROM public.trips WHERE id = $1`, [testTripId]);
  console.log("   Trip after Start Trip:", tripStart.rows[0]);
  if (tripStart.rows[0].status !== 'IN_PROGRESS' || tripStart.rows[0].current_stop_index !== 0) {
    throw new Error("Trip start update failed!");
  }
  console.log("   ✓ Driver Start Trip verified in DB!");

  // Simulate Advance Stop
  await client.query(`
    UPDATE public.trips
    SET current_stop_index = 2
    WHERE id = $1
  `, [testTripId]);

  const tripAdvance = await client.query(`SELECT id, status, current_stop_index FROM public.trips WHERE id = $1`, [testTripId]);
  console.log("   Trip after Advance Stop:", tripAdvance.rows[0]);
  if (tripAdvance.rows[0].current_stop_index !== 2) {
    throw new Error("Trip advance update failed!");
  }
  console.log("   ✓ Driver Advance Stop verified in DB!");

  // Test 2: Driver Reporting Incident in Database
  console.log("\n2. Testing Driver Incident Reporting in PostgreSQL...");
  const testIssueId = `test-issue-${Date.now()}`;
  await client.query(`
    INSERT INTO public.vehicle_issues (
      id, bus_id, bus_number, reported_by, issue_type, severity, description, status, reported_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN', $8)
  `, [testIssueId, 'bus-44', 'UK-04-PA-4401', 'Rajesh Kumar (Driver)', 'BREAKDOWN', 'HIGH', 'Engine overheating near Jeolikote bend', now]);

  const issueCheck = await client.query(`SELECT * FROM public.vehicle_issues WHERE id = $1`, [testIssueId]);
  console.log("   Logged Vehicle Issue:", issueCheck.rows[0]);
  if (!issueCheck.rows[0] || issueCheck.rows[0].issue_type !== 'BREAKDOWN') {
    throw new Error("Vehicle issue insert failed!");
  }
  console.log("   ✓ Driver Vehicle Issue verified in DB!");

  // Test 3: Conductor QR Scan & Boarding Update in Database
  console.log("\n3. Testing Conductor QR Attendance & Booking Update in PostgreSQL...");
  const testBookingId = "bk-1";
  const boardTimestamp = new Date().toISOString();

  // Update Booking to BOARDED
  await client.query(`
    UPDATE public.bookings
    SET status = 'BOARDED', boarded_at = $1
    WHERE id = $2
  `, [boardTimestamp, testBookingId]);

  const bkCheck = await client.query(`SELECT id, status, boarded_at FROM public.bookings WHERE id = $1`, [testBookingId]);
  console.log("   Booking after Boarding:", bkCheck.rows[0]);
  if (bkCheck.rows[0].status !== 'BOARDED' || !bkCheck.rows[0].boarded_at) {
    throw new Error("Booking boarding update failed!");
  }
  console.log("   ✓ Booking status='BOARDED' and boarded_at verified in DB!");

  // Insert Attendance Record
  const testAttId = `test-att-${Date.now()}`;
  await client.query(`
    INSERT INTO public.attendance_records (
      id, student_id, booking_id, trip_id, bus_id, method, status, verified_by, signature_token, notes, timestamp
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `, [
    testAttId,
    'stud-1',
    testBookingId,
    testTripId,
    'bus-44',
    'QR_SCAN',
    'BOARDED',
    'University Conductor',
    'SIG-VERIFIED',
    'Test Conductor Verification',
    boardTimestamp,
  ]);

  const attCheck = await client.query(`SELECT * FROM public.attendance_records WHERE id = $1`, [testAttId]);
  console.log("   Attendance Record:", attCheck.rows[0]);
  if (!attCheck.rows[0] || attCheck.rows[0].status !== 'BOARDED') {
    throw new Error("Attendance record insert failed!");
  }
  console.log("   ✓ Conductor Attendance Record verified in DB!");

  // Test 4: Conductor Seat Allocation from Map
  console.log("\n4. Testing Conductor Seat Allocation for Waitlisted Passenger in PostgreSQL...");
  const testWlBookingId = "bk-3"; // waitlisted booking
  await client.query(`
    UPDATE public.bookings
    SET status = 'CONFIRMED', seat_number = '12A', waitlist_position = NULL
    WHERE id = $1
  `, [testWlBookingId]);

  const seatCheck = await client.query(`SELECT id, status, seat_number, waitlist_position FROM public.bookings WHERE id = $1`, [testWlBookingId]);
  console.log("   Booking after Seat Allocation:", seatCheck.rows[0]);
  if (seatCheck.rows[0].status !== 'CONFIRMED' || seatCheck.rows[0].seat_number !== '12A') {
    throw new Error("Seat allocation failed!");
  }
  console.log("   ✓ Seat allocation confirmed in DB!");

  // Clean up test data
  console.log("\n5. Cleaning up test rows...");
  await client.query(`DELETE FROM public.vehicle_issues WHERE id = $1`, [testIssueId]);
  await client.query(`DELETE FROM public.attendance_records WHERE id = $1`, [testAttId]);
  // Reset test booking back to CONFIRMED
  await client.query(`UPDATE public.bookings SET status = 'CONFIRMED', boarded_at = NULL WHERE id = $1`, [testBookingId]);
  await client.query(`UPDATE public.bookings SET status = 'WAITLISTED', seat_number = NULL, waitlist_position = 1 WHERE id = $1`, [testWlBookingId]);
  // Reset test trip back to SCHEDULED
  await client.query(`UPDATE public.trips SET status = 'SCHEDULED', started_at = NULL, current_stop_index = 0 WHERE id = $1`, [testTripId]);
  console.log("   ✓ Cleaned up test data.");

  await client.end();
  console.log("\n=== ALL DRIVER & CONDUCTOR DATABASE VERIFICATIONS PASSED! ===");
}

verify().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
