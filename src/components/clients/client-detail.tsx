"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Check, X, Plus, Trash2, ArrowLeft } from "lucide-react";
import type { Client, ClientService } from "@/types/database";
import { useRouter } from "next/navigation";

type Props = {
  client: Client;
  schedules: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  docs: Record<string, unknown>[];
  services: ClientService[];
};

const entityLabels: Record<string, string> = {
  individual: "Individual",
  sole_prop: "Sole Proprietorship",
  partnership: "Partnership",
  corporation: "Corporation",
  s_corp: "S Corporation",
  llc: "LLC",
  nonprofit: "Nonprofit",
};

const serviceLabels: Record<string, string> = {
  yearend_tax: "Year-End Tax",
  bookkeeping: "Bookkeeping",
  sales_tax: "Sales Tax",
  payroll: "Payroll",
  property_tax: "Property Tax",
};

const frequencyLabels: Record<string, string> = {
  weekly: "Weekly",
  bi_weekly: "Bi-weekly",
  semi_monthly: "Semi-monthly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};

export function ClientDetail({ client: initialClient, schedules, tasks, docs, services: initialServices }: Props) {
  const router = useRouter();
  const [client, setClient] = useState(initialClient);
  const [services, setServices] = useState<ClientService[]>(initialServices);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: client.name,
    entity_type: client.entity_type ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    ein: client.ein ?? "",
    status: client.status,
    contact_name: client.contact_name ?? "",
    contact_phone: client.contact_phone ?? "",
    contact_email: client.contact_email ?? "",
    notes: client.notes ?? "",
  });

  async function saveChanges() {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          entity_type: editForm.entity_type || null,
          email: editForm.email || null,
          phone: editForm.phone || null,
          ein: editForm.ein || null,
          status: editForm.status,
          contact_name: editForm.contact_name || null,
          contact_phone: editForm.contact_phone || null,
          contact_email: editForm.contact_email || null,
          notes: editForm.notes || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setClient(updated);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setEditForm({
      name: client.name,
      entity_type: client.entity_type ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      ein: client.ein ?? "",
      status: client.status,
      contact_name: client.contact_name ?? "",
      contact_phone: client.contact_phone ?? "",
      contact_email: client.contact_email ?? "",
      notes: client.notes ?? "",
    });
    setEditing(false);
  }

  async function addService(serviceType: string) {
    const res = await fetch(`/api/clients/${client.id}/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_type: serviceType }),
    });
    if (res.ok) {
      const svc = await res.json();
      setServices((prev) => [...prev.filter((s) => s.service_type !== svc.service_type), svc]);
    }
  }

  async function updateServiceFrequency(serviceType: string, frequency: string) {
    const res = await fetch(`/api/clients/${client.id}/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_type: serviceType, frequency: frequency || null }),
    });
    if (res.ok) {
      const svc = await res.json();
      setServices((prev) => prev.map((s) => s.service_type === svc.service_type ? svc : s));
    }
  }

  async function removeService(serviceType: string) {
    const res = await fetch(`/api/clients/${client.id}/services?service_type=${serviceType}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setServices((prev) => prev.filter((s) => s.service_type !== serviceType));
    }
  }

  const isEntity = client.entity_type && client.entity_type !== "individual";
  const activeServiceTypes = services.map((s) => s.service_type);
  const availableServices = Object.keys(serviceLabels).filter((s) => !activeServiceTypes.includes(s as ClientService["service_type"]));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/clients")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          {editing ? (
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="text-2xl font-bold h-auto py-1"
            />
          ) : (
            <h1 className="text-2xl font-bold">{client.name}</h1>
          )}
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
        {editing ? (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={cancelEdit}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={saveChanges} disabled={saving}>
              <Check className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4 mr-1" /> Edit
          </Button>
        )}
      </div>

      {/* Client Info */}
      {editing ? (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Entity Type</label>
                <Select value={editForm.entity_type} onValueChange={(val) => setEditForm({ ...editForm, entity_type: val ?? "" })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(entityLabels).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <Select value={editForm.status} onValueChange={(val) => setEditForm({ ...editForm, status: val as Client["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="client@example.com" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Phone</label>
                <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="(314) 555-0100" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">EIN</label>
                <Input value={editForm.ein} onChange={(e) => setEditForm({ ...editForm, ein: e.target.value })} placeholder="XX-XXXXXXX" />
              </div>
            </div>

            {editForm.entity_type && editForm.entity_type !== "individual" && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">Preferred Contact Person</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Contact Name</label>
                    <Input value={editForm.contact_name} onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })} placeholder="Jane Doe" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Contact Phone</label>
                    <Input value={editForm.contact_phone} onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })} placeholder="(314) 555-0100" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Contact Email</label>
                    <Input value={editForm.contact_email} onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })} placeholder="jane@company.com" />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Additional notes..."
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[60px]"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
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
          {isEntity && client.contact_name && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Contact Person</p>
                <p className="text-sm font-medium">{client.contact_name}</p>
                {client.contact_phone && <p className="text-xs text-muted-foreground">{client.contact_phone}</p>}
                {client.contact_email && <p className="text-xs text-muted-foreground">{client.contact_email}</p>}
              </CardContent>
            </Card>
          )}
          {client.notes && (
            <Card className="md:col-span-3">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="text-sm">{client.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">
            Services ({services.length})
          </TabsTrigger>
          <TabsTrigger value="schedules">
            Schedules ({schedules.length})
          </TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="documents">
            Documents ({docs.length})
          </TabsTrigger>
        </TabsList>

        {/* Services Tab */}
        <TabsContent value="services" className="mt-4 space-y-4">
          {services.length > 0 && (
            <div className="space-y-2">
              {services.map((svc) => (
                <Card key={svc.id}>
                  <CardContent className="pt-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="default">{serviceLabels[svc.service_type] ?? svc.service_type}</Badge>
                      <Select
                        value={svc.frequency ?? ""}
                        onValueChange={(val) => updateServiceFrequency(svc.service_type, val ?? "")}
                      >
                        <SelectTrigger className="w-36 h-8 text-xs">
                          <SelectValue placeholder="Set frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(frequencyLabels).map(([val, label]) => (
                            <SelectItem key={val} value={val}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removeService(svc.service_type)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {availableServices.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Add a service:</p>
              <div className="flex flex-wrap gap-2">
                {availableServices.map((svc) => (
                  <Button key={svc} variant="outline" size="sm" onClick={() => addService(svc)}>
                    <Plus className="h-3 w-3 mr-1" />
                    {serviceLabels[svc]}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {services.length === 0 && availableServices.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                All services have been added.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="schedules" className="mt-4">
          {schedules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                No schedules set up for this client. Chat with an agent to create schedules.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {schedules.map((s: Record<string, unknown>) => (
                <Card key={s.id as string}>
                  <CardContent className="pt-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm capitalize">
                        {(s.schedule_type as string).replace("_", " ")}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {(s.frequency as string).replace("_", "-")}
                        {(s.states as string[])?.length > 0 && ` | States: ${(s.states as string[]).join(", ")}`}
                      </p>
                    </div>
                    {s.next_due_date ? (
                      <Badge variant="outline">
                        Due: {new Date(s.next_due_date as string).toLocaleDateString()}
                      </Badge>
                    ) : null}
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
              {tasks.map((t: Record<string, unknown>) => (
                <Card key={t.id as string}>
                  <CardContent className="pt-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{t.title as string}</p>
                      {t.description ? (
                        <p className="text-xs text-muted-foreground">
                          {t.description as string}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={(t.priority as string) === "urgent" ? "destructive" : "outline"}>
                        {t.priority as string}
                      </Badge>
                      <Badge variant="secondary">{t.status as string}</Badge>
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
              {docs.map((d: Record<string, unknown>) => (
                <Card key={d.id as string}>
                  <CardContent className="pt-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{d.document_name as string}</p>
                      <p className="text-xs text-muted-foreground">
                        {(d.category as string) ?? "Uncategorized"}
                        {d.tax_year ? ` | ${d.tax_year as number}` : null}
                      </p>
                    </div>
                    <Badge
                      variant={
                        (d.status as string) === "filed"
                          ? "default"
                          : (d.status as string) === "pending"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {d.status as string}
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
