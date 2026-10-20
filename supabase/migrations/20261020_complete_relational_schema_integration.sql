-- ==============================================================================
-- Migration: 20261020_complete_relational_schema_integration.sql
-- Completes end-to-end relational foreign key integration across all operational tables:
-- 1. halt_requests -> students (student_id) & trips (trip_id)
-- 2. early_departure_requests -> shifts (shift_id) & users (teacher_id)
-- 3. students -> routes (primary_route_id)
-- 4. users, stops, routes -> campuses (campus_id)
-- 5. trips -> routes (route_id), buses (bus_id), shifts (shift_id)
-- ==============================================================================

-- 1. Heal users campus_id format
UPDATE public.users
SET campus_id = 'campus-gehu-bhimtal'
WHERE campus_id ILIKE '%bhimtal%' OR campus ILIKE '%bhimtal%';

-- 2. Integrate halt_requests
ALTER TABLE public.halt_requests DROP CONSTRAINT IF EXISTS fk_halt_requests_students;
ALTER TABLE public.halt_requests 
  ADD CONSTRAINT fk_halt_requests_students 
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE public.halt_requests DROP CONSTRAINT IF EXISTS fk_halt_requests_trips;
ALTER TABLE public.halt_requests 
  ADD CONSTRAINT fk_halt_requests_trips 
  FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;

-- 3. Integrate early_departure_requests
ALTER TABLE public.early_departure_requests DROP CONSTRAINT IF EXISTS fk_early_dep_shifts;
ALTER TABLE public.early_departure_requests 
  ADD CONSTRAINT fk_early_dep_shifts 
  FOREIGN KEY (shift_id) REFERENCES public.shifts(id) ON DELETE SET NULL;

ALTER TABLE public.early_departure_requests DROP CONSTRAINT IF EXISTS fk_early_dep_teachers;
ALTER TABLE public.early_departure_requests 
  ADD CONSTRAINT fk_early_dep_teachers 
  FOREIGN KEY (teacher_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- 4. Integrate students with primary route
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS fk_students_routes;
ALTER TABLE public.students 
  ADD CONSTRAINT fk_students_routes 
  FOREIGN KEY (primary_route_id) REFERENCES public.routes(id) ON DELETE SET NULL;

-- 5. Integrate users, stops, and routes with campuses
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS fk_users_campuses;
ALTER TABLE public.users 
  ADD CONSTRAINT fk_users_campuses 
  FOREIGN KEY (campus_id) REFERENCES public.campuses(id) ON DELETE SET NULL;

ALTER TABLE public.stops DROP CONSTRAINT IF EXISTS fk_stops_campuses;
ALTER TABLE public.stops 
  ADD CONSTRAINT fk_stops_campuses 
  FOREIGN KEY (campus_id) REFERENCES public.campuses(id) ON DELETE SET NULL;

ALTER TABLE public.routes DROP CONSTRAINT IF EXISTS fk_routes_campuses;
ALTER TABLE public.routes 
  ADD CONSTRAINT fk_routes_campuses 
  FOREIGN KEY (campus_id) REFERENCES public.campuses(id) ON DELETE SET NULL;

-- 6. Integrate trips with routes, buses, and shifts
ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS fk_trips_routes;
ALTER TABLE public.trips 
  ADD CONSTRAINT fk_trips_routes 
  FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE CASCADE;

ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS fk_trips_buses;
ALTER TABLE public.trips 
  ADD CONSTRAINT fk_trips_buses 
  FOREIGN KEY (bus_id) REFERENCES public.buses(id) ON DELETE SET NULL;

ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS fk_trips_shifts;
ALTER TABLE public.trips 
  ADD CONSTRAINT fk_trips_shifts 
  FOREIGN KEY (shift_id) REFERENCES public.shifts(id) ON DELETE SET NULL;
