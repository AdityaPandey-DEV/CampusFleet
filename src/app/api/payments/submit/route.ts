import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      studentId,
      studentName,
      enrollmentNo,
      zoneCode,
      amount,
      installmentNo,
      totalInstallments,
      receiptUrl,
      transactionId,
      autoDetected,
    } = body;

    if (!studentId || !receiptUrl || !transactionId || !amount) {
      return NextResponse.json(
        { success: false, error: "Missing required payment fields (studentId, receiptUrl, transactionId, amount)." },
        { status: 400 }
      );
    }

    // 1. Insert into public.payment_submissions
    const { data: submission, error: insertError } = await supabaseAdmin
      .from("payment_submissions")
      .insert({
        student_id: studentId,
        student_name: studentName || "Student Commuter",
        enrollment_no: enrollmentNo || "PENDING",
        zone_code: zoneCode || "ZONE_B",
        amount: Number(amount),
        installment_no: Number(installmentNo || 1),
        total_installments: Number(totalInstallments || 1),
        receipt_url: receiptUrl,
        transaction_id: String(transactionId).trim(),
        auto_detected: Boolean(autoDetected),
        status: "PENDING_APPROVAL",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Payment submission insert error:", insertError);
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    // 2. Update Student payment_status and zone_code in database
    await supabaseAdmin
      .from("students")
      .update({
        payment_status: "PENDING_APPROVAL",
        zone_code: zoneCode || "ZONE_B",
      })
      .eq("id", studentId);

    // 3. Log Audit entry
    try {
      await supabaseAdmin.from("audit_logs").insert({
        action: "PAYMENT_SUBMITTED",
        user_id: studentId,
        details: {
          transactionId,
          amount,
          zoneCode,
          receiptUrl,
          installmentNo,
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      submission,
      message: "Payment receipt submitted successfully and queued for staff approval.",
    });
  } catch (err: any) {
    console.error("Payment submit API error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
