import { supabaseAdmin } from "@/lib/supabase/admin";
import { ClientsList } from "@/components/clients/clients-list";

export default async function ClientsPage() {
  const { data: clients } = await supabaseAdmin
    .from("clients")
    .select("*")
    .order("name");

  return <ClientsList clients={clients ?? []} />;
}
