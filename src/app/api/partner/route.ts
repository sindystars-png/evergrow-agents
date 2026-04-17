import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return NextResponse.json({ partnerId: user.id });
  }

  // Fallback to first partner
  const { data } = await supabaseAdmin
    .from("partners")
    .select("id")
    .limit(1)
    .single();

  return NextResponse.json({ partnerId: data?.id ?? "" });
}
