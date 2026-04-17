"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Activity,
  Settings,
  LogOut,
  Menu,
  X,
  DollarSign,
  BookOpen,
  Receipt,
  FolderOpen,
  FileSpreadsheet,
} from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  section?: string;
};

const agentIcons: Record<string, LucideIcon> = {
  "payroll-manager": DollarSign,
  "bookkeeper": BookOpen,
  "sales-tax-specialist": Receipt,
  "document-manager": FolderOpen,
  "income-tax-specialist": FileSpreadsheet,
};

const topNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

const bottomNavItems: NavItem[] = [
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

type Agent = { slug: string; name: string; status: string };

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    fetch("/api/agents")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setAgents(data.filter((a: Agent) => a.status === "active"));
        else if (data.agents) setAgents(data.agents.filter((a: Agent) => a.status === "active"));
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function renderNavLink(item: NavItem) {
    const isActive =
      pathname === item.href ||
      (item.href !== "/dashboard" && pathname.startsWith(item.href));
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-base transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {item.label}
      </Link>
    );
  }

  const navContent = (
    <>
      <div className="p-6">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Evergrow" width={40} height={40} className="rounded-lg" />
          <div>
            <h1 className="text-lg font-semibold">Evergrow Financials</h1>
            <p className="text-sm text-muted-foreground">Agent Platform</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {topNavItems.map(renderNavLink)}

        {/* Agents section */}
        {agents.length > 0 && (
          <>
            <div className="pt-4 pb-1 px-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                Agents
              </span>
            </div>
            {agents.map((agent) => {
              const Icon = agentIcons[agent.slug] ?? FileSpreadsheet;
              const href = `/agents/${agent.slug}`;
              const isActive = pathname === href || pathname.startsWith(href);
              return (
                <Link
                  key={agent.slug}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-base transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{agent.name}</span>
                </Link>
              );
            })}
          </>
        )}

        {/* Management section */}
        <div className="pt-4 pb-1 px-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            Manage
          </span>
        </div>
        {bottomNavItems.map(renderNavLink)}
      </nav>

      <div className="p-3 border-t">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-base text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-background border-b px-4 h-14">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="Evergrow" width={32} height={32} className="rounded-md" />
          <span className="text-sm font-semibold">Evergrow</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "lg:hidden fixed top-14 left-0 bottom-0 z-40 w-64 bg-background border-r flex flex-col transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r bg-background flex-col h-screen sticky top-0">
        {navContent}
      </aside>
    </>
  );
}
