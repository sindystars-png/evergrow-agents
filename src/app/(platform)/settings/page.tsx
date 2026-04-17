"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Users, Link2, Database, CheckCircle2, AlertCircle } from "lucide-react";
import type { Partner } from "@/types/database";

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [onedriveConnected, setOnedriveConnected] = useState(false);
  const [onedriveEmail, setOnedriveEmail] = useState<string | null>(null);
  const supabase = createClient();
  const searchParams = useSearchParams();

  const loadPartners = useCallback(async () => {
    const { data } = await supabase
      .from("partners")
      .select("*")
      .order("created_at");
    setPartners(data ?? []);
  }, [supabase]);

  const checkOneDrive = useCallback(async () => {
    try {
      const res = await fetch("/api/microsoft/status");
      const data = await res.json();
      if (data.connected) {
        setOnedriveConnected(true);
        setOnedriveEmail(data.email ?? null);
      }
    } catch {
      // Non-critical — just means we can't check status
    }
  }, []);

  useEffect(() => {
    loadPartners();
    checkOneDrive();
  }, [loadPartners, checkOneDrive]);

  const oauthSuccess = searchParams.get("success");
  const oauthError = searchParams.get("error");

  async function handleInvite() {
    if (!newEmail || !newName) return;
    setInviting(true);
    setMessage("");
    setMessageType("success");
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, full_name: newName, role: "partner" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessageType("error");
        setMessage(data.error ?? "Failed to send invitation");
      } else {
        setMessageType("success");
        setMessage(data.message ?? "Invitation sent!");
        setNewEmail("");
        setNewName("");
        loadPartners();
      }
    } catch {
      setMessageType("error");
      setMessage("Failed to send invitation. Please try again.");
    } finally {
      setInviting(false);
    }
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
              <p className={`text-sm p-3 rounded-lg ${
                messageType === "error"
                  ? "text-red-800 bg-red-50 border border-red-200"
                  : "text-green-800 bg-green-50 border border-green-200"
              }`}>
                {message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status Messages */}
      {oauthSuccess === "onedrive_connected" && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          <CheckCircle2 className="h-4 w-4" />
          Microsoft 365 connected successfully! Your agents can now access OneDrive files and the Outlook mailbox.
        </div>
      )}
      {oauthError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          <AlertCircle className="h-4 w-4" />
          OneDrive connection failed: {oauthError.replace(/_/g, " ")}. Please try again.
        </div>
      )}

      {/* Integrations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5" />
            Integrations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* QuickBooks */}
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

          {/* OneDrive */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">
                OD
              </div>
              <div>
                <p className="text-sm font-medium">Microsoft 365</p>
                <p className="text-xs text-muted-foreground">
                  {onedriveConnected
                    ? `Connected as ${onedriveEmail ?? "Microsoft account"} — OneDrive + Outlook`
                    : "Connect for OneDrive files and Outlook email triage"}
                </p>
              </div>
            </div>
            {onedriveConnected ? (
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    window.location.href = "/api/microsoft/connect";
                  }}
                >
                  Reconnect
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.href = "/api/microsoft/connect";
                }}
              >
                Connect Microsoft 365
              </Button>
            )}
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
