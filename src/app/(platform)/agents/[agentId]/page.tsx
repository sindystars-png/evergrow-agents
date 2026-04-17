import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { AgentWorkspace } from "@/components/agents/agent-workspace";
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
  let partnerId = user?.id ?? "";
  let partnerName = "Partner";

  if (user) {
    const { data: partner } = await supabaseAdmin
      .from("partners")
      .select("id, full_name")
      .eq("id", user.id)
      .single();
    if (partner) {
      partnerId = partner.id;
      partnerName = partner.full_name;
    }
  }

  if (!partnerId) {
    const { data: fallbackPartner } = await supabaseAdmin
      .from("partners")
      .select("id, full_name")
      .limit(1)
      .single();
    if (fallbackPartner) {
      partnerId = fallbackPartner.id;
      partnerName = fallbackPartner.full_name;
    }
  }

  // Get clients
  const { data: clients } = await supabaseAdmin
    .from("clients")
    .select("id, name")
    .eq("status", "active")
    .order("name");

  // Load conversations
  const { data: conversations } = await supabaseAdmin
    .from("conversations")
    .select("id, title, created_at, client_id")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Load agent tasks — try with recurrence join, fall back without
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tasks: any[] | null = null;
  const { data: tasksWithRec, error: tasksErr } = await supabaseAdmin
    .from("tasks")
    .select("*, task_recurrences(*), clients(name)")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false });

  if (tasksErr) {
    // task_recurrences table may not exist yet — load tasks without join
    const { data: tasksOnly } = await supabaseAdmin
      .from("tasks")
      .select("*, clients(name)")
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false });
    tasks = tasksOnly;
  } else {
    tasks = tasksWithRec;
  }

  return (
    <AgentWorkspace
      agent={agent as Agent}
      partnerId={partnerId}
      partnerName={partnerName}
      clients={clients ?? []}
      existingConversations={conversations ?? []}
      initialTasks={tasks ?? []}
    />
  );
}
