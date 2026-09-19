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
      razorpay_signature 
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
    // We get the studentId from the reference_id (ref_{studentId}_{timestamp})
    const refParts = razorpay_payment_link_reference_id.split("_");
    const studentId = refParts[1];

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
      // Default fee to add (could be dynamically fetched or passed, but for now we'll just activate the pass)
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 6); // 6 months validity

      // Update student table
      const { error: updateError } = await supabaseAdmin
        .from("students")
        .update({
          subscription_expiry_date: expiryDate.toISOString(),
          total_fee_paid: (Number(studentRecord.total_fee_paid) || 0) + 8545,
          payment_status: "APPROVED"
        })
        .eq("id", studentId);

      if (updateError) {
        console.error("Database update error:", updateError);
        return NextResponse.json({ success: false, error: "Failed to update student record." }, { status: 500 });
      }

      // Insert into payment_submissions so it shows in the app history
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

    return NextResponse.json({ success: true, message: "Payment verified successfully." });
  } catch (err: any) {
    console.error("Razorpay verify-link error:", err);
    return NextResponse.json({ success: false, error: "Internal server error during verification." }, { status: 500 });
  }
}
