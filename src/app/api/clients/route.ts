import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Bulk import
  if (Array.isArray(body.clients)) {
    const rows = body.clients.map((c: Record<string, string>) => ({
      name: c.name,
      entity_type: c.entity_type || null,
      email: c.email || null,
      phone: c.phone || null,
      ein: c.ein || null,
      contact_name: c.contact_name || null,
      contact_phone: c.contact_phone || null,
      contact_email: c.contact_email || null,
    }));

    const { data, error } = await supabaseAdmin
      .from("clients")
      .insert(rows)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ imported: data?.length ?? 0, clients: data });
  }

  // Single create
  const { data, error } = await supabaseAdmin
    .from("clients")
    .insert({
      name: body.name,
      entity_type: body.entity_type,
      email: body.email,
      phone: body.phone,
      ein: body.ein,
      contact_name: body.contact_name || null,
      contact_phone: body.contact_phone || null,
      contact_email: body.contact_email || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
