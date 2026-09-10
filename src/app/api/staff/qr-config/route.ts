import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("system_configs")
      .select("value, updated_at, updated_by")
      .eq("key", "payment_qr_config")
      .single();

    if (error || !data) {
      // Fallback default
      return NextResponse.json({
        success: true,
        config: {
          upi_id: "gehubhimtal.transit@upi",
          merchant_name: "GEHU Bhimtal Transport Department",
          qr_image_url: "",
          instructions: "Scan via Google Pay, PhonePe, Paytm, or any BHIM UPI app. Ensure the 12-digit transaction ID / UTR is clear on the receipt.",
          account_number: "50200012345678",
          ifsc_code: "HDFC0001234",
          bank_name: "HDFC Bank, Haldwani Branch",
        },
      });
    }

    return NextResponse.json({
      success: true,
      config: data.value,
      updatedAt: data.updated_at,
      updatedBy: data.updated_by,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      upi_id,
      merchant_name,
      qr_image_url,
      instructions,
      account_number,
      ifsc_code,
      bank_name,
      updated_by = "Transport Operations Staff",
    } = body;

    if (!upi_id) {
      return NextResponse.json({ success: false, error: "UPI ID is required" }, { status: 400 });
    }

    const newConfig = {
      upi_id: upi_id.trim(),
      merchant_name: merchant_name || "GEHU Bhimtal Transport",
      qr_image_url: qr_image_url || "",
      instructions: instructions || "Scan via any UPI app and enter the 12-digit UTR on the receipt.",
      account_number: account_number || "",
      ifsc_code: ifsc_code || "",
      bank_name: bank_name || "",
    };

    const { error } = await supabaseAdmin
      .from("system_configs")
      .upsert({
        key: "payment_qr_config",
        value: newConfig,
        updated_at: new Date().toISOString(),
        updated_by,
      });

    if (error) throw error;

    // Log institutional audit
    await supabaseAdmin.from("audit_logs").insert({
      user_role: "staff",
      action: "UPDATE_PAYMENT_QR_CONFIG",
      entity: "SystemConfig",
      entity_id: "payment_qr_config",
      reason: `Staff updated payment QR / UPI VPA to ${newConfig.upi_id}`,
      new_value: newConfig,
    });

    return NextResponse.json({
      success: true,
      message: "Payment QR and UPI details updated successfully in database!",
      config: newConfig,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
