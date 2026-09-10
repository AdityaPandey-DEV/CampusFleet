import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = supabaseAdmin
      .from("payment_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }

    const { data: submissions, error } = await query;
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, submissions: submissions || [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { submissionId, action, reviewedBy, rejectionReason } = body;

    if (!submissionId || !action) {
      return NextResponse.json({ success: false, error: "Missing submissionId or action" }, { status: 400 });
    }

    // 1. Fetch submission
    const { data: submission, error: fetchErr } = await supabaseAdmin
      .from("payment_submissions")
      .select("*")
      .eq("id", submissionId)
      .single();

    if (fetchErr || !submission) {
      return NextResponse.json({ success: false, error: "Payment submission not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (action === "APPROVE") {
      // 2. Mark submission APPROVED
      await supabaseAdmin
        .from("payment_submissions")
        .update({
          status: "APPROVED",
          reviewed_by: reviewedBy || "Transport Staff / Finance Desk",
          reviewed_at: now,
        })
        .eq("id", submissionId);

      // 3. Fetch student and update payment & subscription status
      const { data: student } = await supabaseAdmin
        .from("students")
        .select("*")
        .eq("id", submission.student_id)
        .single();

      const newPaid = Number(student?.total_fee_paid || 0) + Number(submission.amount);
      const totalDue = Number(student?.total_fee_due || 12000);

      await supabaseAdmin
        .from("students")
        .update({
          payment_status: "APPROVED",
          has_active_subscription: true,
          subscription_expiry_date: "2026-12-31",
          total_fee_paid: newPaid,
        })
        .eq("id", submission.student_id);

      // 4. Create financial transaction ledger entry
      try {
        await supabaseAdmin.from("payment_transactions").insert({
          receipt_number: `RCP-${Date.now().toString().slice(-6)}`,
          student_id: submission.student_id,
          amount: submission.amount,
          status: "PAID",
          payment_method: "UPI",
          transaction_ref: submission.transaction_id,
        });
      } catch (txnErr) {
        console.warn("Ledger insert notice:", txnErr);
      }

      // 5. Send notification
      try {
        await supabaseAdmin.from("notifications").insert({
          user_id: submission.student_id,
          title: "Payment Approved ✓ Access Unlocked",
          message: `Your transport pass payment of ₹${submission.amount.toLocaleString()} (Txn: ${submission.transaction_id}) has been approved by staff. Full portal access and digital pass are now active!`,
          type: "BILLING",
        });
      } catch {}

      return NextResponse.json({
        success: true,
        message: "Payment approved successfully. Student pass is now active.",
      });
    } else if (action === "REJECT") {
      // Reject submission
      await supabaseAdmin
        .from("payment_submissions")
        .update({
          status: "REJECTED",
          rejection_reason: rejectionReason || "Transaction ID / Screenshot could not be verified by finance staff.",
          reviewed_by: reviewedBy || "Transport Staff / Finance Desk",
          reviewed_at: now,
        })
        .eq("id", submissionId);

      await supabaseAdmin
        .from("students")
        .update({
          payment_status: "REJECTED",
          has_active_subscription: false,
        })
        .eq("id", submission.student_id);

      try {
        await supabaseAdmin.from("notifications").insert({
          user_id: submission.student_id,
          title: "Payment Verification Rejected ❌",
          message: `Payment verification failed: ${rejectionReason || "Invalid transaction details"}. Please re-upload a valid transaction screenshot on Pass & Billing.`,
          type: "ALERT",
        });
      } catch {}

      return NextResponse.json({
        success: true,
        message: "Payment rejected.",
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Payment approvals API error:", err);
    return NextResponse.json({ success: false, error: err?.message || "Internal server error" }, { status: 500 });
  }
}
