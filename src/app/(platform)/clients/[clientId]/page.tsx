import { supabaseAdmin } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { ClientDetail } from "@/components/clients/client-detail";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (!client) notFound();

  const [schedulesRes, tasksRes, docsRes, servicesRes] = await Promise.all([
    supabaseAdmin.from("client_schedules").select("*").eq("client_id", clientId).order("next_due_date"),
    supabaseAdmin.from("tasks").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(20),
    supabaseAdmin.from("document_tracker").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(20),
    supabaseAdmin.from("client_services").select("*").eq("client_id", clientId).order("service_type"),
  ]);

  return (
    <ClientDetail
      client={client}
      schedules={schedulesRes.data ?? []}
      tasks={tasksRes.data ?? []}
      docs={docsRes.data ?? []}
      services={servicesRes.data ?? []}
    />
  );
}
