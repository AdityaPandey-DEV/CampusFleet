-- Create halt_requests table
CREATE TABLE IF NOT EXISTS public.halt_requests (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    student_photo TEXT,
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.halt_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Students can view their own halt requests" 
    ON public.halt_requests FOR SELECT 
    USING (auth.uid()::text IN (
        SELECT user_id::text FROM public.students WHERE id::text = student_id::text
    ));

CREATE POLICY "Students can insert their own halt requests" 
    ON public.halt_requests FOR INSERT 
    WITH CHECK (auth.uid()::text IN (
        SELECT user_id::text FROM public.students WHERE id::text = student_id::text
    ));

CREATE POLICY "Staff can view all halt requests" 
    ON public.halt_requests FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM public.staff WHERE user_id::text = auth.uid()::text
    ));

CREATE POLICY "Staff can update halt requests" 
    ON public.halt_requests FOR UPDATE 
    USING (EXISTS (
        SELECT 1 FROM public.staff WHERE user_id::text = auth.uid()::text
    ));

-- Create indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_halt_requests_trip_id ON public.halt_requests(trip_id);
CREATE INDEX IF NOT EXISTS idx_halt_requests_student_id ON public.halt_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_halt_requests_status ON public.halt_requests(status);
