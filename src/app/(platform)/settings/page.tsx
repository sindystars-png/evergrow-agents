"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Users, Link2, Database } from "lucide-react";
import type { Partner } from "@/types/database";

export default function SettingsPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState("");
  const supabase = createClient();

  const loadPartners = useCallback(async () => {
    const { data } = await supabase
      .from("partners")
      .select("*")
      .order("created_at");
    setPartners(data ?? []);
  }, [supabase]);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  async function handleInvite() {
    if (!newEmail || !newName) return;
    setInviting(true);
    setMessage("");

    // Note: In production, you'd use Supabase admin API to invite the user
    // For now, we show the flow
    setMessage(
      `To add ${newName}, create their account in the Supabase dashboard (Authentication > Users > Add User) with email: ${newEmail}. They will receive a confirmation email.`
    );
    setInviting(false);
    setNewEmail("");
    setNewName("");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage partners, integrations, and platform settings
        </p>
      </div>

      {/* Partners */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Partners & Staff
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {partners.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between py-2 border-b last:border-0"
            >
              <div>
                <p className="text-sm font-medium">{p.full_name}</p>
              </div>
              <Badge variant="outline">{p.role}</Badge>
            </div>
          ))}

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-medium">Invite New Partner</p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Full name"
              />
              <Input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Email address"
                type="email"
              />
            </div>
            <Button onClick={handleInvite} disabled={inviting} size="sm">
              Send Invite
            </Button>
            {message && (
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                {message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5" />
            Integrations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm font-medium">QuickBooks Online</p>
                <p className="text-xs text-muted-foreground">
                  Connect to sync bookkeeping and payroll data
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" disabled>
              Connect (Coming Soon)
            </Button>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">
                OD
              </div>
              <div>
                <p className="text-sm font-medium">Microsoft OneDrive</p>
                <p className="text-xs text-muted-foreground">
                  Connect for document management and file storage
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" disabled>
              Connect (Coming Soon)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Platform Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Platform</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Version</p>
              <p className="font-medium">1.0.0</p>
            </div>
            <div>
              <p className="text-muted-foreground">AI Model</p>
              <p className="font-medium">Claude Sonnet 4</p>
            </div>
            <div>
              <p className="text-muted-foreground">Active Agents</p>
              <p className="font-medium">4</p>
            </div>
            <div>
              <p className="text-muted-foreground">Firm</p>
              <p className="font-medium">Evergrow Financials</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
