import { supabaseAdmin } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (!client) notFound();

  const [schedulesRes, tasksRes, docsRes] = await Promise.all([
    supabaseAdmin.from("client_schedules").select("*").eq("client_id", clientId).order("next_due_date"),
    supabaseAdmin.from("tasks").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(20),
    supabaseAdmin.from("document_tracker").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(20),
  ]);

  const schedules = schedulesRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const docs = docsRes.data ?? [];

  const entityLabels: Record<string, string> = {
    individual: "Individual",
    sole_prop: "Sole Proprietorship",
    partnership: "Partnership",
    corporation: "Corporation",
    s_corp: "S Corporation",
    llc: "LLC",
    nonprofit: "Nonprofit",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            {client.entity_type && (
              <span className="text-sm text-muted-foreground">
                {entityLabels[client.entity_type] ?? client.entity_type}
              </span>
            )}
            <Badge variant={client.status === "active" ? "default" : "secondary"}>
              {client.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Client Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {client.ein && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">EIN</p>
              <p className="text-sm font-medium">{client.ein}</p>
            </CardContent>
          </Card>
        )}
        {client.email && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium">{client.email}</p>
            </CardContent>
          </Card>
        )}
        {client.phone && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="text-sm font-medium">{client.phone}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue="schedules">
        <TabsList>
          <TabsTrigger value="schedules">
            Schedules ({schedules.length})
          </TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="documents">
            Documents ({docs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedules" className="mt-4">
          {schedules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                No schedules set up for this client. Chat with an agent to create schedules.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {schedules.map((s) => (
                <Card key={s.id}>
                  <CardContent className="pt-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm capitalize">
                        {s.schedule_type.replace("_", " ")}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {s.frequency.replace("_", "-")}
                        {s.states?.length > 0 && ` | States: ${s.states.join(", ")}`}
                      </p>
                    </div>
                    {s.next_due_date && (
                      <Badge variant="outline">
                        Due: {new Date(s.next_due_date).toLocaleDateString()}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          {tasks.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                No tasks for this client yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tasks.map((t) => (
                <Card key={t.id}>
                  <CardContent className="pt-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{t.title}</p>
                      {t.description && (
                        <p className="text-xs text-muted-foreground">
                          {t.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          t.priority === "urgent" ? "destructive" : "outline"
                        }
                      >
                        {t.priority}
                      </Badge>
                      <Badge variant="secondary">{t.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          {docs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                No documents tracked for this client. Ask the Document Manager
                to generate a document request list.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {docs.map((d) => (
                <Card key={d.id}>
                  <CardContent className="pt-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{d.document_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.category ?? "Uncategorized"}
                        {d.tax_year && ` | ${d.tax_year}`}
                      </p>
                    </div>
                    <Badge
                      variant={
                        d.status === "filed"
                          ? "default"
                          : d.status === "pending"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {d.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
