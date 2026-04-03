import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { ChatPanel } from "@/components/chat/chat-panel";
import type { Agent } from "@/types/database";

export default async function AgentChatPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;

  // Try by slug first, then by id
  let agentQuery = await supabaseAdmin
    .from("agents")
    .select("*")
    .eq("slug", agentId)
    .single();

  if (!agentQuery.data) {
    agentQuery = await supabaseAdmin
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .single();
  }

  const agent = agentQuery.data;
  if (!agent) notFound();

  // Get current user for auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get partner info
  const partnerId = user?.id ?? "anonymous";
  let partnerName = "Partner";
  if (user) {
    const { data: partner } = await supabaseAdmin
      .from("partners")
      .select("full_name")
      .eq("id", user.id)
      .single();
    if (partner) partnerName = partner.full_name;
  }

  // Get clients
  const { data: clients } = await supabaseAdmin
    .from("clients")
    .select("id, name")
    .eq("status", "active")
    .order("name");

  return (
    <div className="h-[calc(100vh-6rem)] lg:h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-xl font-bold">{agent.name}</h1>
        <span className="text-sm text-muted-foreground">
          {agent.description}
        </span>
      </div>
      <ChatPanel
        agent={agent as Agent}
        partnerId={partnerId}
        partnerName={partnerName}
        clients={clients ?? []}
        existingConversations={[]}
      />
    </div>
  );
}
