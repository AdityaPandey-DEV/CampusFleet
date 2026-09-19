-- ==============================================================================
-- CampusFleet: Multi-Receipt Payment System Migration
-- Adds uniqueness constraints, OCR amount columns, and receipt tracking
-- ==============================================================================

-- 1. Add UNIQUE constraint on transaction_id in payment_submissions (global uniqueness)
-- This prevents the same receipt/transaction from being submitted by different students
DO $$
BEGIN
  -- Add scanned_amount column (OCR-detected amount from receipt image)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_submissions' AND column_name = 'scanned_amount'
  ) THEN
    ALTER TABLE public.payment_submissions ADD COLUMN scanned_amount NUMERIC(10, 2);
  END IF;

  -- Add verified_amount column (staff-verified amount, NULL until reviewed)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_submissions' AND column_name = 'verified_amount'
  ) THEN
    ALTER TABLE public.payment_submissions ADD COLUMN verified_amount NUMERIC(10, 2);
  END IF;

  -- Add receipt_number column for internal tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_submissions' AND column_name = 'receipt_number'
  ) THEN
    ALTER TABLE public.payment_submissions ADD COLUMN receipt_number TEXT;
  END IF;

  -- Add ocr_full_text column for audit/debugging OCR extraction
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_submissions' AND column_name = 'ocr_full_text'
  ) THEN
    ALTER TABLE public.payment_submissions ADD COLUMN ocr_full_text TEXT;
  END IF;
END $$;

-- 2. Add unique constraint on transaction_id (prevents receipt reuse globally)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_submissions_transaction_id_unique'
  ) THEN
    ALTER TABLE public.payment_submissions
      ADD CONSTRAINT payment_submissions_transaction_id_unique UNIQUE (transaction_id);
  END IF;
END $$;

-- 3. Add composite index for fast student + status lookups
CREATE INDEX IF NOT EXISTS idx_payment_submissions_student_status
  ON public.payment_submissions (student_id, status);

-- 4. Add index on transaction_id for fast uniqueness checks
CREATE INDEX IF NOT EXISTS idx_payment_submissions_txn_id
  ON public.payment_submissions (transaction_id);

-- 5. Ensure students table has total_fee_due and total_fee_paid columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'total_fee_due'
  ) THEN
    ALTER TABLE public.students ADD COLUMN total_fee_due NUMERIC(10, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'total_fee_paid'
  ) THEN
    ALTER TABLE public.students ADD COLUMN total_fee_paid NUMERIC(10, 2) DEFAULT 0;
  END IF;
END $$;

-- 6. Add auth rate limiting table for brute-force protection
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier TEXT NOT NULL,        -- email or IP address
  action TEXT NOT NULL,             -- 'send_otp', 'verify_otp', 'upload_receipt'
  attempt_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_identifier_action
  ON public.auth_rate_limits (identifier, action, window_start);

-- 7. Add CSRF state tokens table for OAuth flows
CREATE TABLE IF NOT EXISTS public.csrf_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cleanup expired tokens (can be called by cron)
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expires
  ON public.csrf_tokens (expires_at);
