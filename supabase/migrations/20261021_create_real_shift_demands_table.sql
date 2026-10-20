-- ============================================================================
-- Migration: 20261021_create_real_shift_demands_table.sql
-- Creates the physical demand table: public.shift_demands
-- Stores:
--   - class_id (FK -> classes.id)
--   - day_of_week (MONDAY ... SUNDAY)
--   - incoming_shift_id (FK -> shifts.id)
--   - outgoing_shift_id (FK -> shifts.id)
--   - is_today_off (BOOLEAN)
--   - total_students (Calculated active student demand count)
--   - active_commuters (Active paid transport commuters)
--   - assigned_bus_id (FK -> buses.id for automated fleet allocation)
--
-- Also creates alias views:
--   - public.demands
--   - public.class_shift_demands
-- ============================================================================

-- Step 1: Create real physical table shift_demands
CREATE TABLE IF NOT EXISTS public.shift_demands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    day_of_week TEXT NOT NULL,
    incoming_shift_id TEXT REFERENCES public.shifts(id) ON DELETE SET NULL,
    outgoing_shift_id TEXT REFERENCES public.shifts(id) ON DELETE SET NULL,
    is_today_off BOOLEAN NOT NULL DEFAULT false,
    total_students INTEGER NOT NULL DEFAULT 0,
    active_commuters INTEGER NOT NULL DEFAULT 0,
    assigned_bus_id TEXT REFERENCES public.buses(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_shift_demands_class_day UNIQUE (class_id, day_of_week)
);

-- Step 2: Populate real shift_demands from current classes & student enrollments
INSERT INTO public.shift_demands (
    class_id, 
    day_of_week, 
    incoming_shift_id, 
    outgoing_shift_id, 
    is_today_off,
    total_students,
    active_commuters
)
SELECT 
    c.id AS class_id,
    d.day AS day_of_week,
    CASE WHEN d.day = 'SUNDAY' THEN NULL ELSE 'shift-1' END AS incoming_shift_id,
    CASE 
        WHEN d.day = 'SUNDAY' THEN NULL 
        WHEN d.day = 'SATURDAY' THEN 'shift-halfday' 
        ELSE 'shift-2' 
    END AS outgoing_shift_id,
    CASE WHEN d.day = 'SUNDAY' THEN true ELSE false END AS is_today_off,
    COUNT(st.id) AS total_students,
    COUNT(CASE WHEN st.transport_access_suspended = false THEN 1 END) AS active_commuters
FROM public.classes c
CROSS JOIN (
    VALUES 
        ('MONDAY'), 
        ('TUESDAY'), 
        ('WEDNESDAY'), 
        ('THURSDAY'), 
        ('FRIDAY'), 
        ('SATURDAY'), 
        ('SUNDAY')
) AS d(day)
LEFT JOIN public.students st ON st.class_id = c.id
GROUP BY c.id, d.day
ON CONFLICT (class_id, day_of_week) DO UPDATE SET
    total_students = EXCLUDED.total_students,
    active_commuters = EXCLUDED.active_commuters,
    incoming_shift_id = EXCLUDED.incoming_shift_id,
    outgoing_shift_id = EXCLUDED.outgoing_shift_id,
    is_today_off = EXCLUDED.is_today_off,
    updated_at = NOW();

-- Step 3: Create alias views public.demands and public.class_shift_demands
CREATE OR REPLACE VIEW public.demands AS
SELECT * FROM public.shift_demands;

CREATE OR REPLACE VIEW public.class_shift_demands AS
SELECT * FROM public.shift_demands;

-- Step 4: Recreate v_transport_shift_demands querying the physical shift_demands table
DROP VIEW IF EXISTS public.v_transport_shift_demands CASCADE;

CREATE OR REPLACE VIEW public.v_transport_shift_demands AS
SELECT
    sd.id AS demand_id,
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
FROM public.shift_demands sd
JOIN public.classes c ON c.id = sd.class_id
LEFT JOIN public.shifts s_in ON s_in.id = sd.incoming_shift_id
LEFT JOIN public.shifts s_out ON s_out.id = sd.outgoing_shift_id
LEFT JOIN public.buses b ON b.id = sd.assigned_bus_id;

-- Step 5: Automated trigger function to update student counts in shift_demands
CREATE OR REPLACE FUNCTION public.fn_sync_shift_demands_student_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        IF OLD.class_id IS NOT NULL THEN
            UPDATE public.shift_demands
            SET 
                total_students = (SELECT COUNT(*) FROM public.students WHERE class_id = OLD.class_id),
                active_commuters = (SELECT COUNT(*) FROM public.students WHERE class_id = OLD.class_id AND transport_access_suspended = false),
                updated_at = NOW()
            WHERE class_id = OLD.class_id;
        END IF;
    END IF;

    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.class_id IS NOT NULL THEN
            UPDATE public.shift_demands
            SET 
                total_students = (SELECT COUNT(*) FROM public.students WHERE class_id = NEW.class_id),
                active_commuters = (SELECT COUNT(*) FROM public.students WHERE class_id = NEW.class_id AND transport_access_suspended = false),
                updated_at = NOW()
            WHERE class_id = NEW.class_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_shift_demands_on_students ON public.students;
CREATE TRIGGER trg_sync_shift_demands_on_students
AFTER INSERT OR UPDATE OF class_id, transport_access_suspended OR DELETE
ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_shift_demands_student_count();
