import { getAuthUrl } from "@/lib/microsoft/graph-client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// Redirect-based OAuth: redirects user to Microsoft sign-in
export async function GET(request: NextRequest) {
  let userId = request.nextUrl.searchParams.get("userId");

  // If no userId provided, get the first partner as fallback
  if (!userId) {
    const { data: partner } = await supabaseAdmin
      .from("partners")
      .select("id")
      .limit(1)
      .single();
    if (partner) userId = partner.id;
  }

  if (!userId) {
    return NextResponse.json({ error: "No partners found" }, { status: 400 });
  }

  const authUrl = getAuthUrl(userId);
  return NextResponse.redirect(authUrl);
}
