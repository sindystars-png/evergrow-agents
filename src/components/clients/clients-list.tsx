"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Building2, User } from "lucide-react";
import type { Client } from "@/types/database";
import { useRouter } from "next/navigation";

type Props = {
  clients: Client[];
};

export function ClientsList({ clients }: Props) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    entity_type: "" as string,
    email: "",
    phone: "",
    ein: "",
  });
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate() {
    if (!newClient.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClient.name,
          entity_type: newClient.entity_type || null,
          email: newClient.email || null,
          phone: newClient.phone || null,
          ein: newClient.ein || null,
        }),
      });
      if (res.ok) {
        setDialogOpen(false);
        setNewClient({ name: "", entity_type: "", email: "", phone: "", ein: "" });
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

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
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground mt-1">
            {clients.length} client{clients.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" />Add Client</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Client Name *</label>
                <Input
                  value={newClient.name}
                  onChange={(e) =>
                    setNewClient({ ...newClient, name: e.target.value })
                  }
                  placeholder="e.g., Acme Corporation"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Entity Type</label>
                <Select
                  value={newClient.entity_type}
                  onValueChange={(val) =>
                    setNewClient({ ...newClient, entity_type: val ?? "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(entityLabels).map(([val, label]) => (
                      <SelectItem key={val} value={val}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  value={newClient.email}
                  onChange={(e) =>
                    setNewClient({ ...newClient, email: e.target.value })
                  }
                  placeholder="client@example.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={newClient.phone}
                  onChange={(e) =>
                    setNewClient({ ...newClient, phone: e.target.value })
                  }
                  placeholder="(314) 555-0100"
                />
              </div>
              <div>
                <label className="text-sm font-medium">EIN</label>
                <Input
                  value={newClient.ein}
                  onChange={(e) =>
                    setNewClient({ ...newClient, ein: e.target.value })
                  }
                  placeholder="XX-XXXXXXX"
                />
              </div>
              <Button
                onClick={handleCreate}
                disabled={!newClient.name.trim() || saving}
                className="w-full"
              >
                {saving ? "Creating..." : "Create Client"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients..."
          className="pl-9"
        />
      </div>

      {/* Client list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {search
                ? "No clients match your search"
                : "No clients yet. Add your first client to get started."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((client) => (
            <Card
              key={client.id}
              className="hover:shadow-sm transition-shadow cursor-pointer"
              onClick={() => router.push(`/clients/${client.id}`)}
            >
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    {client.entity_type === "individual" ? (
                      <User className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{client.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {client.entity_type && (
                        <span className="text-xs text-muted-foreground">
                          {entityLabels[client.entity_type] ??
                            client.entity_type}
                        </span>
                      )}
                      {client.email && (
                        <span className="text-xs text-muted-foreground">
                          {client.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Badge
                  variant={
                    client.status === "active" ? "default" : "secondary"
                  }
                >
                  {client.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
