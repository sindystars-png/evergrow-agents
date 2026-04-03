import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/ai/claude";
import { getSystemPrompt } from "@/lib/ai/system-prompts";
import { getToolsForAgent, executeTool } from "@/lib/ai/tools";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { format } from "date-fns";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, agentRole, conversationId, message, clientId, partnerId } =
      body;

    if (!agentId || !message || !partnerId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      const { data: conv, error } = await supabaseAdmin
        .from("conversations")
        .insert({
          agent_id: agentId,
          partner_id: partnerId,
          client_id: clientId || null,
          title: message.substring(0, 100),
        })
        .select()
        .single();
      if (error) throw error;
      convId = conv.id;
    }

    // Save user message
    await supabaseAdmin.from("messages").insert({
      conversation_id: convId,
      role: "user",
      content: message,
    });

    // Load conversation history
    const { data: history } = await supabaseAdmin
      .from("messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at")
      .limit(50);

    // Get client name if selected
    let clientName: string | undefined;
    if (clientId) {
      const { data: client } = await supabaseAdmin
        .from("clients")
        .select("name")
        .eq("id", clientId)
        .single();
      clientName = client?.name;
    }

    // Get partner name
    const { data: partner } = await supabaseAdmin
      .from("partners")
      .select("full_name")
      .eq("id", partnerId)
      .single();

    // Build system prompt
    const systemPrompt = getSystemPrompt(agentRole, {
      today: format(new Date(), "EEEE, MMMM d, yyyy"),
      clientName,
      partnerName: partner?.full_name,
    });

    // Build messages for Claude
    const claudeMessages = (history ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // Get agent tools
    const tools = getToolsForAgent(agentRole);

    // Call Claude API
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages: claudeMessages,
    });

    // Handle tool use loop
    const toolResults: { name: string; result: string }[] = [];
    const allMessages = [...claudeMessages];

    while (response.stop_reason === "tool_use") {
      const assistantContent = response.content;
      allMessages.push({ role: "assistant", content: JSON.stringify(assistantContent) });

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
              agentId,
              partnerId,
              clientId,
              conversationId: convId,
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

      allMessages.push({ role: "user", content: JSON.stringify(toolResultContents) });

      // Continue the conversation with tool results
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        tools,
        messages: [
          ...claudeMessages,
          { role: "assistant", content: assistantContent },
          { role: "user", content: toolResultContents },
        ],
      });
    }

    // Extract final text response
    const textBlocks = response.content.filter(
      (block) => block.type === "text"
    );
    const finalContent = textBlocks.map((b) => (b.type === "text" ? b.text : "")).join("\n");

    // Save assistant message
    await supabaseAdmin.from("messages").insert({
      conversation_id: convId,
      role: "assistant",
      content: finalContent,
      tool_calls: toolResults.length > 0 ? toolResults : null,
      tokens_used: response.usage?.output_tokens,
    });

    return NextResponse.json({
      content: finalContent,
      conversationId: convId,
      toolUse: toolResults.length > 0 ? toolResults : undefined,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
