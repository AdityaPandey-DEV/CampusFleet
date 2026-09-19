import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSessionFromRequest } from "@/lib/jwt";

/**
 * GET /api/payments/approvals
 * Fetch payment submissions for staff review.
 * Requires staff/admin authentication.
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  const isStaffOrAdmin =
    session &&
    ["admin", "staff", "transport_manager", "supervisor"].includes(session.role);

  // Allow students to query their own submissions (filtered below)
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const studentIdFilter = searchParams.get("studentId");

    let query = supabaseAdmin
      .from("payment_submissions")
      .select("*, student:students(*)")
      .order("created_at", { ascending: false });

    // Non-staff can only see their own submissions
    if (!isStaffOrAdmin && studentIdFilter) {
      query = query.eq("student_id", studentIdFilter);
    } else if (!isStaffOrAdmin) {
      // Deny broad listing for non-staff
      return NextResponse.json(
        { success: false, error: "Insufficient permissions." },
        { status: 403 }
      );
    }

    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }

    const { data: submissions, error } = await query;
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, submissions: submissions || [] });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/payments/approvals
 * Approve or reject a payment submission.
 * Requires staff/admin authentication.
 *
 * On APPROVE:
 * - Updates student's total_fee_paid by receipt amount
 * - If fully paid (SUM approved >= total_fee_due), activates subscription
 * - If partially paid, sets PARTIALLY_PAID status
 *
 * On REJECT:
 * - Marks submission rejected with reason
 * - Recalculates student payment status
 */
