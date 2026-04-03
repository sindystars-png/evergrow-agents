"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, User, Bot, Wrench } from "lucide-react";
import type { Agent } from "@/types/database";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolUse?: { name: string; result: string }[];
};

export function ChatPanel({
  agent,
  partnerId,
  partnerName,
  clients,
  existingConversations,
}: {
  agent: Agent;
  partnerId: string;
  partnerName?: string;
  clients: { id: string; name: string }[];
  existingConversations?: { id: string; title: string | null; created_at: string }[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
          agentRole: agent.role,
          conversationId,
          message: trimmed,
          clientId: selectedClient || undefined,
          partnerId,
          partnerName: partnerName ?? "Partner",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.content,
        toolUse: data.toolUse,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "Sorry, I encountered an error. Please try again or check that the system is properly configured.",
        },
      ]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col flex-1 border rounded-lg overflow-hidden bg-background">
      {/* Client selector */}
      <div className="border-b px-4 py-3 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Client:</span>
        <select
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
          className="flex h-9 w-64 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
        >
          <option value="">Select a client (optional)</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="text-4xl mb-3">
              {agent.slug === "payroll-manager"
                ? "💰"
                : agent.slug === "bookkeeper"
                  ? "📚"
                  : agent.slug === "sales-tax-specialist"
                    ? "🧾"
                    : "📁"}
            </div>
            <h3 className="text-lg font-semibold mb-1">{agent.name}</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {agent.description}
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg">
              {getQuickPrompts(agent.role).map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setInput(prompt)}
                  className="text-left text-sm px-3 py-2 rounded-lg border hover:bg-muted transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="flex gap-3">
              <div
                className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {msg.role === "user" ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                {msg.toolUse?.map((tool, i) => (
                  <Card key={i} className="p-3 bg-muted/50">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Wrench className="h-3 w-3" />
                      {formatToolName(tool.name)}
                    </div>
                    <div className="text-xs whitespace-pre-wrap">
                      {tool.result}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-muted">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {agent.name} is thinking...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${agent.name.split(" ")[0]} something...`}
            className="resize-none min-h-[44px] max-h-32"
            rows={1}
            disabled={loading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            size="icon"
            className="shrink-0 h-11 w-11"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatToolName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getQuickPrompts(role: string): string[] {
  const prompts: Record<string, string[]> = {
    payroll_manager: [
      "What payrolls are due this week?",
      "Show me the payroll schedule for all clients",
      "Which clients are behind on payroll?",
      "Create a new client payroll schedule",
    ],
    bookkeeper: [
      "Check banking connections for all clients",
      "Which clients are behind on bookkeeping?",
      "Give me a status update on all clients",
      "Review the bookkeeping checklist",
    ],
    sales_tax: [
      "What sales tax filings are due soon?",
      "Calculate sales tax for Missouri",
      "Check nexus status for a client",
      "Generate a filing schedule overview",
    ],
    document_manager: [
      "Generate a document request list",
      "What documents are missing?",
      "Check OneDrive folder organization",
      "Review year-end file completion",
    ],
  };
  return prompts[role] ?? ["How can you help me today?"];
}
