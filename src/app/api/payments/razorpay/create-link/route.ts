import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/jwt";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { amount, studentId } = body;

    const amountInPaise = Math.round(Number(amount) * 100);
    if (!amountInPaise || amountInPaise < 100) {
      return NextResponse.json({ success: false, error: "Invalid amount. Minimum amount is 1 INR." }, { status: 400 });
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

    const keyId = process.env.RAZORPAY_KEY_ID.trim().replace(/['"]/g, "").replace(/\\n/g, "").replace(/\\r/g, "");
    const keySecret = process.env.RAZORPAY_KEY_SECRET.trim().replace(/['"]/g, "").replace(/\\n/g, "").replace(/\\r/g, "");

    const host = request.headers.get("host") || "campusfleet.vercel.app";
    const protocol = host.includes("localhost") ? "http" : "https";
    const callbackUrl = `${protocol}://${host}/portal/payments`;

    const options = {
      amount: amountInPaise,
      currency: "INR",
      accept_partial: false,
      reference_id: `ref_${studentId}_${Date.now()}`.substring(0, 40),
      description: "CampusFleet Transit Pass",
      customer: {
        name: session.fullName || "Student",
        email: session.email || "student@example.com",
      },
      notify: {
        sms: false,
        email: true
      },
      reminder_enable: false,
      notes: {
        studentId: studentId,
        userId: session.userId,
      },
      callback_url: callbackUrl,
      callback_method: "get"
    };

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const rzpRes = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(options),
    });

    const linkData = await rzpRes.json();

    if (!rzpRes.ok) {
      console.error("Razorpay API Error:", linkData);
      let errMsg = linkData.error?.description || linkData.error?.message || "Failed to create payment link";
      if (errMsg.includes("Authentication failed") || rzpRes.status === 401) {
        errMsg = `Razorpay Authentication Failed: Your keys (${keyId.substring(0, 5)}...) are invalid.`;
      }
      return NextResponse.json({ success: false, error: errMsg }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      short_url: linkData.short_url,
      link_id: linkData.id
    });
  } catch (err: any) {
    console.error("Razorpay create-link error:", err);
    return NextResponse.json({ success: false, error: "Internal server error generating link." }, { status: 500 });
  }
}
