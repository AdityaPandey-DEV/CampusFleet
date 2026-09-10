-- ==============================================================================
-- CampusFleet: Transit Zones Master Table
-- Migrates hardcoded zone definitions and semester fees to PostgreSQL
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.transit_zones (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    corridor_description TEXT NOT NULL,
    semester_fee NUMERIC(10,2) NOT NULL,
    installments_allowed INT DEFAULT 2 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS and set public read policies
ALTER TABLE public.transit_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read transit_zones"
ON public.transit_zones
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow staff and admin write transit_zones"
ON public.transit_zones
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Seed initial official Bhimtal corridor zones
INSERT INTO public.transit_zones (code, name, corridor_description, semester_fee, installments_allowed)
VALUES
('ZONE_A', 'Zone A: Lamachaur & Kaladhungi Corridor', 'Lamachaur Terminal, Amrapali Institute, Kamluvaganja, Bhagwanpur, Fatehpur', 14000.00, 3),
('ZONE_B', 'Zone B: Haldwani City & Mukhani Corridor', 'Kusumkhera, Mukhani Chauraha, Heera Nagar, Tikonia, Unchapul, Bhakda Laldant', 12000.00, 3),
('ZONE_C', 'Zone C: Kathgodam & Bhowali Hills Corridor', 'Kathgodam Rly Station, HMT Ranibagh, Jeolikote, Bhowali Chauraha, Panchakki', 10000.00, 2),
('ZONE_D', 'Zone D: Bhimtal Campus Local Vicinity', 'GEHU Bhimtal Campus, Bhimtal Lake / Daant, Graphic Era IT Park', 6000.00, 2)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    corridor_description = EXCLUDED.corridor_description,
    semester_fee = EXCLUDED.semester_fee,
    installments_allowed = EXCLUDED.installments_allowed,
    updated_at = NOW();
