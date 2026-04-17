"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  RefreshCw,
  Calendar,
  Pause,
  Play,
  Zap,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Send,
  User,
  Bot,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/database";

type TaskRecurrence = {
  id: string;
  frequency: string;
  active: boolean;
  next_run: string | null;
};

type TaskExecution = {
  id: string;
  status: string;
  result: string | null;
  tool_calls: { name: string; result: string }[] | null;
  tokens_used: number | null;
  trigger_type: string;
  started_at: string;
  completed_at: string | null;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolUse?: { name: string; result: string }[];
  created_at?: string;
};

type AgentTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  client_id: string | null;
  conversation_id?: string | null;
  created_at: string;
  task_recurrences?: TaskRecurrence[];
  clients?: { name: string } | null;
};

type Props = {
  agent: Agent;
  partnerId: string;
  clients: { id: string; name: string }[];
  initialTasks: AgentTask[];
};

const priorityColors: Record<string, string> = {
  low: "secondary",
  medium: "outline",
  high: "default",
  urgent: "destructive",
};

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "Running...",
  review: "Review",
  completed: "Completed",
  cancelled: "Paused",
};

const statusIcons: Record<string, typeof Clock> = {
  open: Clock,
  in_progress: Loader2,
  review: MessageCircle,
  completed: CheckCircle2,
  cancelled: Pause,
};

const frequencyLabels: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  bi_weekly: "Bi-weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

