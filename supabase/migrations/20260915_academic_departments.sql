-- ==============================================================================
-- CampusFleet: Academic Departments & Semesters Database Schema
-- Eliminates hardcoded department and semester values in frontend
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.academic_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    degree_level TEXT NOT NULL DEFAULT 'Undergraduate',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.academic_semesters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    order_index INT NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Academic Departments
INSERT INTO public.academic_departments (code, name, degree_level) VALUES
('CSE', 'B.Tech Computer Science & Engineering', 'Undergraduate'),
('AI_DS', 'B.Tech Artificial Intelligence & Data Science', 'Undergraduate'),
('ECE', 'B.Tech Electronics & Communication Engineering', 'Undergraduate'),
('MECH', 'B.Tech Mechanical Engineering', 'Undergraduate'),
('CIVIL', 'B.Tech Civil Engineering', 'Undergraduate'),
('BCA', 'BCA - Bachelor of Computer Applications', 'Undergraduate'),
('MCA', 'MCA - Master of Computer Applications', 'Postgraduate'),
('MBA', 'MBA - Master of Business Administration', 'Postgraduate'),
('BBA', 'BBA - Bachelor of Business Administration', 'Undergraduate'),
('BPHARM', 'B.Pharma - Bachelor of Pharmacy', 'Undergraduate'),
('DPHARM', 'D.Pharma - Diploma in Pharmacy', 'Diploma'),
('BSC_BIOTECH', 'B.Sc Biotechnology / Applied Sciences', 'Undergraduate'),
('LL_B', 'BA LL.B / BBA LL.B (Integrated Law)', 'Undergraduate'),
('POLY_ENG', 'Polytechnic Diploma in Engineering', 'Diploma')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, degree_level = EXCLUDED.degree_level;

-- Seed Academic Semesters
INSERT INTO public.academic_semesters (code, name, order_index) VALUES
('SEM_1', '1st Semester (Freshman)', 1),
('SEM_2', '2nd Semester', 2),
('SEM_3', '3rd Semester (Sophomore)', 3),
('SEM_4', '4th Semester', 4),
('SEM_5', '5th Semester (Junior)', 5),
('SEM_6', '6th Semester', 6),
('SEM_7', '7th Semester (Senior)', 7),
('SEM_8', '8th Semester', 8),
('SEM_9', '9th Semester (Law/Dual-Degree)', 9),
('SEM_10', '10th Semester (Law/Dual-Degree)', 10)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, order_index = EXCLUDED.order_index;
