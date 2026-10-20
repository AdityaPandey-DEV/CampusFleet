-- ============================================================================
-- Migration: 20261021_replace_timetables_with_class_shift_schedules.sql
-- 1. Drops legacy class_timetables table (removes period/classroom clutter).
-- 2. Creates public.class_shift_schedules table to store:
--    - class_id (FK -> classes.id)
--    - day_of_week (MONDAY ... SUNDAY)
--    - incoming_shift_id (FK -> shifts.id)
--    - outgoing_shift_id (FK -> shifts.id)
--    - is_today_off (BOOLEAN)
-- 3. Seeds default weekly schedules (Mon-Fri full, Sat half-day, Sun off)
--    for all existing classes.
-- 4. Creates public.v_transport_shift_demands view for transport managers to
--    instantly see aggregated commuter demands by shift and day.
-- ============================================================================

-- Step 1: Drop legacy class_timetables table
DROP TABLE IF EXISTS public.class_timetables CASCADE;

-- Step 2: Create class_shift_schedules table
CREATE TABLE IF NOT EXISTS public.class_shift_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    day_of_week TEXT NOT NULL,
    incoming_shift_id TEXT REFERENCES public.shifts(id) ON DELETE SET NULL,
    outgoing_shift_id TEXT REFERENCES public.shifts(id) ON DELETE SET NULL,
    is_today_off BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_class_shift_schedule UNIQUE (class_id, day_of_week)
);

-- Step 3: Seed default weekly operational schedules for all active classes
INSERT INTO public.class_shift_schedules (class_id, day_of_week, incoming_shift_id, outgoing_shift_id, is_today_off)
SELECT 
    c.id,
    d.day,
    CASE WHEN d.day = 'SUNDAY' THEN NULL ELSE 'shift-1' END,
    CASE 
        WHEN d.day = 'SUNDAY' THEN NULL 
        WHEN d.day = 'SATURDAY' THEN 'shift-halfday' 
        ELSE 'shift-2' 
    END,
    CASE WHEN d.day = 'SUNDAY' THEN true ELSE false END
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
ON CONFLICT (class_id, day_of_week) DO NOTHING;

-- Step 4: Create view v_transport_shift_demands for fleet demand intelligence
DROP VIEW IF EXISTS public.v_transport_shift_demands CASCADE;

CREATE OR REPLACE VIEW public.v_transport_shift_demands AS
SELECT
    css.day_of_week,
    css.is_today_off,
    css.incoming_shift_id,
    s_in.name AS incoming_shift_name,
    s_in.start_time AS incoming_start_time,
    css.outgoing_shift_id,
    s_out.name AS outgoing_shift_name,
    s_out.start_time AS outgoing_start_time,
    c.id AS class_id,
    c.name AS class_name,
    COUNT(st.id) AS enrolled_students_count,
    COUNT(CASE WHEN st.transport_access_suspended = false THEN 1 END) AS active_commuters_count
FROM public.class_shift_schedules css
JOIN public.classes c ON c.id = css.class_id
LEFT JOIN public.shifts s_in ON s_in.id = css.incoming_shift_id
LEFT JOIN public.shifts s_out ON s_out.id = css.outgoing_shift_id
LEFT JOIN public.students st ON st.class_id = c.id
GROUP BY 
    css.day_of_week, 
    css.is_today_off, 
    css.incoming_shift_id, 
    s_in.name, 
    s_in.start_time, 
    css.outgoing_shift_id, 
    s_out.name, 
    s_out.start_time, 
    c.id, 
    c.name;
