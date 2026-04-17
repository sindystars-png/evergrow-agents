import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, full_name, role } = body;

  if (!email || !full_name) {
    return NextResponse.json(
      { error: "Email and full name are required" },
      { status: 400 }
    );
  }

  try {
    // Create the user in Supabase Auth and send them an invite email
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { full_name, role: role ?? "partner" },
        redirectTo: "https://agents.evergrowfin.com/login",
      });

    if (authError) {
      // Check if user already exists
      if (authError.message?.includes("already been registered")) {
        return NextResponse.json(
          { error: "This email is already registered" },
          { status: 400 }
        );
      }
      console.error("Auth invite error:", authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 500 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }

    // Create the partner record
    const { error: partnerError } = await supabaseAdmin
      .from("partners")
      .insert({
        id: authData.user.id,
        full_name,
        role: role ?? "partner",
      });

    if (partnerError) {
      console.error("Partner insert error:", partnerError);
      // Non-fatal — the partner record can be created later
    }

    return NextResponse.json({
      ok: true,
      message: `Invitation sent to ${email}. They will receive an email to set up their account.`,
    });
  } catch (err) {
    console.error("Invite error:", err);
    return NextResponse.json(
      { error: "Failed to send invitation" },
      { status: 500 }
    );
  }
}
