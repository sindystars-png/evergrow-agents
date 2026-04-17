"use client";

import { useState } from "react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { AgentTasksPanel } from "@/components/agents/agent-tasks-panel";
import type { Agent } from "@/types/database";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  ClipboardList,
  DollarSign,
  BookOpen,
  Receipt,
  FolderOpen,
  FileSpreadsheet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Conversation = {
  id: string;
  title: string | null;
  created_at: string;
  client_id?: string | null;
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
  task_recurrences?: { id: string; frequency: string; active: boolean; next_run: string | null }[];
  clients?: { name: string } | null;
};

type Props = {
  agent: Agent;
  partnerId: string;
  partnerName: string;
  clients: { id: string; name: string }[];
  existingConversations: Conversation[];
  initialTasks: AgentTask[];
};

const agentIcons: Record<string, LucideIcon> = {
  "payroll-manager": DollarSign,
  "bookkeeper": BookOpen,
  "sales-tax-specialist": Receipt,
  "document-manager": FolderOpen,
  "income-tax-specialist": FileSpreadsheet,
};

const agentColors: Record<string, string> = {
  "payroll-manager": "bg-emerald-100 text-emerald-700",
  "bookkeeper": "bg-blue-100 text-blue-700",
  "sales-tax-specialist": "bg-amber-100 text-amber-700",
  "document-manager": "bg-purple-100 text-purple-700",
  "income-tax-specialist": "bg-rose-100 text-rose-700",
};

export function AgentWorkspace({
  agent,
  partnerId,
  partnerName,
  clients,
  existingConversations,
  initialTasks,
}: Props) {
  const [activeTab, setActiveTab] = useState<"chat" | "tasks">("chat");
  const Icon = agentIcons[agent.slug] ?? FileSpreadsheet;
  const iconColor = agentColors[agent.slug] ?? "bg-muted text-muted-foreground";
  const taskCount = initialTasks.length;

  return (
    <div className="h-[calc(100vh-6rem)] lg:h-[calc(100vh-4rem)] flex flex-col">
      {/* Agent header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", iconColor)}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">{agent.name}</h1>
            <p className="text-sm text-muted-foreground hidden md:block max-w-xl truncate">
              {agent.description}
            </p>
          </div>
        </div>

        {/* Tab buttons */}
        <div className="flex bg-muted rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab("chat")}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-lg text-base font-medium transition-all",
              activeTab === "chat"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageSquare className="h-5 w-5" />
            Chat
          </button>
          <button
            onClick={() => setActiveTab("tasks")}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-lg text-base font-medium transition-all",
              activeTab === "tasks"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ClipboardList className="h-5 w-5" />
            Tasks
            {taskCount > 0 && (
              <span className={cn(
                "ml-1 text-xs font-semibold px-2 py-0.5 rounded-full",
                activeTab === "tasks"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted-foreground/20 text-muted-foreground"
              )}>
                {taskCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {activeTab === "chat" ? (
          <ChatPanel
            agent={agent}
            partnerId={partnerId}
            partnerName={partnerName}
            clients={clients}
            existingConversations={existingConversations}
          />
        ) : (
          <div className="h-full overflow-y-auto">
            <AgentTasksPanel
              agent={agent}
              partnerId={partnerId}
              clients={clients}
              initialTasks={initialTasks}
            />
          </div>
        )}
      </div>
    </div>
  );
}
