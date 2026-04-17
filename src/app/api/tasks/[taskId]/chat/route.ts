/**
 * Task Chat — continue conversation with agent about a specific task.
 *
 * POST /api/tasks/:taskId/chat
 * Body: { message, partnerId }
 *
 * Uses the task's linked conversation to maintain context.
 * The agent sees the full task conversation history so it knows
 * what it already did and can answer follow-up questions.
 */

import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/ai/claude";
import { getSystemPrompt } from "@/lib/ai/system-prompts";
import { getToolsForAgent, executeTool } from "@/lib/ai/tools";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { format } from "date-fns";

// No timeout limit on Render (persistent server)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const body = await request.json();
  const { message, partnerId } = body;

  if (!message || !partnerId) {
    return NextResponse.json(
      { error: "message and partnerId required" },
      { status: 400 }
    );
  }

  try {
    // Load task with agent and client info
    const { data: task, error: taskErr } = await supabaseAdmin
      .from("tasks")
      .select("*, agents(id, name, role, slug), clients(id, name)")
      .eq("id", taskId)
      .single();

    if (taskErr || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const agent = task.agents as {
      id: string;
      name: string;
      role: string;
      slug: string;
    } | null;
    if (!agent) {
      return NextResponse.json(
        { error: "No agent assigned to task" },
        { status: 400 }
      );
    }

    // Get or create conversation for this task
    let conversationId = task.conversation_id;

    if (!conversationId) {
      const { data: conv } = await supabaseAdmin
        .from("conversations")
        .insert({
          agent_id: agent.id,
          partner_id: partnerId,
          client_id: task.client_id || null,
          title: `Task: ${task.title}`,
        })
        .select()
        .single();

      if (conv) {
        conversationId = conv.id;
        await supabaseAdmin
          .from("tasks")
          .update({ conversation_id: conv.id })
          .eq("id", taskId);
      }
    }

    if (!conversationId) {
      return NextResponse.json(
        { error: "Failed to create conversation" },
        { status: 500 }
      );
    }

    // Save user message
    await supabaseAdmin.from("messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: message,
    });

    // Load conversation history
    const { data: history } = await supabaseAdmin
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at")
      .limit(50);

    // Build system prompt with task context
    const clientName = (task.clients as { name: string } | null)?.name;
    const today = format(new Date(), "EEEE, MMMM d, yyyy");

    // Get partner name
    const { data: partner } = await supabaseAdmin
      .from("partners")
      .select("full_name")
      .eq("id", partnerId)
      .single();

    const basePrompt = getSystemPrompt(agent.role, {
      today,
      clientName,
      partnerName: partner?.full_name ?? "Partner",
    });

    // Add task context to system prompt
    const systemPrompt = `${basePrompt}

CURRENT TASK CONTEXT:
You are working on a specific task. The conversation history includes your previous work on this task.
Task: ${task.title}
${task.description ? `Details: ${task.description}` : ""}
Priority: ${task.priority}
${task.due_date ? `Due: ${task.due_date}` : ""}
${clientName ? `Client: ${clientName}` : ""}
Status: ${task.status}

The partner may be following up on your work, asking questions, giving corrections, or providing additional information. Continue working on this task based on their input. Use your tools as needed.`;

    // Build messages for Claude
    const claudeMessages = (history ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // Get agent tools
    const tools = getToolsForAgent(agent.role);

    // Call Claude
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: systemPrompt,
      tools,
      messages: claudeMessages,
    });

    // Tool use loop — accumulate all rounds so agent has full context
    const toolResults: { name: string; result: string }[] = [];
    let rounds = 0;
    const maxRounds = 15;

    while (response.stop_reason === "tool_use" && rounds < maxRounds) {
      rounds++;
      const assistantContent = response.content;

      // Accumulate assistant response + tool results into message history
      claudeMessages.push({ role: "assistant", content: assistantContent });

      const toolUseBlocks = assistantContent.filter(
        (block) => block.type === "tool_use"
      );

      const toolResultContents = [];
      for (const block of toolUseBlocks) {
        if (block.type === "tool_use") {
          const result = await executeTool(
            block.name,
            block.input as Record<string, unknown>,
            {
              agentId: agent.id,
              partnerId,
              clientId: task.client_id,
              conversationId,
            }
          );
          toolResults.push({ name: block.name, result });
          toolResultContents.push({
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      claudeMessages.push({ role: "user", content: toolResultContents });

      response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: systemPrompt,
        tools,
        messages: claudeMessages,
      });
    }

    // Extract final text
    const textBlocks = response.content.filter((b) => b.type === "text");
    const finalContent = textBlocks
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n");

    // Save assistant message
    await supabaseAdmin.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: finalContent,
      tool_calls: toolResults.length > 0 ? toolResults : null,
      tokens_used: response.usage?.output_tokens,
    });

    // If the task was in "review", keep it in review (agent is still working with partner)
    // If it was "completed", reopen to "review" since there's new activity
    if (task.status === "completed") {
      await supabaseAdmin
        .from("tasks")
        .update({ status: "review", updated_at: new Date().toISOString() })
        .eq("id", taskId);
    }

    return NextResponse.json({
      content: finalContent,
      conversationId,
      toolUse: toolResults.length > 0 ? toolResults : undefined,
    });
  } catch (error) {
    console.error("Task chat error:", error);
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal server error", details: errMsg },
      { status: 500 }
    );
  }
}
