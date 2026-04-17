"use client";

import { useState, useRef } from "react";
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
import { Plus, Search, Building2, User, Upload, Download, X } from "lucide-react";
import type { Client } from "@/types/database";
import { useRouter } from "next/navigation";

type Props = {
  clients: Client[];
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

type ParsedClient = {
  name: string;
  entity_type: string;
  email: string;
  phone: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
};

function parseCSV(text: string): ParsedClient[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(",").map((h) => h.trim().replace(/^"?|"?$/g, ""));

  // Map common header names
  function findCol(...names: string[]): number {
    for (const n of names) {
      const idx = headers.findIndex((h) => h.includes(n));
      if (idx >= 0) return idx;
    }
    return -1;
  }

  const lastNameCol = findCol("last name", "last_name", "lastname");
  const firstNameCol = findCol("first name", "first_name", "firstname");
  const companyCol = findCol("company", "company name", "business name", "client name", "name");
  const entityCol = findCol("entity", "entity type", "entity_type", "type");
  const emailCol = findCol("email", "e-mail");
  const phoneCol = findCol("phone", "telephone", "tel");
  const contactNameCol = findCol("contact name", "contact_name", "preferred contact");
  const contactPhoneCol = findCol("contact phone", "contact_phone");
  const contactEmailCol = findCol("contact email", "contact_email");

  const results: ParsedClient[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (vals.every((v) => !v.trim())) continue;

    const get = (col: number) => (col >= 0 && col < vals.length ? vals[col].trim() : "");

    // Build name: prefer "Last, First" from separate columns, fall back to company/name column
    let name = "";
    if (lastNameCol >= 0 && get(lastNameCol)) {
      name = get(lastNameCol);
      if (firstNameCol >= 0 && get(firstNameCol)) {
        name = `${get(lastNameCol)}, ${get(firstNameCol)}`;
      }
    } else if (companyCol >= 0) {
      name = get(companyCol);
    }

    if (!name) continue;

    // Normalize entity type
    let entityType = get(entityCol).toLowerCase().replace(/[\s-]+/g, "_");
    if (entityType === "s_corporation" || entityType === "s_corp") entityType = "s_corp";
    else if (entityType === "sole_proprietorship") entityType = "sole_prop";
    else if (!Object.keys(entityLabels).includes(entityType)) entityType = "";

    results.push({
      name,
      entity_type: entityType,
      email: get(emailCol),
      phone: get(phoneCol),
      contact_name: get(contactNameCol),
      contact_phone: get(contactPhoneCol),
      contact_email: get(contactEmailCol),
    });
  }

  return results;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

export function ClientsList({ clients }: Props) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [parsedClients, setParsedClients] = useState<ParsedClient[]>([]);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newClient, setNewClient] = useState({
    name: "",
    entity_type: "" as string,
    email: "",
    phone: "",
    ein: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
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
          contact_name: newClient.contact_name || null,
          contact_phone: newClient.contact_phone || null,
          contact_email: newClient.contact_email || null,
        }),
      });
      if (res.ok) {
        setDialogOpen(false);
        setNewClient({ name: "", entity_type: "", email: "", phone: "", ein: "", contact_name: "", contact_phone: "", contact_email: "" });
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      setParsedClients(parsed);
      setImportMessage("");
      if (parsed.length === 0) {
        setImportMessage("No valid clients found in the file. Check format.");
      }
    };
    reader.readAsText(file);
    // Reset so same file can be selected again
    e.target.value = "";
  }

  async function handleImport() {
    if (parsedClients.length === 0) return;
    setImporting(true);
    setImportMessage("");
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clients: parsedClients }),
      });
      const data = await res.json();
      if (res.ok) {
        setImportMessage(`Successfully imported ${data.imported} clients!`);
        setParsedClients([]);
        router.refresh();
        setTimeout(() => setImportDialogOpen(false), 1500);
      } else {
        setImportMessage(`Error: ${data.error}`);
      }
    } catch {
      setImportMessage("Failed to import clients.");
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const header = "Last Name,First Name,Company Name,Entity Type,Email,Phone,Contact Name,Contact Phone,Contact Email";
    const example1 = "Smith,John,,individual,john@email.com,(314) 555-0100,,,";
    const example2 = ",,Acme Corporation,corporation,info@acme.com,(314) 555-0200,Jane Doe,(314) 555-0201,jane@acme.com";
    const csv = [header, example1, example2].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "client_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const isEntityType = newClient.entity_type && newClient.entity_type !== "individual";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground mt-1">
            {clients.length} client{clients.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={importDialogOpen} onOpenChange={(open) => { setImportDialogOpen(open); if (!open) { setParsedClients([]); setImportMessage(""); } }}>
            <DialogTrigger render={<Button variant="outline"><Upload className="h-4 w-4 mr-2" />Import CSV</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Clients from CSV</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  Upload a CSV file with client information. The file should have column headers.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-1" />
                    Download Template
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-1" />
                    Select CSV File
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>

                {parsedClients.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">
                      Preview ({parsedClients.length} clients found):
                    </p>
                    <div className="max-h-60 overflow-y-auto border rounded-md">
                      <table className="w-full text-xs">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="text-left p-2">Name</th>
                            <th className="text-left p-2">Type</th>
                            <th className="text-left p-2">Email</th>
                            <th className="text-left p-2">Phone</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedClients.map((c, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-2">{c.name}</td>
                              <td className="p-2">{entityLabels[c.entity_type] ?? (c.entity_type || "-")}</td>
                              <td className="p-2">{c.email || "-"}</td>
                              <td className="p-2">{c.phone || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Button onClick={handleImport} disabled={importing} className="w-full">
                      {importing ? "Importing..." : `Import ${parsedClients.length} Clients`}
                    </Button>
                  </div>
                )}

                {importMessage && (
                  <p className={`text-sm p-3 rounded-lg ${
                    importMessage.startsWith("Error") || importMessage.startsWith("No valid") || importMessage.startsWith("Failed")
                      ? "text-red-800 bg-red-50 border border-red-200"
                      : "text-green-800 bg-green-50 border border-green-200"
                  }`}>
                    {importMessage}
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" />Add Client</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="text-sm font-medium">Client Name *</label>
                  <Input
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                    placeholder="Last, First  or  Company Name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Entity Type</label>
                  <Select
                    value={newClient.entity_type}
                    onValueChange={(val) => setNewClient({ ...newClient, entity_type: val ?? "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(entityLabels).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      value={newClient.email}
                      onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                      placeholder="client@example.com"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Phone</label>
                    <Input
                      value={newClient.phone}
                      onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                      placeholder="(314) 555-0100"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">EIN</label>
                  <Input
                    value={newClient.ein}
                    onChange={(e) => setNewClient({ ...newClient, ein: e.target.value })}
                    placeholder="XX-XXXXXXX"
                  />
                </div>

                {isEntityType && (
                  <>
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium mb-3">Preferred Contact Person</p>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-muted-foreground">Contact Name</label>
                          <Input
                            value={newClient.contact_name}
                            onChange={(e) => setNewClient({ ...newClient, contact_name: e.target.value })}
                            placeholder="Jane Doe"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground">Contact Phone</label>
                            <Input
                              value={newClient.contact_phone}
                              onChange={(e) => setNewClient({ ...newClient, contact_phone: e.target.value })}
                              placeholder="(314) 555-0100"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Contact Email</label>
                            <Input
                              value={newClient.contact_email}
                              onChange={(e) => setNewClient({ ...newClient, contact_email: e.target.value })}
                              placeholder="jane@company.com"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

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
                : "No clients yet. Add your first client or import from CSV."}
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
                          {entityLabels[client.entity_type] ?? client.entity_type}
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
                <Badge variant={client.status === "active" ? "default" : "secondary"}>
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