export async function POST(request: NextRequest) {
  // ── Auth Guard — Staff/Admin Only ───────────────────────────────────
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 }
    );
  }

  const allowedRoles = ["admin", "staff", "transport_manager", "supervisor"];
  if (!allowedRoles.includes(session.role)) {
    return NextResponse.json(
      { success: false, error: "Only staff and administrators can approve payments." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { submissionId, action, reviewedBy, rejectionReason, verifiedAmount } = body;

    if (!submissionId || !action) {
      return NextResponse.json(
        { success: false, error: "Missing submissionId or action" },
        { status: 400 }
      );
    }

    if (!["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action. Must be APPROVE or REJECT." },
        { status: 400 }
      );
    }

    // ── Fetch Submission ────────────────────────────────────────────────
    const { data: submission, error: fetchErr } = await supabaseAdmin
      .from("payment_submissions")
      .select("*")
      .eq("id", submissionId)
      .single();

    if (fetchErr || !submission) {
      return NextResponse.json(
        { success: false, error: "Payment submission not found." },
        { status: 404 }
      );
    }

    // Prevent double-processing
    if (submission.status !== "PENDING_APPROVAL") {
      return NextResponse.json(
        { success: false, error: `This submission has already been ${submission.status.toLowerCase()}.` },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const reviewerName = reviewedBy || session.email || "Transport Staff";

    if (action === "APPROVE") {
      // Use verified amount if staff corrected it, otherwise use submitted amount
      const approvedAmount = verifiedAmount ? Number(verifiedAmount) : Number(submission.amount);

      // ── Mark Submission APPROVED ──────────────────────────────────────
      await supabaseAdmin
        .from("payment_submissions")
        .update({
          status: "APPROVED",
          verified_amount: approvedAmount,
          reviewed_by: reviewerName,
          reviewed_at: now,
        })
        .eq("id", submissionId);

      // ── Calculate Total Approved Payments for Student ──────────────────
      const { data: approvedSubmissions } = await supabaseAdmin
        .from("payment_submissions")
        .select("amount, verified_amount")
        .eq("student_id", submission.student_id)
        .eq("status", "APPROVED");

      const totalApproved = (approvedSubmissions || []).reduce(
        (sum: number, s: any) => sum + Number(s.verified_amount || s.amount || 0),
        0
      );

      // ── Fetch Student Record ──────────────────────────────────────────
      const { data: student } = await supabaseAdmin
        .from("students")
        .select("total_fee_due, total_fee_paid")
        .eq("id", submission.student_id)
        .maybeSingle();

      const totalFeeDue = Number(student?.total_fee_due || 0);
      const isFullyPaid = totalFeeDue > 0 && totalApproved >= totalFeeDue;

      // ── Update Student Record ─────────────────────────────────────────
      const studentUpdate: Record<string, any> = {
        total_fee_paid: totalApproved,
      };

      if (isFullyPaid) {
        // Full payment achieved → activate subscription
        studentUpdate.payment_status = "APPROVED";
        studentUpdate.has_active_subscription = true;
        // Set expiry to end of academic term (June 30 of next year or Dec 31)
        const now_date = new Date();
        const expiryYear = now_date.getMonth() >= 6 ? now_date.getFullYear() + 1 : now_date.getFullYear();
        const expiryMonth = now_date.getMonth() >= 6 ? "06-30" : "12-31";
        studentUpdate.subscription_expiry_date = `${expiryYear}-${expiryMonth}`;
      } else if (totalApproved > 0) {
        // Partial payment
        studentUpdate.payment_status = "PARTIALLY_PAID";
        studentUpdate.has_active_subscription = false;
      }

      await supabaseAdmin
        .from("students")
        .update(studentUpdate)
        .eq("id", submission.student_id);

      // ── Create Financial Ledger Entry ─────────────────────────────────
      try {
        await supabaseAdmin.from("payment_transactions").insert({
          receipt_number: submission.receipt_number || `RCP-${Date.now().toString().slice(-6)}`,
          student_id: submission.student_id,
          amount: approvedAmount,
          status: "PAID",
          payment_method: "UPI",
          transaction_ref: submission.transaction_id,
        });
      } catch (txnErr) {
        console.warn("Ledger insert notice:", txnErr);
      }

      // ── Send Notification ─────────────────────────────────────────────
      try {
        const amountLeft = Math.max(0, totalFeeDue - totalApproved);
        const notificationMessage = isFullyPaid
          ? `Your transport fee is fully paid (₹${totalApproved.toLocaleString()}). Digital pass and full portal access are now active!`
          : `Payment of ₹${approvedAmount.toLocaleString()} (Txn: ${submission.transaction_id}) approved. ₹${amountLeft.toLocaleString()} remaining.`;

        await supabaseAdmin.from("notifications").insert({
          user_id: submission.student_id,
          title: isFullyPaid
            ? "Payment Complete ✓ Pass Activated!"
            : "Payment Installment Approved ✓",
          message: notificationMessage,
          type: "BILLING",
        });
      } catch {
        // Non-fatal
      }

      // ── Audit Log ─────────────────────────────────────────────────────
      try {
        await supabaseAdmin.from("audit_logs").insert({
          action: "PAYMENT_APPROVED",
          user_id: session.userId,
          details: {
            submissionId,
            studentId: submission.student_id,
            approvedAmount,
            totalApproved,
            totalFeeDue,
            isFullyPaid,
            reviewedBy: reviewerName,
          },
        });
      } catch {
        // Non-fatal
      }

      return NextResponse.json({
        success: true,
        message: isFullyPaid
          ? "Payment approved! Student pass is now fully active."
          : `Installment approved. Student has paid ₹${totalApproved.toLocaleString()} of ₹${totalFeeDue.toLocaleString()}.`,
        isFullyPaid,
        totalApproved,
        totalFeeDue,
        amountLeft: Math.max(0, totalFeeDue - totalApproved),
      });
    } else if (action === "REJECT") {
      // ── Mark Submission REJECTED ──────────────────────────────────────
      await supabaseAdmin
        .from("payment_submissions")
        .update({
          status: "REJECTED",
          rejection_reason: rejectionReason || "Transaction ID / Screenshot could not be verified by finance staff.",
          reviewed_by: reviewerName,
          reviewed_at: now,
        })
        .eq("id", submissionId);

      // ── Recalculate Student Status ────────────────────────────────────
      // Check if student has any other approved or pending submissions
      const { data: remainingSubmissions } = await supabaseAdmin
        .from("payment_submissions")
        .select("amount, status")
        .eq("student_id", submission.student_id)
        .in("status", ["APPROVED", "PENDING_APPROVAL"]);

      const hasApproved = (remainingSubmissions || []).some((s: any) => s.status === "APPROVED");
      const hasPending = (remainingSubmissions || []).some((s: any) => s.status === "PENDING_APPROVAL");

      let newStatus = "UNPAID";
      if (hasApproved) newStatus = "PARTIALLY_PAID";
      else if (hasPending) newStatus = "PENDING_APPROVAL";

      await supabaseAdmin
        .from("students")
        .update({
          payment_status: newStatus,
          ...(newStatus === "UNPAID" ? { has_active_subscription: false } : {}),
        })
        .eq("id", submission.student_id);

      // ── Send Rejection Notification ───────────────────────────────────
      try {
        await supabaseAdmin.from("notifications").insert({
          user_id: submission.student_id,
          title: "Payment Verification Rejected ❌",
          message: `Payment of ₹${submission.amount.toLocaleString()} rejected: ${rejectionReason || "Invalid transaction details"}. Please re-upload a valid receipt.`,
          type: "ALERT",
        });
      } catch {
        // Non-fatal
      }

      // ── Audit Log ─────────────────────────────────────────────────────
      try {
        await supabaseAdmin.from("audit_logs").insert({
          action: "PAYMENT_REJECTED",
          user_id: session.userId,
          details: {
            submissionId,
            studentId: submission.student_id,
            rejectedAmount: submission.amount,
            rejectionReason,
            reviewedBy: reviewerName,
          },
        });
      } catch {
        // Non-fatal
      }

      return NextResponse.json({
        success: true,
        message: "Payment rejected.",
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("Payment approvals API error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
