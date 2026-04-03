import { supabaseAdmin } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

const agentIcons: Record<string, string> = {
  "payroll-manager": "💰",
  bookkeeper: "📚",
  "sales-tax-specialist": "🧾",
  "document-manager": "📁",
};

export default async function AgentsPage() {
  const { data: agents } = await supabaseAdmin
    .from("agents")
    .select("*")
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Agents</h1>
        <p className="text-muted-foreground mt-1">
          Your AI team members. Click on an agent to start a conversation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(agents ?? []).map((agent) => (
          <Link key={agent.id} href={`/agents/${agent.slug}`}>
            <Card className="hover:shadow-md transition-all cursor-pointer h-full">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-4xl">
                    {agentIcons[agent.slug] ?? "🤖"}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">{agent.name}</h3>
                      <Badge
                        variant={
                          agent.status === "active" ? "default" : "secondary"
                        }
                      >
                        {agent.status}
                      </Badge>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {agent.description}
                </p>
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  Start conversation
                  <ArrowRight className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
