-- ==============================================================================
-- Migration: 20261023_deduplicate_and_enforce_single_student_per_user.sql
-- Description:
--   1. Cleanly merges duplicate student rows for users into their canonical record.
--   2. Transfers all relational child records (subscriptions, payment submissions,
--      bus reservations, attendance, halt requests, bus switches, shift allocations).
--   3. Resolves bus reservation and special shift allocation uniqueness collisions.
--   4. Links legacy unlinked `stud-<user_id>` student profiles directly to `users(id)`.
--   5. Enforces strict 1-to-1 integrity: ADD CONSTRAINT uq_students_user_id UNIQUE (user_id).
--   6. Adds index on students(user_id) for instant deterministic lookups.
-- ==============================================================================

BEGIN;

-- Helper function to merge a duplicate student into a canonical student
CREATE OR REPLACE FUNCTION pg_temp.merge_duplicate_student(p_canonical_id text, p_duplicate_id text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_canonical_id IS NULL OR p_duplicate_id IS NULL OR p_canonical_id = p_duplicate_id THEN
    RETURN;
  END IF;

  -- 1. Merge non-null profile attributes from duplicate into canonical if canonical has NULL
  UPDATE public.students c
  SET
    enrollment_no = COALESCE(c.enrollment_no, d.enrollment_no),
    class_id = COALESCE(c.class_id, d.class_id),
    primary_stop_id = COALESCE(c.primary_stop_id, d.primary_stop_id),
    primary_route_id = COALESCE(c.primary_route_id, d.primary_route_id),
    zone_id = COALESCE(c.zone_id, d.zone_id),
    campus_id = COALESCE(c.campus_id, d.campus_id),
    semester = COALESCE(c.semester, d.semester),
    emergency_contact = COALESCE(c.emergency_contact, d.emergency_contact),
    home_address = COALESCE(c.home_address, d.home_address),
    home_latitude = COALESCE(c.home_latitude, d.home_latitude),
    home_longitude = COALESCE(c.home_longitude, d.home_longitude),
    rfid_card_id = COALESCE(c.rfid_card_id, d.rfid_card_id),
    photo_locked = COALESCE(c.photo_locked, d.photo_locked)
  FROM public.students d
  WHERE c.id = p_canonical_id AND d.id = p_duplicate_id;

  -- 2. Handle bus_reservations uniqueness collision on (student_id, shift_id, reservation_date)
  DELETE FROM public.bus_reservations br_dup
  WHERE br_dup.student_id = p_duplicate_id
    AND EXISTS (
      SELECT 1 FROM public.bus_reservations br_can
      WHERE br_can.student_id = p_canonical_id
        AND br_can.shift_id = br_dup.shift_id
        AND br_can.reservation_date = br_dup.reservation_date
    );

  UPDATE public.bus_reservations SET student_id = p_canonical_id WHERE student_id = p_duplicate_id;

  -- 3. Handle special_shift_allocations uniqueness collision on (shift_id, student_id)
  DELETE FROM public.special_shift_allocations ssa_dup
  WHERE ssa_dup.student_id = p_duplicate_id
    AND EXISTS (
      SELECT 1 FROM public.special_shift_allocations ssa_can
      WHERE ssa_can.student_id = p_canonical_id
        AND ssa_can.shift_id = ssa_dup.shift_id
    );

  UPDATE public.special_shift_allocations SET student_id = p_canonical_id WHERE student_id = p_duplicate_id;

  -- 4. Repoint all remaining child references across the database
  UPDATE public.subscriptions SET student_id = p_canonical_id WHERE student_id = p_duplicate_id;
  UPDATE public.payment_submissions SET student_id = p_canonical_id WHERE student_id = p_duplicate_id;
  UPDATE public.seat_attendance SET student_id = p_canonical_id WHERE student_id = p_duplicate_id;
  UPDATE public.attendance_records SET student_id = p_canonical_id WHERE student_id = p_duplicate_id;
  UPDATE public.halt_requests SET student_id = p_canonical_id WHERE student_id = p_duplicate_id;
  UPDATE public.bus_switch_requests SET student_id = p_canonical_id WHERE student_id = p_duplicate_id;
  UPDATE public.early_departure_requests SET student_id = p_canonical_id WHERE student_id = p_duplicate_id;

  -- 5. Delete the merged duplicate student row
  DELETE FROM public.students WHERE id = p_duplicate_id;
END;
$$;

-- 1. Merge all confirmed duplicate student accounts into canonical records
-- Harsh Kumar (iamharshukumar@gmail.com) -> canonical: stud-f45990f1-9299-48a8-909a-829862141bd8
UPDATE public.students SET user_id = 'f45990f1-9299-48a8-909a-829862141bd8' WHERE id = 'stud-f45990f1-9299-48a8-909a-829862141bd8';
SELECT pg_temp.merge_duplicate_student('stud-f45990f1-9299-48a8-909a-829862141bd8', 'b5378f21-2ef5-4db9-8a19-78b9ccf8a95c');
SELECT pg_temp.merge_duplicate_student('stud-f45990f1-9299-48a8-909a-829862141bd8', 'c203a4fb-c561-45c6-b452-f3ad7f5a560a');
SELECT pg_temp.merge_duplicate_student('stud-f45990f1-9299-48a8-909a-829862141bd8', '0bbb3240-0b96-4985-8d85-325c76a6a41f');

-- Gaurang Joshi (gaurangjoshi543@gmail.com) -> canonical: 394a7519-3919-422b-b454-f68b1a1b959f
SELECT pg_temp.merge_duplicate_student('394a7519-3919-422b-b454-f68b1a1b959f', 'stud-0199a9f8-478c-412f-a1e8-6f206988ae44');

-- Robosoccer (robosoccer482@gmail.com) -> canonical: 6cae7689-c112-4053-b289-06cb89a41d3d
SELECT pg_temp.merge_duplicate_student('6cae7689-c112-4053-b289-06cb89a41d3d', 'd5faa14a-c4f6-47f0-8bbc-25ce9c615369');

-- Harsh Kumar 2 (kammleeesh@gmail.com) -> canonical: ea4f1645-101e-446d-b307-3cce0fef9658
SELECT pg_temp.merge_duplicate_student('ea4f1645-101e-446d-b307-3cce0fef9658', '44775f26-def5-4292-9c1f-72634e567434');
SELECT pg_temp.merge_duplicate_student('ea4f1645-101e-446d-b307-3cce0fef9658', '100acd63-1933-419e-a316-8ca01dc3e7b1');
SELECT pg_temp.merge_duplicate_student('ea4f1645-101e-446d-b307-3cce0fef9658', 'b1cf450c-a55c-404d-be2d-d4bbe0d147b7');
SELECT pg_temp.merge_duplicate_student('ea4f1645-101e-446d-b307-3cce0fef9658', 'af6c41e0-7e48-43a4-a03e-2c27ba1c5e52');

-- Parth Dalakoti (parthdalakoti482@gmail.com) -> canonical: 1d5c22e9-01b5-4e12-a5bb-f40abdba0390
SELECT pg_temp.merge_duplicate_student('1d5c22e9-01b5-4e12-a5bb-f40abdba0390', 'stud-usr_1789105251441');
SELECT pg_temp.merge_duplicate_student('1d5c22e9-01b5-4e12-a5bb-f40abdba0390', '3135ac68-d796-4116-9e21-99cd25a04680');
SELECT pg_temp.merge_duplicate_student('1d5c22e9-01b5-4e12-a5bb-f40abdba0390', '7015b76c-9c14-4a96-ad68-f35ea72fdf1e');

-- Gjboss (gjboss2606@gmail.com) -> canonical: 332658f1-3f80-4209-bc0b-1e583e14e4ca
SELECT pg_temp.merge_duplicate_student('332658f1-3f80-4209-bc0b-1e583e14e4ca', 'stud-usr_1789452481287_hwk9yk');
SELECT pg_temp.merge_duplicate_student('332658f1-3f80-4209-bc0b-1e583e14e4ca', 'ed1c76d4-f27d-4379-bb6d-2b3dbce23cad');

-- Aditya Pandey (adityapandey.id.in@gmail.com) -> canonical: 1017ac2b-c4e1-40ef-a008-aa44b1541526
SELECT pg_temp.merge_duplicate_student('1017ac2b-c4e1-40ef-a008-aa44b1541526', '768fb694-ccf7-414e-81dc-465a8730920b');
SELECT pg_temp.merge_duplicate_student('1017ac2b-c4e1-40ef-a008-aa44b1541526', 'ef14427f-41a4-4ce6-a8f1-f1da34659b23');
SELECT pg_temp.merge_duplicate_student('1017ac2b-c4e1-40ef-a008-aa44b1541526', 'c7ebafad-3120-44e8-9a67-a2dec30f4906');

-- Kartik Bisht (kartikbisht940@gmail.com) -> canonical: stud-4d3ef3dc-4425-4ee4-b1cc-059aaac5d28c
UPDATE public.students SET user_id = '4d3ef3dc-4425-4ee4-b1cc-059aaac5d28c' WHERE id = 'stud-4d3ef3dc-4425-4ee4-b1cc-059aaac5d28c';
SELECT pg_temp.merge_duplicate_student('stud-4d3ef3dc-4425-4ee4-b1cc-059aaac5d28c', '33843de5-937a-47c3-960d-47b6e60e1b38');

-- Prince Percia (pricepersia1234@gmail.com) -> canonical: 80c6f676-5af4-483c-8289-9f2076cd1145
UPDATE public.students SET user_id = '1d46cb73-8ed8-4715-befb-f51af5072d01' WHERE id = '80c6f676-5af4-483c-8289-9f2076cd1145' AND user_id IS NULL;

-- Remove abandoned empty row with null user_id
DELETE FROM public.students WHERE id = 'e69fbe72-596e-42b4-b139-7b2ac178cfea';

-- 2. Link all remaining orphaned `stud-<user_id>` student profiles directly to `users(id)`
UPDATE public.students s
SET user_id = substring(s.id from 6)
WHERE s.user_id IS NULL
  AND s.id LIKE 'stud-%'
  AND substring(s.id from 6) IN (SELECT id FROM public.users);

-- 3. Enforce strict 1-to-1 database constraint on user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_students_user_id'
  ) THEN
    ALTER TABLE public.students ADD CONSTRAINT uq_students_user_id UNIQUE (user_id);
  END IF;
END
$$;

-- 4. Create index on students(user_id) for instant deterministic lookups
CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);

COMMIT;
