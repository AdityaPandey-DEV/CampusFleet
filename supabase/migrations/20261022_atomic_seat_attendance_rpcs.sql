-- ============================================================================
-- Migration: Atomic Seat Attendance Transaction RPCs
-- Date: 2026-10-22
-- Description: Deploy 3 PL/pgSQL stored procedures for ACID-compliant seat
--   operations. Replaces the previous 3-step non-atomic write pattern with
--   single-call atomic transactions using FOR UPDATE row-level locking.
--
-- RPCs:
--   1. seat_attendance_transaction  — Book seat + mark attendance (3 tables)
--   2. cancel_seat_transaction      — Full rollback (conductor lock guard)
--   3. switch_seat_transaction      — Atomic seat swap (in-bus switching)
--
-- Tables touched atomically:
--   - bus_reservations  (seat assignment + boarding status + lock state)
--   - attendance_records (verified attendance audit trail + FK backlinks)
--   - seat_attendance   (legacy seat booking compatibility)
--
-- FK integrity:
--   - attendance_records.reservation_id → bus_reservations.id (now populated)
--   - attendance_records.booking_id     → seat_attendance.id  (now populated)
-- ============================================================================


-- ============================================================================
-- RPC 1: seat_attendance_transaction
-- Atomically: Lock reservation → Check seat conflicts → Update reservation
--             → Sync seat_attendance → Insert attendance_record with FK refs
-- ============================================================================
CREATE OR REPLACE FUNCTION seat_attendance_transaction(
  p_reservation_id UUID,
  p_student_id UUID,
  p_seat_number TEXT,
  p_unlock_method TEXT,
  p_verified_by TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation RECORD;
  v_conflict_count INT;
  v_attendance_id TEXT;
  v_booking_id TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Lock the reservation row (prevents concurrent modifications)
  SELECT * INTO v_reservation
  FROM bus_reservations
  WHERE id = p_reservation_id
    AND student_id = p_student_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Reservation not found for this student.');
  END IF;

  -- 2. Check for seat conflicts on this trip (double-booking prevention)
  --    Lock competing rows to prevent TOCTOU race condition
  SELECT COUNT(*) INTO v_conflict_count
  FROM bus_reservations
  WHERE trip_id = v_reservation.trip_id
    AND chosen_seat = p_seat_number
    AND id != p_reservation_id
    AND status NOT IN ('CANCELLED', 'SWITCHED')
  FOR UPDATE;

  IF v_conflict_count > 0 THEN
    RETURN json_build_object('success', false, 'error',
      format('Seat %s is already taken by another student on this trip.', p_seat_number));
  END IF;

  -- Also check seat_attendance (bookings) table for conflicts
  SELECT COUNT(*) INTO v_conflict_count
  FROM seat_attendance
  WHERE trip_id = v_reservation.trip_id
    AND seat_number = p_seat_number
    AND student_id != p_student_id
    AND status IN ('CONFIRMED', 'BOARDED');

  IF v_conflict_count > 0 THEN
    RETURN json_build_object('success', false, 'error',
      format('Seat %s is already booked by another passenger.', p_seat_number));
  END IF;

  -- 3. Atomically update reservation
  UPDATE bus_reservations SET
    chosen_seat = p_seat_number,
    seat_chosen_at = v_now,
    status = 'BOARDED',
    boarded_at = v_now,
    lock_status = 'UNLOCKED',
    unlocked_by = CASE
      WHEN p_unlock_method ILIKE '%RFID%' THEN 'RFID'
      ELSE 'LOCATION_DISTANCE'
    END,
    unlock_timestamp = v_now
  WHERE id = p_reservation_id;

  -- 4. Sync seat_attendance (bookings) table + capture booking_id for FK
  UPDATE seat_attendance SET
    seat_number = p_seat_number,
    status = 'BOARDED',
    boarded_at = v_now
  WHERE trip_id = v_reservation.trip_id
    AND student_id = p_student_id
  RETURNING id INTO v_booking_id;

  -- 5. Insert attendance record with all FK references populated
  v_attendance_id := 'att-txn-' || EXTRACT(EPOCH FROM v_now)::BIGINT;
  INSERT INTO attendance_records (
    id, student_id, trip_id, bus_id, method, status,
    verified_by, notes, signature_token, timestamp,
    lock_status, unlocked_by, unlock_timestamp,
    reservation_id, booking_id
  ) VALUES (
    v_attendance_id, p_student_id, v_reservation.trip_id,
    v_reservation.bus_id, p_unlock_method, 'BOARDED',
    p_verified_by, COALESCE(p_notes, 'Atomic seat attendance transaction'),
    'TXN-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 8)),
    v_now, 'UNLOCKED',
    CASE WHEN p_unlock_method ILIKE '%RFID%' THEN 'RFID' ELSE 'LOCATION_DISTANCE' END,
    v_now,
    p_reservation_id,
    v_booking_id
  );

  -- 6. Return success
  RETURN json_build_object(
    'success', true,
    'reservationId', p_reservation_id,
    'seatNumber', p_seat_number,
    'attendanceId', v_attendance_id,
    'bookingId', v_booking_id,
    'message', format('✓ Seat %s confirmed & attendance marked.', p_seat_number)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- ============================================================================
-- RPC 2: cancel_seat_transaction
-- Full rollback: Reset reservation → Delete attendance → Reset bookings
-- Blocked when trip.status = 'IN_PROGRESS' (conductor lock)
-- ============================================================================
CREATE OR REPLACE FUNCTION cancel_seat_transaction(
  p_reservation_id UUID,
  p_student_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation RECORD;
BEGIN
  -- 1. Lock reservation + check trip status in one query
  SELECT r.*, t.status AS trip_status
  INTO v_reservation
  FROM bus_reservations r
  LEFT JOIN trips t ON t.id = r.trip_id
  WHERE r.id = p_reservation_id
    AND r.student_id = p_student_id
  FOR UPDATE OF r;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Reservation not found.');
  END IF;

  -- 2. CONDUCTOR LOCK: Block cancellation if trip is IN_PROGRESS
  IF v_reservation.trip_status = 'IN_PROGRESS' THEN
    RETURN json_build_object('success', false, 'error',
      'Trip is in progress — the bus has departed. Attendance cannot be cancelled after the conductor starts the trip. You can still switch your seat.',
      'tripLocked', true);
  END IF;

  -- 3. Rollback reservation to pre-attendance state
  UPDATE bus_reservations SET
    chosen_seat = NULL,
    seat_chosen_at = NULL,
    status = 'ASSIGNED',
    boarded_at = NULL,
    lock_status = 'LOCKED',
    unlocked_by = NULL,
    unlock_timestamp = NULL,
    distance_meters = NULL
  WHERE id = p_reservation_id;

  -- 4. Delete today's attendance records for this student+trip
  DELETE FROM attendance_records
  WHERE student_id = p_student_id
    AND trip_id = v_reservation.trip_id
    AND timestamp >= CURRENT_DATE::TIMESTAMPTZ;

  -- 5. Reset seat_attendance (bookings) table entry
  UPDATE seat_attendance SET
    seat_number = NULL,
    status = 'CONFIRMED',
    boarded_at = NULL
  WHERE trip_id = v_reservation.trip_id
    AND student_id = p_student_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Seat cancelled and attendance rolled back successfully. You can re-select a seat.'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- ============================================================================
-- RPC 3: switch_seat_transaction
-- Atomic swap: Lock old seat → Verify new seat available → Swap
-- Allowed even when trip.status = 'IN_PROGRESS' (in-bus switching)
-- ============================================================================
CREATE OR REPLACE FUNCTION switch_seat_transaction(
  p_reservation_id UUID,
  p_student_id UUID,
  p_new_seat_number TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation RECORD;
  v_old_seat TEXT;
  v_conflict_count INT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Lock reservation
  SELECT * INTO v_reservation
  FROM bus_reservations
  WHERE id = p_reservation_id
    AND student_id = p_student_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Reservation not found.');
  END IF;

  v_old_seat := v_reservation.chosen_seat;

  IF v_old_seat IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No current seat to switch from. Use seat selection instead.');
  END IF;

  IF v_old_seat = p_new_seat_number THEN
    RETURN json_build_object('success', true, 'message', 'Already on this seat.', 'oldSeat', v_old_seat, 'newSeat', p_new_seat_number);
  END IF;

  -- 2. Check new seat availability (lock competing rows to prevent race)
  SELECT COUNT(*) INTO v_conflict_count
  FROM bus_reservations
  WHERE trip_id = v_reservation.trip_id
    AND chosen_seat = p_new_seat_number
    AND id != p_reservation_id
    AND status NOT IN ('CANCELLED', 'SWITCHED')
  FOR UPDATE;

  IF v_conflict_count > 0 THEN
    RETURN json_build_object('success', false, 'error',
      format('Seat %s is already occupied. Please choose another seat.', p_new_seat_number));
  END IF;

  -- Also check seat_attendance (bookings)
  SELECT COUNT(*) INTO v_conflict_count
  FROM seat_attendance
  WHERE trip_id = v_reservation.trip_id
    AND seat_number = p_new_seat_number
    AND student_id != p_student_id
    AND status IN ('CONFIRMED', 'BOARDED');

  IF v_conflict_count > 0 THEN
    RETURN json_build_object('success', false, 'error',
      format('Seat %s is taken in bookings. Choose another.', p_new_seat_number));
  END IF;

  -- 3. Atomic swap: update reservation seat
  UPDATE bus_reservations SET
    chosen_seat = p_new_seat_number,
    seat_chosen_at = v_now
  WHERE id = p_reservation_id;

  -- 4. Update latest attendance record notes
  UPDATE attendance_records SET
    notes = format('Seat switched: %s → %s at %s', v_old_seat, p_new_seat_number, v_now)
  WHERE student_id = p_student_id
    AND trip_id = v_reservation.trip_id
    AND timestamp >= CURRENT_DATE::TIMESTAMPTZ;

  -- 5. Sync seat_attendance (bookings)
  UPDATE seat_attendance SET
    seat_number = p_new_seat_number
  WHERE trip_id = v_reservation.trip_id
    AND student_id = p_student_id;

  RETURN json_build_object(
    'success', true,
    'oldSeat', v_old_seat,
    'newSeat', p_new_seat_number,
    'message', format('✓ Seat switched from %s → %s', v_old_seat, p_new_seat_number)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- ============================================================================
-- Backfill: Populate FK references in existing attendance_records
-- ============================================================================
UPDATE attendance_records ar
SET reservation_id = br.id
FROM bus_reservations br
WHERE ar.student_id = br.student_id
  AND ar.trip_id = br.trip_id
  AND ar.reservation_id IS NULL;

UPDATE attendance_records ar
SET booking_id = sa.id
FROM seat_attendance sa
WHERE ar.student_id = sa.student_id
  AND ar.trip_id = sa.trip_id
  AND ar.booking_id IS NULL;
