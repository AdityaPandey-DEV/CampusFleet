import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSessionFromRequest } from "@/lib/jwt";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { 
      razorpay_payment_id, 
      razorpay_payment_link_id, 
      razorpay_payment_link_reference_id,
      razorpay_payment_link_status,
      razorpay_signature,
      studentId: providedStudentId
    } = body;

    if (!razorpay_payment_id || !razorpay_payment_link_id || !razorpay_signature || !razorpay_payment_link_reference_id || !razorpay_payment_link_status) {
      return NextResponse.json({ success: false, error: "Missing required payment parameters." }, { status: 400 });
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { success: false, error: "Razorpay credentials not configured on the server." },
        { status: 500 }
      );
    }
    const keySecret = process.env.RAZORPAY_KEY_SECRET.trim().replace(/['"]/g, "");

    // Razorpay signature for payment links:
    // HMAC-SHA256(payment_link_id + "|" + payment_link_reference_id + "|" + payment_link_status + "|" + payment_id, secret)
    const generatedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_payment_link_id}|${razorpay_payment_link_reference_id}|${razorpay_payment_link_status}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json({ success: false, error: "Invalid payment signature. Verification failed." }, { status: 400 });
    }

    // Mark as paid in database
    // Get studentId from the frontend payload or fallback to old reference_id format
    let studentId = providedStudentId;
    if (!studentId) {
      const refParts = razorpay_payment_link_reference_id.split("_");
      if (refParts.length >= 2 && refParts[1].length > 10) {
        studentId = refParts[1];
      }
    }

    if (!studentId) {
      return NextResponse.json({ success: false, error: "Could not determine student ID from payment reference." }, { status: 400 });
    }

    const { data: studentRecord, error: fetchError } = await supabaseAdmin
      .from("students")
      .select("total_fee_paid, full_name, zone_code")
      .eq("id", studentId)
      .maybeSingle();

    if (fetchError || !studentRecord) {
      return NextResponse.json({ success: false, error: "Student record not found." }, { status: 404 });
    }

    // Check if we already processed this payment
    const { data: existingTxn } = await supabaseAdmin
      .from("payment_submissions")
      .select("id")
      .eq("transaction_id", razorpay_payment_id)
      .maybeSingle();

    if (!existingTxn) {
      // 1. Insert into payment_submissions so it shows in the app history
      // This will trigger the `trg_fulfill_subscription_submissions_insert` trigger
      // which handles extending the subscription logically.
      const receiptNumber = `RZP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      await supabaseAdmin.from("payment_submissions").insert({
        student_id: studentId,
        student_name: studentRecord.full_name || "Student",
        zone_code: studentRecord.zone_code || "ZONE_B",
        amount: 8545,
        receipt_url: `https://dashboard.razorpay.com/app/payments/${razorpay_payment_id}`,
        transaction_id: razorpay_payment_id,
        auto_detected: true,
        status: "APPROVED",
        receipt_number: receiptNumber
      });
    }

    // 4. Actively write TRUE to Redis so the user is INSTANTLY authorized on the portal!
    const { cacheSet } = await import("@/lib/redis");
    await cacheSet(`student:subscription:${studentId}`, true, 300); // 5 minutes cache

    return NextResponse.json({ success: true, message: "Payment verified and recorded." });

  } catch (error: any) {
    console.error("Razorpay Link Verification Error:", error);
    return NextResponse.json({ success: false, error: "Server error verifying payment link." }, { status: 500 });
  }
}
