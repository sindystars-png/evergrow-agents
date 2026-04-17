"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Loader2,
  User,
  Bot,
  Wrench,
  MessageSquare,
  Plus,
  ChevronLeft,
} from "lucide-react";
import type { Agent } from "@/types/database";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolUse?: { name: string; result: string }[];
};

type Conversation = {
  id: string;
  title: string | null;
  created_at: string;
  client_id?: string | null;
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
  existingConversations?: Conversation[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>(
    existingConversations ?? []
  );
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadConversation = useCallback(async (convId: string) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/conversations/${convId}`);
      const data = await res.json();
      if (data.messages) {
        const loaded: ChatMessage[] = data.messages
          .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
          .map((m: { id: string; role: string; content: string; tool_calls: { name: string; result: string }[] | null }) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            toolUse: m.tool_calls ?? undefined,
          }));
        setMessages(loaded);
        setConversationId(convId);
        setShowHistory(false);
      }
    } catch {
      // Failed to load — stay on current view
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  function startNewConversation() {
    setMessages([]);
    setConversationId(null);
    setShowHistory(false);
  }

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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || "Failed to get response");
      }

      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
        // Add to conversation list
        setConversations((prev) => [
          {
            id: data.conversationId,
            title: trimmed.substring(0, 100),
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.content,
        toolUse: data.toolUse,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Sorry, I encountered an error: ${errMsg}`,
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

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);
    if (diffHrs < 1) return "Just now";
    if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  }

  return (
    <div className="flex flex-1 border rounded-lg overflow-hidden bg-background">
      {/* Conversation history sidebar */}
      {showHistory && (
        <div className="w-72 border-r flex flex-col bg-muted/30">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="text-sm font-medium">Conversations</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowHistory(false)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={startNewConversation}
            >
              <Plus className="h-3 w-3" />
              New conversation
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {loadingHistory && (
                <div className="text-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                </div>
              )}
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors ${
                    conversationId === conv.id
                      ? "bg-muted font-medium"
                      : ""
                  }`}
                >
                  <div className="truncate">
                    {conv.title || "Untitled"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(conv.created_at)}
                  </div>
                </button>
              ))}
              {conversations.length === 0 && !loadingHistory && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No previous conversations
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Top bar: history toggle + client selector */}
        <div className="border-b px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setShowHistory(!showHistory)}
            title="Conversation history"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          {conversations.length > 0 && !showHistory && (
            <span className="text-xs text-muted-foreground">
              {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
            </span>
          )}
          <div className="ml-auto flex items-center gap-3">
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
        </div>

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4" ref={scrollRef}>
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
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="text-sm whitespace-pre-wrap">
                    {msg.content}
                  </div>
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
        </div>

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
