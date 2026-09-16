import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/jwt";

// POST /api/maintenance/upload - Upload maintenance images
// Uses Vercel Blob or falls back to base64 data URL storage
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    const allowedRoles = ["admin", "transport_manager", "staff"];
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json(
        { success: false, message: "Insufficient permissions." },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file provided." },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: "Only JPEG, PNG, WebP, and HEIC images are allowed." },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, message: "File size must be less than 10MB." },
        { status: 400 }
      );
    }

    // Try Vercel Blob upload first, fall back to base64 data URL
    let url: string;

    try {
      // Attempt Vercel Blob upload
      const { put } = await import("@vercel/blob");
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const pathname = `maintenance/${session.userId}/${timestamp}_${safeName}`;

      const blob = await put(pathname, file, {
        access: "public",
      });

      url = blob.url;
    } catch {
      // Fallback: Convert to base64 data URL (works without Vercel Blob configured)
      const buffer = Buffer.from(await file.arrayBuffer());
      url = `data:${file.type};base64,${buffer.toString("base64")}`;
    }

    return NextResponse.json({
      success: true,
      url,
      message: "File uploaded successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Upload failed." },
      { status: 500 }
    );
  }
}
