/**
 * Cron Status — check recurring tasks and their schedule
 * GET /api/cron/status
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Get all active recurrences with their task info
    const { data: recurrences, error } = await supabaseAdmin
      .from("task_recurrences")
      .select("*, tasks(id, title, status, agent_id, agents(name))")
      .eq("active", true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get recent executions
    const { data: recentExecs } = await supabaseAdmin
      .from("task_executions")
      .select("id, task_id, status, trigger_type, completed_at, tasks(title)")
      .eq("trigger_type", "cron")
      .order("completed_at", { ascending: false })
      .limit(10);

    const schedule = (recurrences ?? []).map((r) => {
      const task = r.tasks as { id: string; title: string; status: string; agents: { name: string } | null } | null;
      const isDue = r.next_run && r.next_run <= today;
      return {
        recurrence_id: r.id,
        task_title: task?.title ?? "Unknown",
        agent: (task?.agents as { name: string } | null)?.name ?? "Unknown",
        frequency: r.frequency,
        next_run: r.next_run,
        is_due: isDue,
        task_status: task?.status ?? "unknown",
      };
    });

    return NextResponse.json({
      today,
      server_time: new Date().toISOString(),
      active_recurring_tasks: schedule.length,
      due_now: schedule.filter((s) => s.is_due).length,
      schedule,
      recent_cron_executions: (recentExecs ?? []).map((e) => ({
        task: (e.tasks as unknown as { title: string } | null)?.title ?? "Unknown",
        status: e.status,
        completed: e.completed_at,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
