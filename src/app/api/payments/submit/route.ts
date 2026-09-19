import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSessionFromRequest } from "@/lib/jwt";

/**
 * POST /api/payments/submit
 *
 * Secure payment receipt submission with:
 * - JWT authentication required
 * - Transaction ID global uniqueness check (prevents receipt reuse)
 * - Scanned amount tracking from OCR
 * - Running balance calculation
 * - Auto-status update when fully paid
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

  try {
    const body = await request.json();
    const {
      studentId,
      studentName,
      zoneCode,
      amount,
      installmentNo,
      totalInstallments,
      receiptUrl,
      transactionId,
      autoDetected,
      scannedAmount,
      ocrFullText,
    } = body;

    // ── Input Validation ──────────────────────────────────────────────
    if (!studentId || !receiptUrl || !transactionId || !amount) {
      return NextResponse.json(
        { success: false, error: "Missing required payment fields (studentId, receiptUrl, transactionId, amount)." },
        { status: 400 }
      );
    }

    const cleanTransactionId = String(transactionId).trim();
    if (cleanTransactionId.length < 8 || cleanTransactionId.length > 30) {
      return NextResponse.json(
        { success: false, error: "Transaction ID must be between 8 and 30 characters." },
        { status: 400 }
      );
    }

    const submittedAmount = Number(amount);
    if (isNaN(submittedAmount) || submittedAmount <= 0 || submittedAmount > 500000) {
      return NextResponse.json(
        { success: false, error: "Invalid payment amount. Must be between ₹1 and ₹5,00,000." },
        { status: 400 }
      );
    }

    // ── Ownership Check ───────────────────────────────────────────────
    // Verify the caller owns this student record (unless staff/admin)
    const isStaffOrAdmin = ["admin", "staff", "transport_manager", "supervisor"].includes(session.role);
    if (!isStaffOrAdmin) {
      const { data: studentRecord } = await supabaseAdmin
        .from("students")
        .select("user_id")
        .eq("id", studentId)
        .maybeSingle();

      if (!studentRecord || studentRecord.user_id !== session.userId) {
        return NextResponse.json(
          { success: false, error: "You can only submit payments for your own account." },
          { status: 403 }
        );
      }
    }

    // ── Transaction ID Uniqueness Check (Global) ──────────────────────
    const { data: existingTxn } = await supabaseAdmin
      .from("payment_submissions")
      .select("id, student_id, status, created_at")
      .eq("transaction_id", cleanTransactionId)
      .maybeSingle();

    if (existingTxn) {
      return NextResponse.json(
        {
          success: false,
          error: `Transaction ID "${cleanTransactionId}" has already been submitted. Each receipt can only be used once. If you believe this is an error, contact the transport office.`,
          code: "DUPLICATE_TRANSACTION_ID",
        },
        { status: 409 }
      );
    }

    // ── Generate Receipt Number ───────────────────────────────────────
    const receiptNumber = `RCP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // ── Insert Payment Submission ─────────────────────────────────────
    const { data: submission, error: insertError } = await supabaseAdmin
      .from("payment_submissions")
      .insert({
        student_id: studentId,
        student_name: studentName || "Student Commuter",
        zone_code: zoneCode || "ZONE_B",
        amount: submittedAmount,
        scanned_amount: scannedAmount ? Number(scannedAmount) : null,
        installment_no: Number(installmentNo || 1),
        total_installments: Number(totalInstallments || 1),
        receipt_url: receiptUrl,
        transaction_id: cleanTransactionId,
        auto_detected: Boolean(autoDetected),
        status: "PENDING_APPROVAL",
        receipt_number: receiptNumber,
        ocr_full_text: ocrFullText ? String(ocrFullText).slice(0, 5000) : null,
      })
      .select()
      .single();

    if (insertError) {
      // Handle unique constraint violation gracefully
      if (insertError.code === "23505" && insertError.message?.includes("transaction_id")) {
        return NextResponse.json(
          {
            success: false,
            error: "This transaction ID has already been submitted. Each payment receipt can only be used once.",
            code: "DUPLICATE_TRANSACTION_ID",
          },
          { status: 409 }
        );
      }
      console.error("Payment submission insert error:", insertError);
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    // ── Calculate Running Balance ─────────────────────────────────────
    // Sum all approved + pending submissions for this student
    const { data: allSubmissions } = await supabaseAdmin
      .from("payment_submissions")
      .select("amount, status")
      .eq("student_id", studentId)
      .in("status", ["PENDING_APPROVAL", "APPROVED"]);

    const totalPendingAndApproved = (allSubmissions || []).reduce(
      (sum: number, s: any) => sum + Number(s.amount || 0),
      0
    );

    const totalApprovedOnly = (allSubmissions || []).reduce(
      (sum: number, s: any) => s.status === "APPROVED" ? sum + Number(s.amount || 0) : sum,
      0
    );

    // Get total fee due from student record
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("total_fee_due, total_fee_paid, zone_code")
      .eq("id", studentId)
      .maybeSingle();

    const totalFeeDue = Number(student?.total_fee_due || 0);
    const amountLeft = Math.max(0, totalFeeDue - totalPendingAndApproved);

    // ── Update Student Payment Status ─────────────────────────────────
    const updateData: Record<string, any> = {
      zone_code: zoneCode || student?.zone_code || "ZONE_B",
    };

    if (amountLeft <= 0 && totalFeeDue > 0) {
      // Full amount covered (pending + approved) → auto-submit for verification
      updateData.payment_status = "PENDING_APPROVAL";
    } else if (totalApprovedOnly > 0 && totalApprovedOnly < totalFeeDue) {
      updateData.payment_status = "PARTIALLY_PAID";
    } else {
      updateData.payment_status = "PENDING_APPROVAL";
    }

    await supabaseAdmin
      .from("students")
      .update(updateData)
      .eq("id", studentId);

    // ── Audit Log ─────────────────────────────────────────────────────
    try {
      await supabaseAdmin.from("audit_logs").insert({
        action: "PAYMENT_SUBMITTED",
        user_id: session.userId,
        details: {
          transactionId: cleanTransactionId,
          amount: submittedAmount,
          scannedAmount: scannedAmount || null,
          zoneCode,
          receiptUrl,
          receiptNumber,
          installmentNo,
          amountLeft,
          autoSubmitted: amountLeft <= 0 && totalFeeDue > 0,
        },
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      success: true,
      submission,
      receiptNumber,
      balance: {
        totalFeeDue,
        totalPaid: totalApprovedOnly,
        totalPending: totalPendingAndApproved - totalApprovedOnly,
        totalSubmitted: totalPendingAndApproved,
        amountLeft,
        isFullyPaid: amountLeft <= 0 && totalFeeDue > 0,
      },
      message: amountLeft <= 0 && totalFeeDue > 0
        ? "All installments submitted! Your receipts are queued for staff verification."
        : `Receipt submitted successfully. ₹${amountLeft.toLocaleString()} remaining.`,
    });
  } catch (err: any) {
    console.error("Payment submit API error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
