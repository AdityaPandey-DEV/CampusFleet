-- Migration: Create maintenance_requests table
-- This table stores the register-style maintenance requests
-- matching the physical register columns: S.No, Date, Vehicle No., Item, Qty, Rate, Amount

CREATE TABLE IF NOT EXISTS maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_no INTEGER NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  vehicle_no TEXT NOT NULL,
  bus_id UUID,
  item TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  defect_description TEXT DEFAULT '',
  defect_image_urls TEXT[] DEFAULT '{}',
  work_done_description TEXT DEFAULT '',
  work_done_image_urls TEXT[] DEFAULT '{}',
  payment_receipt_url TEXT,
  payment_transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  requested_by UUID,
  requested_by_name TEXT DEFAULT 'Staff',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  remarks TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by status and date
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_status ON maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_date ON maintenance_requests(date DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_vehicle ON maintenance_requests(vehicle_no);

-- Enable RLS
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access (our API routes use supabaseAdmin)
CREATE POLICY "Service role full access on maintenance_requests"
  ON maintenance_requests
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_maintenance_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_maintenance_requests_updated_at
  BEFORE UPDATE ON maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_maintenance_requests_updated_at();
