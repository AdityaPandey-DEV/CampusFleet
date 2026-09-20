import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function GET(request: NextRequest) {
  // 1. Verify Cron Secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  // Also allow manual trigger via query param for testing by admins
  const { searchParams } = new URL(request.url);
  const testKey = searchParams.get("testKey");
  
  if (
    (!cronSecret || authHeader !== `Bearer ${cronSecret}`) && 
    testKey !== process.env.CRON_SECRET
  ) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ success: false, error: "Razorpay credentials not configured" }, { status: 500 });
  }

  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // Fetch payments from the last 24 hours
    const toTimestamp = Math.floor(Date.now() / 1000);
    const fromTimestamp = toTimestamp - 24 * 60 * 60;

    const paymentsResponse = await razorpay.payments.all({
      from: fromTimestamp,
      to: toTimestamp,
      count: 100, // Process in batches if necessary
    });

    const successfulPayments = paymentsResponse.items.filter((p: any) => p.status === "captured");
    let reconciledCount = 0;
    const reconciledIds = [];

    for (const payment of successfulPayments) {
      const paymentId = payment.id;
      const orderId = payment.order_id;
      const studentId = payment.notes?.studentId;
      const amountPaid = Number(payment.amount) / 100;

      if (!studentId) continue; // Not a CampusFleet payment (or missing notes)

      // Check if already in DB
      const { data: existingTxn } = await supabaseAdmin
        .from("payment_submissions")
        .select("id")
        .eq("transaction_id", paymentId)
        .maybeSingle();

      if (!existingTxn) {
        // Missing! We need to reconcile it
        const receiptNumber = `RZP-REC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

        const { data: student } = await supabaseAdmin
          .from("students")
          .select("full_name, zone_code, total_fee_due, total_fee_paid")
          .eq("id", studentId)
          .maybeSingle();

        const { error: insertErr } = await supabaseAdmin.from("payment_submissions").insert({
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
          ocr_full_text: "RAZORPAY_CRON_RECONCILED",
        });

        // STRICT FINANCIAL COMPLIANCE GUARD:
        // Do NOT credit the student's balance if the receipt insertion failed!
        if (insertErr) {
           // If it's a duplicate (23505), another cron run already handled it safely.
           if (insertErr.code === '23505') continue;

           // If it's a permanent DB constraint failure (e.g. student account deleted, invalid zone),
           // the student paid money but we couldn't credit them! 
           // PERMANENT SOLUTION: Instantly reverse the transaction via Razorpay Refund API
           console.error(`[CRITICAL] Razorpay Payment Captured but DB Insert Failed! Refunding Payment: ${paymentId}`, insertErr);
           
           try {
             // 1. Issue automated refund (amount is in paise)
             await razorpay.payments.refund(paymentId, {
               amount: amountPaid * 100,
               notes: {
                 reason: "Automated refund: Database constraint rejected the receipt.",
               }
             });

             // 2. Log successful automated refund
             await supabaseAdmin.from("audit_logs").insert({
               action: "AUTOMATED_REFUND_ISSUED",
               user_role: "system",
               reason: "CRITICAL: Database rejected receipt. Automated refund issued to protect student's funds.",
               details: { paymentId, orderId, amountPaid, studentId, error: insertErr },
             });
           } catch (refundErr) {
             // If the refund ALSO fails, log a critical escalation alert
             await supabaseAdmin.from("audit_logs").insert({
               action: "ANOMALY_REFUND_FAILED",
               user_role: "system",
               reason: "URGENT ESCALATION: DB rejected receipt AND automated refund failed! Manual intervention required.",
               details: { paymentId, amountPaid, studentId, error: insertErr, refundErr },
             });
           }

           continue; 
        }

        // Update student running balance dynamically to prevent race conditions
        const { data: approvedSubmissions } = await supabaseAdmin
          .from("payment_submissions")
          .select("amount, verified_amount")
          .eq("student_id", studentId)
          .eq("status", "APPROVED");

        const dynamicTotalPaid = (approvedSubmissions || []).reduce(
          (sum: number, s: any) => sum + Number(s.verified_amount || s.amount || 0),
          0
        );

        const amountLeft = Math.max(0, Number(student?.total_fee_due || 0) - dynamicTotalPaid);
        
        const updateData: any = {
          total_fee_paid: dynamicTotalPaid,
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
          action: "RAZORPAY_CRON_RECONCILED",
          user_id: payment.notes?.userId || studentId,
          details: { paymentId, orderId, amountPaid },
        });

        reconciledCount++;
        reconciledIds.push(paymentId);
      }
    }

    return NextResponse.json({ 
      success: true, 
      scanned: successfulPayments.length,
      reconciledCount,
      reconciledIds,
    });
  } catch (err: any) {
    console.error("Razorpay cron reconcile error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
