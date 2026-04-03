import { supabaseAdmin } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare } from "lucide-react";

const priorityColors: Record<string, string> = {
  low: "secondary",
  medium: "outline",
  high: "default",
  urgent: "destructive",
};

const statusColors: Record<string, string> = {
  open: "outline",
  in_progress: "default",
  review: "secondary",
  completed: "default",
  cancelled: "secondary",
};

export default async function TasksPage() {
  const { data: tasks } = await supabaseAdmin
    .from("tasks")
    .select("*, agents(name), clients(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  const grouped = {
    open: (tasks ?? []).filter((t) => t.status === "open"),
    in_progress: (tasks ?? []).filter((t) => t.status === "in_progress"),
    review: (tasks ?? []).filter((t) => t.status === "review"),
    completed: (tasks ?? []).filter((t) => t.status === "completed"),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tasks</h1>
        <p className="text-muted-foreground mt-1">
          Track work items created by you and your agents
        </p>
      </div>

      {(tasks ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              No tasks yet. Tasks are created when you chat with agents or add them manually.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {(["open", "in_progress", "review", "completed"] as const).map(
            (status) => {
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
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {task.title}
                              </p>
                              {task.description && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {task.description}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                {task.agents?.name && (
                                  <span>Agent: {task.agents.name}</span>
                                )}
                                {task.clients?.name && (
                                  <span>Client: {task.clients.name}</span>
                                )}
                                {task.due_date && (
                                  <span>
                                    Due:{" "}
                                    {new Date(
                                      task.due_date
                                    ).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge
                                variant={
                                  (priorityColors[
                                    task.priority
                                  ] as "secondary" | "outline" | "default" | "destructive") ?? "outline"
                                }
                              >
                                {task.priority}
                              </Badge>
                              <Badge
                                variant={
                                  (statusColors[
                                    task.status
                                  ] as "secondary" | "outline" | "default") ?? "outline"
                                }
                              >
                                {task.status.replace("_", " ")}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}
