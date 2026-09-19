import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/jwt";
import Razorpay from "razorpay";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { amount, studentId } = body; // amount in INR (rupees)

    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, error: "Invalid amount." }, { status: 400 });
    }

    // Verify ownership
    const isStaffOrAdmin = ["admin", "staff", "transport_manager", "supervisor"].includes(session.role);
    if (!isStaffOrAdmin) {
      const { data: studentRecord } = await supabaseAdmin
        .from("students")
        .select("user_id")
        .eq("id", studentId)
        .maybeSingle();

      if (!studentRecord || studentRecord.user_id !== session.userId) {
        return NextResponse.json(
          { success: false, error: "You can only generate orders for your own account." },
          { status: 403 }
        );
      }
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { success: false, error: "Razorpay credentials not configured on the server." },
        { status: 500 }
      );
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = {
      amount: Math.round(Number(amount) * 100), // amount in the smallest currency unit (paise)
      currency: "INR",
      receipt: `rcpt_${studentId}_${Date.now()}`.substring(0, 40),
      notes: {
        studentId: studentId,
        userId: session.userId,
      },
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json({ 
      success: true, 
      order,
      key_id: process.env.RAZORPAY_KEY_ID 
    });
  } catch (err: any) {
    console.error("Razorpay create-order error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