export function AgentTasksPanel({ agent, partnerId, clients, initialTasks }: Props) {
  const [tasks, setTasks] = useState<AgentTask[]>(initialTasks);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "", description: "", priority: "", due_date: "", recurrence_frequency: "",
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "", description: "", priority: "medium", due_date: "", client_id: "", recurrence: "",
  });
  // Execution state
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [executionStatus, setExecutionStatus] = useState<string | null>(null);
  // Chat state — per task
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [loadingChat, setLoadingChat] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  // Execution history
  const [expandedExecId, setExpandedExecId] = useState<string | null>(null);
  const [executions, setExecutions] = useState<Record<string, TaskExecution[]>>({});
  const [loadingExecs, setLoadingExecs] = useState<string | null>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, openChatId]);

  async function refreshTasks() {
    const res = await fetch(`/api/tasks?agent_id=${agent.id}`);
    const data = await res.json();
    if (data.tasks) setTasks(data.tasks);
  }

  async function handleCreate() {
    if (!newTask.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTask.title,
          description: newTask.description || null,
          agent_id: agent.id,
          assigned_by: partnerId,
          priority: newTask.priority,
          due_date: newTask.due_date || null,
          client_id: newTask.client_id || null,
          recurrence_frequency: newTask.recurrence || null,
        }),
      });
      if (res.ok) {
        await refreshTasks();
        setCreateOpen(false);
        setNewTask({ title: "", description: "", priority: "medium", due_date: "", client_id: "", recurrence: "" });
      }
    } finally {
      setSaving(false);
    }
  }

  function startEdit(task: AgentTask) {
    const recurrence = task.task_recurrences?.[0];
    setEditingId(task.id);
    setEditForm({
      title: task.title,
      description: task.description ?? "",
      priority: task.priority,
      due_date: task.due_date ?? "",
      recurrence_frequency: recurrence?.frequency ?? "",
    });
  }

  async function saveEdit(taskId: string) {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: editForm.title,
        description: editForm.description || null,
        priority: editForm.priority,
        due_date: editForm.due_date || null,
      };
      if (editForm.recurrence_frequency && editForm.recurrence_frequency !== "none") {
        body.recurrence_frequency = editForm.recurrence_frequency;
      }
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await refreshTasks();
        setEditingId(null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function togglePause(task: AgentTask) {
    const isPaused = task.status === "cancelled";
    const recurrence = task.task_recurrences?.[0];
    const body: Record<string, unknown> = {
      status: isPaused ? "open" : "cancelled",
    };
    if (recurrence) {
      body.recurrence_active = isPaused;
    }
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) await refreshTasks();
  }

  async function markComplete(task: AgentTask) {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    if (res.ok) await refreshTasks();
  }

  async function changeFrequency(task: AgentTask, newFreq: string) {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recurrence_frequency: newFreq }),
    });
    if (res.ok) await refreshTasks();
  }

  async function deleteTask(taskId: string) {
    if (!confirm("Delete this task?")) return;
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (res.ok) setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  // Execute a task — uses SSE streaming to show real-time progress
  async function runTask(task: AgentTask) {
    setExecutingId(task.id);
    setExecutionStatus(`${agent.name} is starting...`);

    try {
      const res = await fetch(`/api/tasks/${task.id}/execute`, { method: "POST" });

      if (!res.ok) {
        let errorMsg = `HTTP ${res.status}`;
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch {
          errorMsg = await res.text().catch(() => errorMsg);
        }
        alert(`Failed to start task: ${errorMsg}`);
        setExecutingId(null);
        setExecutionStatus(null);
        return;
      }

      // Read the SSE stream
      const reader = res.body?.getReader();
      if (!reader) {
        alert("Failed to read response stream");
        setExecutingId(null);
        setExecutionStatus(null);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? ""; // Keep incomplete chunk

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "status" || data.type === "tool") {
              setExecutionStatus(data.message);
            } else if (data.type === "complete") {
              // Load the conversation
              if (data.conversationId) {
                try {
                  const convRes = await fetch(`/api/conversations/${data.conversationId}`);
                  const convData = await convRes.json();
                  if (convData.messages) {
                    const loaded: ChatMessage[] = convData.messages
                      .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
                      .map((m: { id: string; role: string; content: string; tool_calls: { name: string; result: string }[] | null }) => ({
                        id: m.id,
                        role: m.role as "user" | "assistant",
                        content: m.content,
                        toolUse: m.tool_calls ?? undefined,
                      }));
                    setChatMessages((prev) => ({ ...prev, [task.id]: loaded }));
                  }
                } catch {
                  // Show result directly
                  setChatMessages((prev) => ({
                    ...prev,
                    [task.id]: [{
                      id: crypto.randomUUID(),
                      role: "assistant",
                      content: data.result,
                    }],
                  }));
                }
              }
              setOpenChatId(task.id);
            } else if (data.type === "error") {
              alert(`Task execution error: ${data.message}`);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      await refreshTasks();
    } catch (err) {
      console.error("Task execution error:", err);
      alert(`Task execution error: ${err instanceof Error ? err.message : "Connection lost. The agent may still be working — check back in a minute."}`);
    } finally {
      setExecutingId(null);
      setExecutionStatus(null);
      await refreshTasks();
    }
  }

  // Open chat for a task — load existing conversation if available
  async function openTaskChat(task: AgentTask) {
    if (openChatId === task.id) {
      setOpenChatId(null);
      return;
    }

    // If task has a conversation, load it
    if (task.conversation_id) {
      setLoadingChat(task.id);
      try {
        const res = await fetch(`/api/conversations/${task.conversation_id}`);
        const data = await res.json();
        if (data.messages) {
          const loaded: ChatMessage[] = data.messages
            .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
            .map((m: { id: string; role: string; content: string; tool_calls: { name: string; result: string }[] | null; created_at: string }) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
              toolUse: m.tool_calls ?? undefined,
              created_at: m.created_at,
            }));
          setChatMessages((prev) => ({ ...prev, [task.id]: loaded }));
        }
      } catch {
        // Failed to load — start fresh
      } finally {
        setLoadingChat(null);
      }
    }

    setOpenChatId(task.id);
    setChatInput("");
    setTimeout(() => chatInputRef.current?.focus(), 100);
  }

  // Send a chat message on a task
  async function sendTaskChat(task: AgentTask) {
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    setChatMessages((prev) => ({
      ...prev,
      [task.id]: [...(prev[task.id] ?? []), userMsg],
    }));
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch(`/api/tasks/${task.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, partnerId }),
      });
      const data = await res.json();

      if (res.ok) {
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.content,
          toolUse: data.toolUse,
        };
        setChatMessages((prev) => ({
          ...prev,
          [task.id]: [...(prev[task.id] ?? []), assistantMsg],
        }));
        // Refresh to pick up any status changes
        await refreshTasks();
      } else {
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Sorry, I encountered an error: ${data.details || data.error || "Unknown error"}`,
        };
        setChatMessages((prev) => ({
          ...prev,
          [task.id]: [...(prev[task.id] ?? []), errorMsg],
        }));
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
      };
      setChatMessages((prev) => ({
        ...prev,
        [task.id]: [...(prev[task.id] ?? []), errorMsg],
      }));
    } finally {
      setChatLoading(false);
      chatInputRef.current?.focus();
    }
  }

  function handleChatKeyDown(e: React.KeyboardEvent, task: AgentTask) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendTaskChat(task);
    }
  }

  // Load execution history
  async function loadExecutions(taskId: string) {
    if (expandedExecId === taskId) {
      setExpandedExecId(null);
      return;
    }
    setLoadingExecs(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/executions`);
      const data = await res.json();
      if (data.executions) {
        setExecutions((prev) => ({ ...prev, [taskId]: data.executions }));
      }
      setExpandedExecId(taskId);
    } finally {
      setLoadingExecs(null);
    }
  }

  function renderTaskChat(task: AgentTask) {
    const messages = chatMessages[task.id] ?? [];
    const isLoading = loadingChat === task.id;

    return (
      <div className="mt-3 border-t pt-3">
        {/* Chat messages */}
        <div
          ref={openChatId === task.id ? chatScrollRef : undefined}
          className="max-h-80 overflow-y-auto space-y-3 mb-3"
        >
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Loading conversation...</span>
            </div>
          )}

          {!isLoading && messages.length === 0 && (
            <p className="text-sm text-muted-foreground italic py-2">
              No conversation yet. Run the task or send a message to start.
            </p>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className="flex gap-2.5">
              <div
                className={cn(
                  "shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {msg.role === "user" ? (
                  <User className="h-3.5 w-3.5" />
                ) : (
                  <Bot className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </div>
                {msg.toolUse?.map((tool, i) => (
                  <Card key={i} className="p-2.5 bg-muted/50">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Wrench className="h-3 w-3" />
                      {tool.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </div>
                    {tool.result && (
                      <div className="text-xs whitespace-pre-wrap max-h-24 overflow-y-auto">
                        {tool.result}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}

          {chatLoading && openChatId === task.id && (
            <div className="flex gap-2.5">
              <div className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center bg-muted">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {agent.name} is working...
              </div>
            </div>
          )}
        </div>

        {/* Chat input */}
        <div className="flex gap-2">
          <Textarea
            ref={openChatId === task.id ? chatInputRef : undefined}
            value={openChatId === task.id ? chatInput : ""}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => handleChatKeyDown(e, task)}
            placeholder={`Reply to ${agent.name}...`}
            className="resize-none min-h-[40px] max-h-24 text-sm"
            rows={1}
            disabled={chatLoading}
          />
          <Button
            onClick={() => sendTaskChat(task)}
            disabled={!chatInput.trim() || chatLoading}
            size="icon"
            className="shrink-0 h-10 w-10"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Mark as complete button — shown when task is in review */}
        {task.status === "review" && (
          <div className="flex justify-end mt-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-green-700 border-green-300 hover:bg-green-50"
              onClick={() => markComplete(task)}
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark Complete
            </Button>
          </div>
        )}
      </div>
    );
  }

  function renderTaskCard(task: AgentTask) {
    const recurrence = task.task_recurrences?.[0];
    const isRecurring = recurrence != null;
    const isPaused = task.status === "cancelled";
    const isRunning = executingId === task.id || task.status === "in_progress";
    const isChatOpen = openChatId === task.id;
    const hasConversation = task.conversation_id != null || (chatMessages[task.id]?.length ?? 0) > 0;
    const StatusIcon = statusIcons[task.status] ?? Clock;

    // Edit mode
    if (editingId === task.id) {
      return (
        <Card key={task.id} className="border-primary">
          <CardContent className="pt-4 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Title</label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                placeholder="Task title"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Description</label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Description..."
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[60px]"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
                <Select value={editForm.priority} onValueChange={(val) => setEditForm({ ...editForm, priority: val ?? editForm.priority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Due Date</label>
                <Input
                  type="date"
                  value={editForm.due_date}
                  onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Frequency</label>
                <Select value={editForm.recurrence_frequency} onValueChange={(val) => setEditForm({ ...editForm, recurrence_frequency: val ?? "" })}>
                  <SelectTrigger><SelectValue placeholder="One-time" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">One-time</SelectItem>
                    {Object.entries(frequencyLabels).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={() => saveEdit(task.id)} disabled={saving}>
                <Check className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Display mode
    return (
      <Card key={task.id} className={cn(
        isPaused && "opacity-60",
        isRunning && "border-blue-300 bg-blue-50/30",
        task.status === "review" && "border-amber-300 bg-amber-50/20",
        isChatOpen && "border-primary",
      )}>
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Title row */}
              <div className="flex items-center gap-2 flex-wrap">
                <StatusIcon className={cn(
                  "h-4 w-4 shrink-0",
                  task.status === "completed" && "text-green-600",
                  task.status === "in_progress" && "text-blue-600 animate-spin",
                  task.status === "review" && "text-amber-600",
                  task.status === "cancelled" && "text-amber-600",
                  task.status === "open" && "text-muted-foreground",
                )} />
                <p className={cn("font-medium", isPaused && "line-through")}>{task.title}</p>
                {isRecurring && !isPaused && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <RefreshCw className="h-3 w-3" />
                    {frequencyLabels[recurrence.frequency] ?? recurrence.frequency}
                  </Badge>
                )}
                {isPaused && (
                  <Badge variant="secondary" className="gap-1 text-xs bg-amber-100 text-amber-700">
                    <Pause className="h-3 w-3" /> Paused
                  </Badge>
                )}
                {task.status === "review" && (
                  <Badge variant="secondary" className="gap-1 text-xs bg-amber-100 text-amber-700">
                    <MessageCircle className="h-3 w-3" /> Needs Review
                  </Badge>
                )}
                {task.status === "completed" && (
                  <Badge variant="secondary" className="gap-1 text-xs bg-green-100 text-green-700">
                    <CheckCircle2 className="h-3 w-3" /> Completed
                  </Badge>
                )}
              </div>

              {/* Description */}
              {task.description && (
                <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
              )}

              {/* Info row */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <Badge variant={priorityColors[task.priority] as "default" | "secondary" | "outline" | "destructive"}>
                  {task.priority}
                </Badge>
                {task.clients?.name && (
                  <span className="text-xs text-muted-foreground">Client: {task.clients.name}</span>
                )}
                {task.due_date && (
                  <span className={cn(
                    "text-xs flex items-center gap-1",
                    new Date(task.due_date) < new Date() && task.status === "open"
                      ? "text-red-600 font-medium"
                      : "text-muted-foreground"
                  )}>
                    <Calendar className="h-3 w-3" />
                    {new Date(task.due_date).toLocaleDateString()}
                    {new Date(task.due_date) < new Date() && task.status === "open" && " (overdue)"}
                  </span>
                )}
              </div>

              {/* Frequency control for recurring tasks */}
              {isRecurring && !isPaused && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                  <span className="text-xs text-muted-foreground font-medium">Frequency:</span>
                  <Select
                    value={recurrence.frequency}
                    onValueChange={(val) => { if (val) changeFrequency(task, val); }}
                  >
                    <SelectTrigger className="w-36 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(frequencyLabels).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-1 shrink-0">
              {/* Run Now button */}
              {(task.status === "open" || task.status === "review") && !isPaused && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-9 gap-2 px-3 w-full bg-blue-600 hover:bg-blue-700"
                  onClick={() => runTask(task)}
                  disabled={isRunning}
                >
                  {isRunning ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Running...</>
                  ) : (
                    <><Zap className="h-4 w-4" /> Run Now</>
                  )}
                </Button>
              )}
              {/* Live execution status */}
              {isRunning && executingId === task.id && executionStatus && (
                <p className="text-xs text-blue-600 text-center mt-1 animate-pulse">
                  {executionStatus}
                </p>
              )}
              {/* Chat button */}
              <Button
                variant={isChatOpen ? "default" : "outline"}
                size="sm"
                className={cn("h-9 gap-2 px-3 w-full", hasConversation && !isChatOpen && "border-amber-300 text-amber-700")}
                onClick={() => openTaskChat(task)}
              >
                <MessageCircle className="h-4 w-4" />
                {isChatOpen ? "Close Chat" : "Chat"}
              </Button>
              {/* Pause/Resume */}
              <Button
                variant={isPaused ? "default" : "outline"}
                size="sm"
                className="h-9 gap-2 px-3 w-full"
                onClick={() => togglePause(task)}
              >
                {isPaused ? (
                  <><Play className="h-4 w-4" /> Resume</>
                ) : (
                  <><Pause className="h-4 w-4" /> Pause</>
                )}
              </Button>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(task)} title="Edit">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteTask(task.id)} title="Delete">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Chat thread — inline below task */}
          {isChatOpen && renderTaskChat(task)}

          {/* Execution history toggle (when chat is not open) */}
          {!isChatOpen && (
            <div className="mt-3 pt-3 border-t">
              <button
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => loadExecutions(task.id)}
              >
                {loadingExecs === task.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : expandedExecId === task.id ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                {expandedExecId === task.id ? "Hide" : "View"} execution history
              </button>

              {expandedExecId === task.id && (
                <div className="mt-3 space-y-3">
                  {(executions[task.id] ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      No executions yet. Click &quot;Run Now&quot; to have the agent execute this task.
                    </p>
                  ) : (
                    (executions[task.id] ?? []).map((exec) => (
                      <div
                        key={exec.id}
                        className={cn(
                          "rounded-lg border p-3 text-sm",
                          exec.status === "completed" && "bg-green-50 border-green-200",
                          exec.status === "failed" && "bg-red-50 border-red-200",
                          exec.status === "running" && "bg-blue-50 border-blue-200"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {exec.status === "completed" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                            {exec.status === "failed" && <XCircle className="h-4 w-4 text-red-600" />}
                            {exec.status === "running" && <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />}
                            <span className="font-medium capitalize">{exec.status}</span>
                            <Badge variant="outline" className="text-xs">
                              {exec.trigger_type === "cron" ? "Scheduled" : "Manual"}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(exec.started_at).toLocaleString()}
                          </span>
                        </div>
                        {exec.result && (
                          <div className="mt-1 whitespace-pre-wrap text-sm max-h-32 overflow-y-auto">
                            {exec.result.substring(0, 500)}{exec.result.length > 500 ? "..." : ""}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const recurringTasks = tasks.filter((t) => t.task_recurrences && t.task_recurrences.length > 0);
  const oneTimeTasks = tasks.filter((t) => !t.task_recurrences || t.task_recurrences.length === 0);

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          {tasks.length} task{tasks.length !== 1 ? "s" : ""} assigned to {agent.name}
        </p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" />Add Task</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Task for {agent.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Title *</label>
                <Input
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Task title"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Detailed instructions for the agent..."
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[80px]"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Priority</label>
                  <Select value={newTask.priority} onValueChange={(val) => setNewTask({ ...newTask, priority: val ?? "medium" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Due Date</label>
                  <Input
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Client</label>
                  <Select value={newTask.client_id} onValueChange={(val) => setNewTask({ ...newTask, client_id: val ?? "" })}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Recurrence</label>
                  <Select value={newTask.recurrence} onValueChange={(val) => setNewTask({ ...newTask, recurrence: val ?? "" })}>
                    <SelectTrigger><SelectValue placeholder="One-time" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">One-time</SelectItem>
                      {Object.entries(frequencyLabels).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCreate} disabled={!newTask.title.trim() || saving} className="w-full">
                {saving ? "Creating..." : "Create Task"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Recurring Tasks */}
      {recurringTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Recurring Tasks ({recurringTasks.length})
          </h3>
          <div className="space-y-2">
            {recurringTasks.map((t) => renderTaskCard(t))}
          </div>
        </div>
      )}

      {/* One-time Tasks */}
      {oneTimeTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            Tasks ({oneTimeTasks.length})
          </h3>
          <div className="space-y-2">
            {oneTimeTasks.map((t) => renderTaskCard(t))}
          </div>
        </div>
      )}

      {tasks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No tasks assigned to {agent.name} yet. Click &quot;Add Task&quot; to create one.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
