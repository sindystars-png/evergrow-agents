import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// Check if OneDrive is connected (uses admin client to bypass RLS)
export async function GET() {
  const { data } = await supabaseAdmin
    .from("microsoft_connections")
    .select("microsoft_email, microsoft_name, created_at")
    .limit(1)
    .single();

  if (data) {
    return NextResponse.json({
      connected: true,
      email: data.microsoft_email,
      name: data.microsoft_name,
      connectedAt: data.created_at,
    });
  }

  return NextResponse.json({ connected: false });
}
