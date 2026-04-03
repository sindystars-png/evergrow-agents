import { supabaseAdmin } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";

export default async function ActivityPage() {
  const { data: logs } = await supabaseAdmin
    .from("audit_log")
    .select("*, agents(name, slug)")
    .order("created_at", { ascending: false })
    .limit(100);

  const agentIcons: Record<string, string> = {
    "payroll-manager": "💰",
    bookkeeper: "📚",
    "sales-tax-specialist": "🧾",
    "document-manager": "📁",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Activity Log</h1>
        <p className="text-muted-foreground mt-1">
          Audit trail of all agent actions and system events
        </p>
      </div>

      {(logs ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              No activity yet. Agent actions will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(logs ?? []).map((log) => (
            <Card key={log.id}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="text-xl shrink-0">
                    {log.agents?.slug
                      ? agentIcons[log.agents.slug] ?? "🤖"
                      : "📋"}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {log.agents?.name && (
                        <span className="text-sm font-medium">
                          {log.agents.name}
                        </span>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {log.action}
                      </Badge>
                    </div>
                    <p className="text-sm mt-1">{log.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
