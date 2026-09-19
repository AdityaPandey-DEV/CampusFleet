import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json({ success: false, error: "Missing signature" }, { status: 400 });
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json({ success: false, error: "Webhook secret not configured" }, { status: 500 });
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 400 });
    }

    const body = JSON.parse(rawBody);

    // Handle payment.captured event
    if (body.event === "payment.captured") {
      const payment = body.payload.payment.entity;
      const orderId = payment.order_id;
      const paymentId = payment.id;
      const studentId = payment.notes?.studentId;
      const amountPaid = payment.amount / 100; // Convert from paise back to INR

      if (!studentId) {
        console.error("Webhook payment missing studentId note:", paymentId);
        return NextResponse.json({ success: true, message: "Ignored, missing studentId" });
      }

      // Check if this payment was already processed
      const { data: existingTxn } = await supabaseAdmin
        .from("payment_submissions")
        .select("id")
        .eq("transaction_id", paymentId)
        .maybeSingle();

      if (existingTxn) {
        return NextResponse.json({ success: true, message: "Already processed" });
      }

      // Create payment submission
      const receiptNumber = `RZP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const { data: student } = await supabaseAdmin
        .from("students")
        .select("full_name, zone_code, total_fee_due, total_fee_paid")
        .eq("id", studentId)
        .maybeSingle();

      await supabaseAdmin.from("payment_submissions").insert({
        student_id: studentId,
        student_name: student?.full_name || "Student Commuter",
        zone_code: student?.zone_code || "ZONE_B",
        amount: amountPaid,
        installment_no: 1,
        total_installments: 1,
        transaction_id: paymentId,
        receipt_number: orderId || receiptNumber,
        status: "APPROVED",
        auto_detected: true,
        ocr_full_text: "RAZORPAY_AUTO_SYNC",
      });

      // Update student running balance and activate pass
      const newTotalPaid = Number(student?.total_fee_paid || 0) + amountPaid;
      const amountLeft = Math.max(0, Number(student?.total_fee_due || 0) - newTotalPaid);
      
      const updateData: any = {
        total_fee_paid: newTotalPaid,
      };

      if (amountLeft <= 0) {
        updateData.payment_status = "APPROVED";
        updateData.has_active_subscription = true;
        updateData.transport_access_suspended = false;
      } else {
        updateData.payment_status = "PARTIALLY_PAID";
      }

      await supabaseAdmin
        .from("students")
        .update(updateData)
        .eq("id", studentId);

      await supabaseAdmin.from("audit_logs").insert({
        action: "RAZORPAY_WEBHOOK_PROCESSED",
        user_id: payment.notes?.userId || studentId,
        details: { paymentId, orderId, amountPaid },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Razorpay webhook error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
