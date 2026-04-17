"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckSquare,
  Trash2,
  Pencil,
  X,
  Check,
  Plus,
  RefreshCw,
} from "lucide-react";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  agent_id: string | null;
  agents?: { name: string } | null;
  clients?: { name: string } | null;
  created_at: string;
};

type Agent = { id: string; name: string; role: string };

const priorityColors: Record<string, "secondary" | "outline" | "default" | "destructive"> = {
  low: "secondary",
  medium: "outline",
  high: "default",
  urgent: "destructive",
};

const statusColors: Record<string, "secondary" | "outline" | "default"> = {
  open: "outline",
  in_progress: "default",
  review: "secondary",
  completed: "default",
  cancelled: "secondary",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    description: string;
    priority: string;
    due_date: string;
    status: string;
  }>({ title: "", description: "", priority: "medium", due_date: "", status: "open" });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    due_date: "",
    agent_id: "",
    recurrence: "",
  });
  const [partnerId, setPartnerId] = useState("");

  const loadTasks = useCallback(async () => {
    const res = await fetch("/api/tasks");
    const data = await res.json();
    setTasks(data.tasks ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTasks();
    // Load agents for the create form
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d) => setAgents(d.agents ?? []))
      .catch(() => {});
    // Get partner ID
    fetch("/api/microsoft/status")
      .then((r) => r.json())
      .catch(() => {});
    // Use a fallback approach for partner ID
    fetch("/api/partner")
      .then((r) => r.json())
      .then((d) => setPartnerId(d.partnerId ?? ""))
      .catch(() => {});
  }, [loadTasks]);

  function startEdit(task: Task) {
    setEditingId(task.id);
    setEditForm({
      title: task.title,
      description: task.description ?? "",
      priority: task.priority,
      due_date: task.due_date ?? "",
      status: task.status,
    });
  }

  async function saveEdit(taskId: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setEditingId(null);
    loadTasks();
  }

  async function deleteTask(taskId: string) {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    loadTasks();
  }

  async function createTask() {
    if (!newTask.title.trim()) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTask.title,
        description: newTask.description || null,
        priority: newTask.priority,
        due_date: newTask.due_date || null,
        agent_id: newTask.agent_id || null,
        assigned_by: partnerId,
        recurrence: newTask.recurrence
          ? { frequency: newTask.recurrence }
          : undefined,
      }),
    });
    setNewTask({ title: "", description: "", priority: "medium", due_date: "", agent_id: "", recurrence: "" });
    setShowCreateForm(false);
    loadTasks();
  }

  const grouped = {
    open: tasks.filter((t) => t.status === "open"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    review: tasks.filter((t) => t.status === "review"),
    completed: tasks.filter((t) => t.status === "completed"),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-muted-foreground mt-1">
            Track work items created by you and your agents
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          New Task
        </Button>
      </div>

      {/* Create task form */}
      {showCreateForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <h3 className="font-semibold text-sm">Create New Task</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Task title *"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              />
              <select
                value={newTask.agent_id}
                onChange={(e) => setNewTask({ ...newTask, agent_id: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Assign to agent (optional)</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <textarea
              placeholder="Task description / instructions"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[60px]"
              rows={2}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Priority</label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Due Date</label>
                <input
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Recurrence</label>
                <select
                  value={newTask.recurrence}
                  onChange={(e) => setNewTask({ ...newTask, recurrence: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">One-time (no recurrence)</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="bi_weekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={createTask} disabled={!newTask.title.trim()}>
                Create Task
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tasks.length === 0 && !showCreateForm ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              No tasks yet. Tasks are created when you chat with agents or click &quot;New Task&quot; above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {(["open", "in_progress", "review", "completed"] as const).map((status) => {
            const items = grouped[status];
            if (items.length === 0) return null;
            return (
              <div key={status}>
                <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3">
                  {status.replace("_", " ")} ({items.length})
                </h2>
                <div className="space-y-2">
                  {items.map((task) => (
                    <Card key={task.id}>
                      <CardContent className="pt-4">
                        {editingId === task.id ? (
                          /* Edit mode */
                          <div className="space-y-3">
                            <input
                              type="text"
                              value={editForm.title}
                              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-medium"
                            />
                            <textarea
                              value={editForm.description}
                              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                              placeholder="Description / instructions"
                              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[60px]"
                              rows={2}
                            />
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="text-xs text-muted-foreground">Priority</label>
                                <select
                                  value={editForm.priority}
                                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                                >
                                  <option value="low">Low</option>
                                  <option value="medium">Medium</option>
                                  <option value="high">High</option>
                                  <option value="urgent">Urgent</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">Due Date</label>
                                <input
                                  type="date"
                                  value={editForm.due_date}
                                  onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">Status</label>
                                <select
                                  value={editForm.status}
                                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                                >
                                  <option value="open">Open</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="review">Review</option>
                                  <option value="completed">Completed</option>
                                  <option value="cancelled">Cancelled</option>
                                </select>
                              </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                                <X className="h-3 w-3 mr-1" /> Cancel
                              </Button>
                              <Button size="sm" onClick={() => saveEdit(task.id)}>
                                <Check className="h-3 w-3 mr-1" /> Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* Display mode */
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{task.title}</p>
                              {task.description && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {task.description}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                {task.agents?.name && <span>Agent: {task.agents.name}</span>}
                                {task.clients?.name && <span>Client: {task.clients.name}</span>}
                                {task.due_date && (
                                  <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant={priorityColors[task.priority] ?? "outline"}>
                                {task.priority}
                              </Badge>
                              <Badge variant={statusColors[task.status] ?? "outline"}>
                                {task.status.replace("_", " ")}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => startEdit(task)}
                                title="Edit task"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => deleteTask(task.id)}
                                title="Delete task"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
