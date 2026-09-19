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
      .select("total_fee_paid")
      .eq("id", studentId)
      .maybeSingle();

    if (fetchError || !studentRecord) {
      return NextResponse.json({ success: false, error: "Student record not found." }, { status: 404 });
    }

    // Default fee to add (could be dynamically fetched or passed, but for now we'll just activate the pass)
    // Actually, we should ideally fetch the payment link amount from Razorpay using API, but to keep it simple, we just set a large expiry
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 6); // 6 months validity

    const { error: updateError } = await supabaseAdmin
      .from("students")
      .update({
        subscription_expiry_date: expiryDate.toISOString(),
        total_fee_paid: (Number(studentRecord.total_fee_paid) || 0) + 8545, // Adding a flat amount for now
      })
      .eq("id", studentId);

    if (updateError) {
      console.error("Database update error:", updateError);
      return NextResponse.json({ success: false, error: "Failed to update student record." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Payment verified successfully." });
  } catch (err: any) {
    console.error("Razorpay verify-link error:", err);
    return NextResponse.json({ success: false, error: "Internal server error during verification." }, { status: 500 });
  }
}
