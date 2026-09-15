-- ==============================================================================
-- Migration: 20260915_booking_integrity_locks.sql
-- Goal: Enforce atomic seat reservations, prevent double-booking collisions,
--       and lock multi-bus bookings (max 1 active seat per student per shift).
-- ==============================================================================

-- 1. Partial Unique Index: Prevent duplicate active bookings on the same physical seat on a trip
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_trip_seat
ON public.bookings(trip_id, seat_number)
WHERE status IN ('CONFIRMED', 'BOARDED');

-- 2. Trigger Function: Enforce Single-Seat-Per-Shift Mutual Exclusion Lock
CREATE OR REPLACE FUNCTION public.check_single_active_booking_per_shift()
RETURNS TRIGGER AS $$
DECLARE
    target_shift_id TEXT;
    target_trip_date DATE;
    existing_count INTEGER;
    conflicting_trip_code TEXT;
    conflicting_bus_number TEXT;
BEGIN
    -- Only enforce on active booking states (ignore CANCELLED / EXPIRED)
    IF NEW.status NOT IN ('CONFIRMED', 'WAITLISTED', 'BOARDED') THEN
        RETURN NEW;
    END IF;

    -- Lookup trip details
    SELECT shift_id, trip_date INTO target_shift_id, target_trip_date
    FROM public.trips
    WHERE id = NEW.trip_id;

    IF target_shift_id IS NOT NULL THEN
        -- Check if student already has an active booking on ANY trip belonging to this shift & date
        SELECT COUNT(*), MAX(t.trip_code), MAX(b.bus_number)
        INTO existing_count, conflicting_trip_code, conflicting_bus_number
        FROM public.bookings bk
        JOIN public.trips t ON t.id = bk.trip_id
        LEFT JOIN public.buses b ON b.id = t.bus_id
        WHERE bk.student_id = NEW.student_id
          AND bk.id != NEW.id
          AND t.shift_id = target_shift_id
          AND (t.trip_date = target_trip_date OR (target_trip_date IS NULL AND t.trip_date = CURRENT_DATE))
          AND bk.status IN ('CONFIRMED', 'WAITLISTED', 'BOARDED');

        IF existing_count > 0 THEN
            RAISE EXCEPTION 'SHIFT_BOOKING_LOCKED: Student already holds an active booking on Bus % (%) for this shift. Commuters are limited to 1 active reservation per shift.',
                COALESCE(conflicting_bus_number, 'Campus Bus'),
                COALESCE(conflicting_trip_code, 'Scheduled Trip');
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach Trigger to public.bookings
DROP TRIGGER IF EXISTS trg_check_single_active_booking_per_shift ON public.bookings;
CREATE TRIGGER trg_check_single_active_booking_per_shift
BEFORE INSERT OR UPDATE OF status, trip_id, student_id ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.check_single_active_booking_per_shift();

-- 4. Fast Query Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_student_status ON public.bookings(student_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_trip_status ON public.bookings(trip_id, status);
