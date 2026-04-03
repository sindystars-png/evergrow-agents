import { supabaseAdmin } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Users, CheckSquare, FileText, ArrowRight, Activity } from "lucide-react";
import Link from "next/link";

const agentIcons: Record<string, string> = {
  "payroll-manager": "💰",
  bookkeeper: "📚",
  "sales-tax-specialist": "🧾",
  "document-manager": "📁",
};

const statusColors: Record<string, string> = {
  active: "bg-green-500",
  paused: "bg-yellow-500",
  maintenance: "bg-red-500",
};

export default async function DashboardPage() {
  const [agentsRes, clientsRes, tasksRes, auditRes] = await Promise.all([
    supabaseAdmin.from("agents").select("*").order("name"),
    supabaseAdmin.from("clients").select("id", { count: "exact" }).eq("status", "active"),
    supabaseAdmin.from("tasks").select("id, status", { count: "exact" }).neq("status", "completed").neq("status", "cancelled"),
    supabaseAdmin.from("audit_log").select("*").order("created_at", { ascending: false }).limit(10),
  ]);

  const agents = agentsRes.data ?? [];
  const clientCount = clientsRes.count ?? 0;
  const openTaskCount = tasksRes.count ?? 0;
  const recentActivity = auditRes.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your AI agent team
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Bot className="h-5 w-5 text-blue-600" />
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
              <div className="p-2 rounded-lg bg-green-50">
                <Users className="h-5 w-5 text-green-600" />
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
              <div className="p-2 rounded-lg bg-orange-50">
                <CheckSquare className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{openTaskCount}</p>
                <p className="text-xs text-muted-foreground">Open Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recentActivity.length}</p>
                <p className="text-xs text-muted-foreground">
                  Recent Activities
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
          {agents.map((agent) => (
            <Link key={agent.id} href={`/agents/${agent.slug}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">
                        {agentIcons[agent.slug] ?? "🤖"}
                      </div>
                      <div>
                        <h3 className="font-semibold">{agent.name}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {agent.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${statusColors[agent.status]}`}
                      />
                      <Badge variant="secondary" className="text-xs">
                        {agent.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-sm text-primary">
                    Chat with {agent.name.split(" ")[0]}
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <Link
            href="/activity"
            className="text-sm text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        <Card>
          <CardContent className="pt-6">
            {recentActivity.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                No activity yet. Start chatting with an agent to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 text-sm border-b last:border-0 pb-3 last:pb-0"
                  >
                    <Activity className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p>{entry.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(entry.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
