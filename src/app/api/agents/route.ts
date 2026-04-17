import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const { data } = await supabaseAdmin
    .from("agents")
    .select("id, name, role, slug, status")
    .eq("status", "active")
    .order("name");

  return NextResponse.json({ agents: data ?? [] });
}
