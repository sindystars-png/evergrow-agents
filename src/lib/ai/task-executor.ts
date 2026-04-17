/**
 * Task Execution Engine
 *
 * When an agent has a task due (or a user clicks "Run Now"), this module:
 * 1. Creates a task_executions record (status = running)
 * 2. Sends the task to Claude with the agent's system prompt + tools
 * 3. Runs the tool-use loop (same pattern as /api/chat)
 * 4. Saves the result back to task_executions
 * 5. Updates the task status to in_progress / completed
 */

import { anthropic } from "@/lib/ai/claude";
import { getSystemPrompt } from "@/lib/ai/system-prompts";
import { getToolsForAgent, executeTool } from "@/lib/ai/tools";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { format } from "date-fns";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

type ExecutionResult = {
  executionId: string;
  conversationId: string;
  status: "completed" | "failed";
  result: string;
  toolCalls: { name: string; result: string }[];
  tokensUsed: number;
};

export async function executeTask(
  taskId: string,
  triggerType: "cron" | "manual" = "manual"
): Promise<ExecutionResult> {
  // 1. Load the task with agent info
  const { data: task, error: taskErr } = await supabaseAdmin
    .from("tasks")
    .select("*, agents(id, name, role, slug), clients(id, name)")
    .eq("id", taskId)
    .single();

  if (taskErr || !task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const agent = task.agents as { id: string; name: string; role: string; slug: string } | null;
  if (!agent) {
    throw new Error(`No agent assigned to task: ${taskId}`);
  }

  // 2. Create execution record
  const { data: execution, error: execErr } = await supabaseAdmin
    .from("task_executions")
    .insert({
      task_id: taskId,
      agent_id: agent.id,
      status: "running",
      trigger_type: triggerType,
    })
    .select()
    .single();

  if (execErr || !execution) {
    throw new Error(`Failed to create execution record: ${execErr?.message}`);
  }

  try {
    // 3. Update task status to in_progress
    await supabaseAdmin
      .from("tasks")
      .update({ status: "in_progress", updated_at: new Date().toISOString() })
      .eq("id", taskId);

    // 4. Create a conversation thread for this task (so user can follow up)
    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .insert({
        agent_id: agent.id,
        partner_id: task.assigned_by,
        client_id: task.client_id || null,
        title: `Task: ${task.title}`,
      })
      .select()
      .single();

    const conversationId = conv?.id;

    // Link task to conversation
    if (conversationId) {
      await supabaseAdmin
        .from("tasks")
        .update({ conversation_id: conversationId })
        .eq("id", taskId);
    }

    // 5. Build context for the agent
    const clientName = (task.clients as { name: string } | null)?.name;
    const today = format(new Date(), "EEEE, MMMM d, yyyy");

    const systemPrompt = getSystemPrompt(agent.role, {
      today,
      clientName,
      partnerName: "System (Automated Task)",
    });

    // 6. Build the task instruction message
    const taskMessage = buildTaskMessage(task);

    // Save the task instruction as a "user" message in the conversation
    if (conversationId) {
      await supabaseAdmin.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: taskMessage,
      });
    }

    // Accumulate messages across all tool rounds so the agent remembers prior steps
    const claudeMessages: MessageParam[] = [
      { role: "user", content: taskMessage },
    ];

    // 6. Get agent tools
    const tools = getToolsForAgent(agent.role);

    // 7. Call Claude
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: systemPrompt,
      tools,
      messages: claudeMessages,
    });

    // 8. Tool use loop — accumulate all rounds so agent has full context
    const toolResults: { name: string; result: string }[] = [];
    let totalTokens = response.usage?.output_tokens ?? 0;
    let rounds = 0;
    const maxRounds = 20; // safety limit

    while (response.stop_reason === "tool_use" && rounds < maxRounds) {
      rounds++;
      const assistantContent = response.content;

      // Add the assistant's response (with tool_use blocks) to message history
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
              partnerId: task.assigned_by,
              clientId: task.client_id,
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

      // Add tool results to message history
      claudeMessages.push({ role: "user", content: toolResultContents });

      // Continue conversation with FULL accumulated history
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: systemPrompt,
        tools,
        messages: claudeMessages,
      });

      totalTokens += response.usage?.output_tokens ?? 0;
    }

    // 9. Extract final text
    const textBlocks = response.content.filter((b) => b.type === "text");
    const finalContent = textBlocks
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n");

    // Save agent's response as assistant message in the conversation
    if (conversationId) {
      await supabaseAdmin.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: finalContent,
        tool_calls: toolResults.length > 0 ? toolResults : null,
        tokens_used: totalTokens,
      });
    }

    // Update execution record as completed
    await supabaseAdmin
      .from("task_executions")
      .update({
        status: "completed",
        result: finalContent,
        tool_calls: toolResults.length > 0 ? toolResults : null,
        tokens_used: totalTokens,
        completed_at: new Date().toISOString(),
      })
      .eq("id", execution.id);

    // Update task status — set to "review" instead of "completed"
    // so the user can review and continue chatting if needed
    await supabaseAdmin
      .from("tasks")
      .update({
        status: "review",
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    // Log to audit trail
    await supabaseAdmin.from("audit_log").insert({
      agent_id: agent.id,
      client_id: task.client_id,
      action: "task_executed",
      description: `${agent.name} executed task "${task.title}" (${triggerType} trigger). Used ${toolResults.length} tool(s).`,
      metadata: {
        task_id: taskId,
        execution_id: execution.id,
        conversation_id: conversationId,
        trigger_type: triggerType,
        tools_used: toolResults.map((t) => t.name),
      },
    });

    return {
      executionId: execution.id,
      conversationId: conversationId ?? "",
      status: "completed",
      result: finalContent,
      toolCalls: toolResults,
      tokensUsed: totalTokens,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";

    // Mark execution as failed
    await supabaseAdmin
      .from("task_executions")
      .update({
        status: "failed",
        result: `Error: ${errMsg}`,
        completed_at: new Date().toISOString(),
      })
      .eq("id", execution.id);

    // Revert task to open
    await supabaseAdmin
      .from("tasks")
      .update({ status: "open", updated_at: new Date().toISOString() })
      .eq("id", taskId);

    return {
      executionId: execution.id,
      conversationId: "",
      status: "failed",
      result: `Error: ${errMsg}`,
      toolCalls: [],
      tokensUsed: 0,
    };
  }
}

/**
 * Build a clear instruction message for the agent based on the task
 */
function buildTaskMessage(task: {
  title: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  client_id: string | null;
  clients?: { name: string } | null;
}): string {
  const lines = [
    `📋 **AUTOMATED TASK EXECUTION**`,
    ``,
    `You have been assigned the following task. Please execute it now using your available tools.`,
    ``,
    `**Task:** ${task.title}`,
  ];

  if (task.description) {
    lines.push(`**Details:** ${task.description}`);
  }

  lines.push(`**Priority:** ${task.priority}`);

  if (task.due_date) {
    lines.push(`**Due Date:** ${task.due_date}`);
  }

  const clientName = (task.clients as { name: string } | null)?.name;
  if (clientName) {
    lines.push(`**Client:** ${clientName}`);
  }

  lines.push(
    ``,
    `Please complete this task using your tools. When finished, provide a clear summary of what you did, any findings, and any follow-up actions needed.`
  );

  return lines.join("\n");
}
