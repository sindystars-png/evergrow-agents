"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Users,
  CheckSquare,
  Activity,
  MessageSquare,
  DollarSign,
  BookOpen,
  FileText,
  Receipt,
} from "lucide-react";
import type { Agent, Task, AuditLog } from "@/types/database";
import { formatDistanceToNow } from "date-fns";

const agentIcons: Record<string, React.ElementType> = {
  "payroll-manager": DollarSign,
  bookkeeper: BookOpen,
  "sales-tax-specialist": Receipt,
  "document-manager": FileText,
};

const statusColors: Record<string, string> = {
  active: "bg-green-500",
  paused: "bg-yellow-500",
  maintenance: "bg-red-500",
};

type Props = {
  agents: Agent[];
  recentTasks: Task[];
  clientCount: number;
  recentActivity: (AuditLog & { agents: { name: string; slug: string } | null })[];
};

export function DashboardContent({
  agents,
  recentTasks,
  clientCount,
  recentActivity,
}: Props) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your AI agent team
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{agents.length}</p>
                <p className="text-xs text-muted-foreground">Active Agents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{clientCount}</p>
                <p className="text-xs text-muted-foreground">Active Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                <CheckSquare className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recentTasks.length}</p>
                <p className="text-xs text-muted-foreground">Open Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recentActivity.length}</p>
                <p className="text-xs text-muted-foreground">
                  Recent Actions
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Your AI Team</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((agent) => {
            const Icon = agentIcons[agent.slug] ?? Bot;
            return (
              <Card key={agent.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{agent.name}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                          {agent.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`h-2 w-2 rounded-full ${statusColors[agent.status]}`}
                      />
                      <span className="text-xs text-muted-foreground capitalize">
                        {agent.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link href={`/agents/${agent.slug}`}>
                      <Button size="sm" className="w-full">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Chat with {agent.name.split(" ")[0]}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <Card>
          <CardContent className="pt-6">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No activity yet. Start chatting with an agent to see activity
                here.
              </p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 text-sm"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p>
                        {entry.agents && (
                          <span className="font-medium">
                            {entry.agents.name}:{" "}
                          </span>
                        )}
                        {entry.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(entry.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {entry.action}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Open Tasks */}
      {recentTasks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Open Tasks</h2>
            <Link href="/tasks">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{task.title}</p>
                      {task.due_date && (
                        <p className="text-xs text-muted-foreground">
                          Due: {task.due_date}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={
                        task.priority === "urgent"
                          ? "destructive"
                          : task.priority === "high"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {task.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
