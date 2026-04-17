import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const { data } = await supabaseAdmin
    .from("client_services")
    .select("*")
    .eq("client_id", clientId)
    .order("service_type");

  return NextResponse.json({ services: data ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const body = await request.json();

  const { data, error } = await supabaseAdmin
    .from("client_services")
    .upsert(
      {
        client_id: clientId,
        service_type: body.service_type,
        frequency: body.frequency || null,
        notes: body.notes || null,
        active: body.active ?? true,
      },
      { onConflict: "client_id,service_type" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const { searchParams } = new URL(request.url);
  const serviceType = searchParams.get("service_type");

  if (!serviceType) {
    return NextResponse.json({ error: "service_type required" }, { status: 400 });
  }

  await supabaseAdmin
    .from("client_services")
    .delete()
    .eq("client_id", clientId)
    .eq("service_type", serviceType);

  return NextResponse.json({ ok: true });
}
