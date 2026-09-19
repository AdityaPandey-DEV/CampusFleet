import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/jwt";

// Allowed MIME types for receipt images
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// In-memory upload rate limiting
const uploadRateMap = new Map<string, { count: number; windowStart: number }>();
const UPLOAD_RATE_LIMIT = 10; // Max 10 uploads per user per hour
const UPLOAD_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * POST /api/payments/upload-receipt
 *
 * Secure receipt image upload with:
 * - JWT authentication required
 * - File type validation (images only)
 * - File size limit (10MB)
 * - Rate limiting (10 uploads per user per hour)
 */
export async function POST(request: NextRequest) {
  // ── Auth Guard ──────────────────────────────────────────────────────
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Authentication required. Please sign in." },
      { status: 401 }
    );
  }

  // ── Rate Limiting ─────────────────────────────────────────────────
  const rateLimitResult = checkUploadRateLimit(session.userId);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: `Upload limit exceeded. You can upload up to ${UPLOAD_RATE_LIMIT} receipts per hour. Try again later.`,
      },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No image file provided" },
        { status: 400 }
      );
    }

    // ── File Type Validation ────────────────────────────────────────
    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid file type "${file.type}". Only JPEG, PNG, WebP, and HEIC images are accepted.`,
        },
        { status: 400 }
      );
    }

    // ── File Size Validation ────────────────────────────────────────
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        {
          success: false,
          error: `File too large (${sizeMB}MB). Maximum allowed size is 10MB.`,
        },
        { status: 400 }
      );
    }

    // ── File Name Validation ────────────────────────────────────────
    if (file.size === 0) {
      return NextResponse.json(
        { success: false, error: "Uploaded file is empty." },
        { status: 400 }
      );
    }

    // Sanitize filename and create unique timestamped path
    const safeName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .slice(0, 100); // Limit filename length
    const filename = `receipts/${session.userId.slice(0, 8)}/${Date.now()}-${safeName}`;

    // Upload to Vercel Blob Storage using configured BLOB_READ_WRITE_TOKEN
    const blob = await put(filename, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({
      success: true,
      url: blob.url,
      pathname: blob.pathname,
      contentType: blob.contentType,
    });
  } catch (error: any) {
    console.error("Vercel Blob upload error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to upload receipt to Vercel Blob" },
      { status: 500 }
    );
  }
}

/**
 * In-memory rate limiting for file uploads.
 */
function checkUploadRateLimit(userId: string): { allowed: boolean } {
  const now = Date.now();
  const entry = uploadRateMap.get(userId);

  if (!entry || now - entry.windowStart > UPLOAD_RATE_WINDOW_MS) {
    uploadRateMap.set(userId, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (entry.count >= UPLOAD_RATE_LIMIT) {
    return { allowed: false };
  }

  entry.count++;
  return { allowed: true };
}
