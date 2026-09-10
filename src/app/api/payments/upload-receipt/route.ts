import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No image file provided" }, { status: 400 });
    }

    // Sanitize filename and create unique timestamped path
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `receipts/${Date.now()}-${safeName}`;

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
