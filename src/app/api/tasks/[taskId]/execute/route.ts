/**
 * Manual Task Execution — "Run Now" button
 *
 * POST /api/tasks/:taskId/execute
 *
 * Uses streaming to keep the connection alive while the agent works.
 * Sends progress updates as the task executes, and the final result at the end.
 */

import { NextRequest } from "next/server";
import { anthropic } from "@/lib/ai/claude";
import { getSystemPrompt } from "@/lib/ai/system-prompts";
import { getToolsForAgent, executeTool } from "@/lib/ai/tools";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { format } from "date-fns";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

// No timeout limit on Render (persistent server)

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  // Load task with agent info
  const { data: task, error: taskErr } = await supabaseAdmin
    .from("tasks")
    .select("*, agents(id, name, role, slug), clients(id, name)")
    .eq("id", taskId)
    .single();

  if (taskErr || !task) {
    return new Response(JSON.stringify({ error: "Task not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const agent = task.agents as { id: string; name: string; role: string; slug: string } | null;
  if (!agent) {
    return new Response(JSON.stringify({ error: "No agent assigned" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Stream progress back to client
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        // Create execution record
        const { data: execution } = await supabaseAdmin
          .from("task_executions")
          .insert({
            task_id: taskId,
            agent_id: agent.id,
            status: "running",
            trigger_type: "manual",
          })
          .select()
          .single();

        // Update task status
        await supabaseAdmin
          .from("tasks")
          .update({ status: "in_progress", updated_at: new Date().toISOString() })
          .eq("id", taskId);

        send({ type: "status", message: "Starting task execution..." });

        // Create conversation
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
        if (conversationId) {
          await supabaseAdmin
            .from("tasks")
            .update({ conversation_id: conversationId })
            .eq("id", taskId);
        }

        // Build context
        const clientName = (task.clients as { name: string } | null)?.name;
        const today = format(new Date(), "EEEE, MMMM d, yyyy");
        const systemPrompt = getSystemPrompt(agent.role, {
          today,
          clientName,
          partnerName: "System (Automated Task)",
        });

        // Build task message
        const lines = [
          `AUTOMATED TASK EXECUTION`,
          ``,
          `You have been assigned the following task. Please execute it now using your available tools.`,
          ``,
          `Task: ${task.title}`,
        ];
        if (task.description) lines.push(`Details: ${task.description}`);
        lines.push(`Priority: ${task.priority}`);
        if (task.due_date) lines.push(`Due Date: ${task.due_date}`);
        if (clientName) lines.push(`Client: ${clientName}`);
        lines.push(``, `Please complete this task using your tools. When finished, provide a clear summary.`);
        const taskMessage = lines.join("\n");

        // Save user message
        if (conversationId) {
          await supabaseAdmin.from("messages").insert({
            conversation_id: conversationId,
            role: "user",
            content: taskMessage,
          });
        }

        // Get tools and call Claude
        const tools = getToolsForAgent(agent.role);
        send({ type: "status", message: `${agent.name} is analyzing the task...` });

        // Accumulate messages across all tool rounds so the agent remembers prior steps
        const claudeMessages: MessageParam[] = [
          { role: "user", content: taskMessage },
        ];

        let response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8192,
          system: systemPrompt,
          tools,
          messages: claudeMessages,
        });

        // Tool use loop — accumulate all rounds
        const toolResults: { name: string; result: string }[] = [];
        let totalTokens = response.usage?.output_tokens ?? 0;
        let round = 0;
        const maxRounds = 25;

        while (response.stop_reason === "tool_use" && round < maxRounds) {
          round++;
          const assistantContent = response.content;

          // Add assistant response to message history
          claudeMessages.push({ role: "assistant", content: assistantContent });

          const toolUseBlocks = assistantContent.filter((b) => b.type === "tool_use");

          const toolResultContents = [];
          for (const block of toolUseBlocks) {
            if (block.type === "tool_use") {
              const toolDisplayName = block.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
              send({ type: "tool", message: `Using tool: ${toolDisplayName}...` });

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

          send({ type: "status", message: `${agent.name} is thinking... (step ${round})` });

          // Continue with FULL accumulated history
          response = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 8192,
            system: systemPrompt,
            tools,
            messages: claudeMessages,
          });

          totalTokens += response.usage?.output_tokens ?? 0;
        }

        // Extract final text
        const textBlocks = response.content.filter((b) => b.type === "text");
        const finalContent = textBlocks.map((b) => (b.type === "text" ? b.text : "")).join("\n");

        // Save to conversation
        if (conversationId) {
          await supabaseAdmin.from("messages").insert({
            conversation_id: conversationId,
            role: "assistant",
            content: finalContent,
            tool_calls: toolResults.length > 0 ? toolResults : null,
            tokens_used: totalTokens,
          });
        }

        // Update execution record
        if (execution) {
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
        }

        // Update task status to review
        await supabaseAdmin
          .from("tasks")
          .update({ status: "review", updated_at: new Date().toISOString() })
          .eq("id", taskId);

        // Log to audit trail
        await supabaseAdmin.from("audit_log").insert({
          agent_id: agent.id,
          client_id: task.client_id,
          action: "task_executed",
          description: `${agent.name} executed task "${task.title}" (manual trigger). Used ${toolResults.length} tool(s).`,
          metadata: {
            task_id: taskId,
            execution_id: execution?.id,
            conversation_id: conversationId,
            tools_used: toolResults.map((t) => t.name),
          },
        });

        // Send final result
        send({
          type: "complete",
          result: finalContent,
          conversationId,
          toolsUsed: toolResults.map((t) => t.name),
          tokensUsed: totalTokens,
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        console.error("Task execution error:", errMsg);

        // Reset task
        await supabaseAdmin
          .from("tasks")
          .update({ status: "open", updated_at: new Date().toISOString() })
          .eq("id", taskId);

        send({ type: "error", message: errMsg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
