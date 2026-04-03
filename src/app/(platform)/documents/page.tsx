import { supabaseAdmin } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

const statusBadge: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "destructive",
  requested: "outline",
  received: "secondary",
  processed: "secondary",
  reviewed: "default",
  filed: "default",
};

export default async function DocumentsPage() {
  const { data: docs } = await supabaseAdmin
    .from("document_tracker")
    .select("*, clients(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  // Group by client
  const byClient: Record<string, typeof docs> = {};
  for (const doc of docs ?? []) {
    const clientName = (doc.clients as { name: string } | null)?.name ?? "Unassigned";
    if (!byClient[clientName]) byClient[clientName] = [];
    byClient[clientName]!.push(doc);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Document Tracker</h1>
        <p className="text-muted-foreground mt-1">
          Track client document intake and internal file organization
        </p>
      </div>

      {(docs ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              No documents tracked yet. Ask the Document Manager to generate a
              document request list for a client.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(byClient).map(([clientName, clientDocs]) => (
            <div key={clientName}>
              <h2 className="text-sm font-semibold mb-3">{clientName}</h2>
              <div className="space-y-2">
                {(clientDocs ?? []).map((doc) => (
                  <Card key={doc.id}>
                    <CardContent className="pt-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {doc.document_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {doc.category ?? "Uncategorized"}
                          {doc.tax_year && ` | ${doc.tax_year}`}
                        </p>
                      </div>
                      <Badge variant={statusBadge[doc.status] ?? "outline"}>
                        {doc.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
