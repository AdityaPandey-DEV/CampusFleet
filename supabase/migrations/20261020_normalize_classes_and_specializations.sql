-- ==============================================================================
-- CampusFleet: Normalized Classes & Academic Structure Migration
-- Normalizes class records: course, department, degree_level, semester_num,
-- year_num, atomic section code, and strict specialization (Core, AIML, CS, Cloud).
-- Also establishes automated triggers for insert/update integrity.
-- ==============================================================================

-- 1. Ensure required columns exist with defaults
ALTER TABLE public.classes 
  ADD COLUMN IF NOT EXISTS specialization TEXT NOT NULL DEFAULT 'Core',
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS degree_level TEXT DEFAULT 'Undergraduate',
  ADD COLUMN IF NOT EXISTS semester_num INT,
  ADD COLUMN IF NOT EXISTS year_num INT,
  ADD COLUMN IF NOT EXISTS section_code TEXT;

-- 2. Clean null or whitespace-only specializations
UPDATE public.classes 
SET specialization = 'Core' 
WHERE specialization IS NULL OR TRIM(specialization) = '';

-- 3. Detect and update specializations from class name and section
-- 3a: Artificial Intelligence & Machine Learning (AIML)
UPDATE public.classes
SET specialization = 'AIML'
WHERE 
  name ILIKE '%AIML%' 
  OR name ILIKE '%AI/ML%' 
  OR name ILIKE '%AI & ML%'
  OR section ILIKE '%AIML%';

-- 3b: Cyber Security / Computer Security (CS)
UPDATE public.classes
SET specialization = 'CS'
WHERE 
  name ILIKE '%(CS)%' 
  OR name ILIKE '%Cyber%'
  OR section ILIKE '%(CS)%';

-- 3c: Cloud Computing
UPDATE public.classes
SET specialization = 'Cloud Computing'
WHERE 
  name ILIKE '%Cloud%' 
  OR section ILIKE '%Cloud%';

-- 3d: Data Science
UPDATE public.classes
SET specialization = 'Data Science'
WHERE 
  name ILIKE '%Data Science%' 
  OR name ILIKE '%(DS)%'
  OR section ILIKE '%Data Science%';

-- 4. Clean up section column (strip parenthetical notes like ' (AIML)' or ' (CS)')
UPDATE public.classes
SET 
  section = TRIM(REGEXP_REPLACE(section, '\s*\([^)]*\)', '', 'g')),
  section_code = TRIM(REGEXP_REPLACE(section, '\s*\([^)]*\)', '', 'g'))
WHERE section LIKE '%(%';

-- 5. Normalize Department based on Course
UPDATE public.classes
SET department = CASE 
  WHEN course ILIKE '%CSE%' THEN 'Computer Science & Engineering'
  WHEN course ILIKE '%ECE%' THEN 'Electronics & Communication Engineering'
  WHEN course ILIKE '%BCA%' OR course ILIKE '%MCA%' THEN 'Computer Applications'
  WHEN department IS NULL OR TRIM(department) = '' THEN 'Engineering & Technology'
  ELSE department
END
WHERE department IS NULL OR TRIM(department) = '';

-- 6. Normalize Year & Semester numeric values
UPDATE public.classes
SET 
  semester_num = COALESCE(NULLIF(SUBSTRING(semester FROM '([0-9]+)'), '')::INT, 1),
  year_num = COALESCE(NULLIF(SUBSTRING(year FROM '([0-9]+)'), '')::INT, 1)
WHERE semester_num IS NULL OR year_num IS NULL;

-- 7. Standardize canonical display name across all rows
UPDATE public.classes
SET name = CASE 
  WHEN specialization IS NOT NULL AND specialization <> 'Core' THEN
    course || ' - ' || semester || ' (Section ' || section || ' (' || specialization || '))'
  ELSE
    course || ' - ' || semester || ' (Section ' || section || ')'
END;

-- 8. Synchronize enrolled students' class_name with the normalized class name
UPDATE public.students s
SET class_name = c.name
FROM public.classes c
WHERE s.class_id = c.id;

-- 9. Automated Trigger function to normalize class records on INSERT or UPDATE
CREATE OR REPLACE FUNCTION public.fn_normalize_class_record()
RETURNS TRIGGER AS $$
BEGIN
  -- Default to 'Core' if empty
  IF NEW.specialization IS NULL OR TRIM(NEW.specialization) = '' THEN
    NEW.specialization := 'Core';
  END IF;

  -- Auto-detect specialization from name or section if left as default Core
  IF NEW.specialization = 'Core' THEN
    IF NEW.name ILIKE '%AIML%' OR NEW.name ILIKE '%AI/ML%' OR NEW.name ILIKE '%AI & ML%' OR NEW.section ILIKE '%AIML%' THEN
      NEW.specialization := 'AIML';
    ELSIF NEW.name ILIKE '%(CS)%' OR NEW.name ILIKE '%Cyber%' OR NEW.section ILIKE '%(CS)%' THEN
      NEW.specialization := 'CS';
    ELSIF NEW.name ILIKE '%Cloud%' OR NEW.section ILIKE '%Cloud%' THEN
      NEW.specialization := 'Cloud Computing';
    ELSIF NEW.name ILIKE '%Data Science%' OR NEW.name ILIKE '%(DS)%' THEN
      NEW.specialization := 'Data Science';
    END IF;
  END IF;

  -- Clean section of any bracketed tags
  NEW.section := TRIM(REGEXP_REPLACE(NEW.section, '\s*\([^)]*\)', '', 'g'));
  NEW.section_code := NEW.section;

  -- Compute numeric values
  NEW.semester_num := COALESCE(NULLIF(SUBSTRING(NEW.semester FROM '([0-9]+)'), '')::INT, 1);
  NEW.year_num := COALESCE(NULLIF(SUBSTRING(NEW.year FROM '([0-9]+)'), '')::INT, 1);

  -- Normalize department if empty
  IF NEW.department IS NULL OR TRIM(NEW.department) = '' THEN
    IF NEW.course ILIKE '%CSE%' THEN
      NEW.department := 'Computer Science & Engineering';
    ELSIF NEW.course ILIKE '%ECE%' THEN
      NEW.department := 'Electronics & Communication Engineering';
    ELSIF NEW.course ILIKE '%BCA%' OR NEW.course ILIKE '%MCA%' THEN
      NEW.department := 'Computer Applications';
    ELSE
      NEW.department := 'Engineering & Technology';
    END IF;
  END IF;

  -- Standardize display name
  IF NEW.specialization <> 'Core' THEN
    NEW.name := NEW.course || ' - ' || NEW.semester || ' (Section ' || NEW.section || ' (' || NEW.specialization || '))';
  ELSE
    NEW.name := NEW.course || ' - ' || NEW.semester || ' (Section ' || NEW.section || ')';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind trigger
DROP TRIGGER IF EXISTS trg_normalize_class_record ON public.classes;
CREATE TRIGGER trg_normalize_class_record
  BEFORE INSERT OR UPDATE ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_normalize_class_record();

-- 10. Re-apply unique constraint for normalized uniqueness
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_course_year_section_key;
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_course_sem_sec_spec_key;
ALTER TABLE public.classes ADD CONSTRAINT classes_course_sem_sec_spec_key 
  UNIQUE (course, semester, section, specialization);
