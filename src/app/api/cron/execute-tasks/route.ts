/**
 * Cron Job: Execute Due Tasks + Recurring Tasks
 *
 * Runs on schedule via node-cron (daily 8 AM CT + every 15 min sweep).
 *
 * Two-phase approach:
 * 1. Execute any one-off tasks that are due/overdue (status = "open")
 * 2. Execute any active recurring tasks that are due (checks task_recurrences directly)
 *
 * Phase 2 is the key improvement: instead of creating a chain of cloned tasks
 * (which breaks if any link fails), we directly check task_recurrences and
 * re-run the original task template each time it's due.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { executeTask } from "@/lib/ai/task-executor";

// No timeout limit on Render (persistent server)

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const results: { taskId: string; title: string; status: string; type: string; error?: string }[] = [];

  try {
    // ═══════════════════════════════════════════════════
    // Phase 1: Execute one-off tasks that are due/overdue
    // ═══════════════════════════════════════════════════
    const { data: dueTasks, error: dueErr } = await supabaseAdmin
      .from("tasks")
      .select("id, title, agent_id, due_date, status, priority")
      .in("status", ["open"])
      .not("agent_id", "is", null)
      .lte("due_date", today)
      .order("priority", { ascending: true })
      .limit(20);

    if (dueErr) {
      console.error("[CRON] Error fetching due tasks:", dueErr.message);
    }

    if (dueTasks && dueTasks.length > 0) {
      // Sort by priority: urgent > high > medium > low
      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      dueTasks.sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));

      for (const task of dueTasks) {
        try {
          console.log(`[CRON] Executing one-off task: ${task.title} (${task.id})`);
          const result = await executeTask(task.id, "cron");
          results.push({ taskId: task.id, title: task.title, status: result.status, type: "one-off" });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          console.error(`[CRON] Failed task ${task.id}:`, errMsg);
          results.push({ taskId: task.id, title: task.title, status: "failed", type: "one-off", error: errMsg });
        }
      }
    }

    // ═══════════════════════════════════════════════════
    // Phase 2: Execute active recurring tasks
    // ═══════════════════════════════════════════════════
    const { data: recurrences, error: recErr } = await supabaseAdmin
      .from("task_recurrences")
      .select("*, tasks(id, title, description, priority, agent_id, assigned_by, client_id, status)")
      .eq("active", true)
      .lte("next_run", today);

    if (recErr) {
      console.error("[CRON] Error fetching recurrences:", recErr.message);
    }

    if (recurrences && recurrences.length > 0) {
      for (const rec of recurrences) {
        const task = rec.tasks as {
          id: string; title: string; description: string | null;
          priority: string; agent_id: string | null; assigned_by: string;
          client_id: string | null; status: string;
        } | null;

        if (!task || !task.agent_id) {
          console.log(`[CRON] Skipping recurrence ${rec.id} — no valid task/agent`);
          continue;
        }

        // Skip if this exact task was already executed in Phase 1
        if (results.some((r) => r.taskId === task.id)) {
          console.log(`[CRON] Skipping ${task.title} — already executed in Phase 1`);
          // Still advance the next_run date
          const nextDue = calculateNextDueDate(today, rec.frequency);
          await supabaseAdmin
            .from("task_recurrences")
            .update({ next_run: nextDue })
            .eq("id", rec.id);
          continue;
        }

        try {
          // If the linked task is already completed/review, create a fresh "open" task
          let taskIdToExecute = task.id;

          if (task.status !== "open") {
            console.log(`[CRON] Creating fresh task for recurring: ${task.title}`);
            const { data: newTask } = await supabaseAdmin
              .from("tasks")
              .insert({
                title: task.title,
                description: task.description,
                priority: task.priority,
                agent_id: task.agent_id,
                assigned_by: task.assigned_by,
                client_id: task.client_id,
                due_date: today,
                status: "open",
              })
              .select()
              .single();

            if (!newTask) {
              console.error(`[CRON] Failed to create fresh task for ${task.title}`);
              continue;
            }
            taskIdToExecute = newTask.id;
          }

          console.log(`[CRON] Executing recurring task: ${task.title} (${taskIdToExecute})`);
          const result = await executeTask(taskIdToExecute, "cron");
          results.push({ taskId: taskIdToExecute, title: task.title, status: result.status, type: "recurring" });

          // Advance next_run to the next scheduled date
          const nextDue = calculateNextDueDate(today, rec.frequency);
          await supabaseAdmin
            .from("task_recurrences")
            .update({ next_run: nextDue })
            .eq("id", rec.id);

          console.log(`[CRON] Next run for "${task.title}": ${nextDue}`);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          console.error(`[CRON] Failed recurring task ${task.id}:`, errMsg);
          results.push({ taskId: task.id, title: task.title, status: "failed", type: "recurring", error: errMsg });

          // Still advance next_run so we don't get stuck retrying a broken task forever
          const nextDue = calculateNextDueDate(today, rec.frequency);
          await supabaseAdmin
            .from("task_recurrences")
            .update({ next_run: nextDue })
            .eq("id", rec.id);
        }
      }
    }

    console.log(`[CRON] ${new Date().toISOString()} — Completed. Executed ${results.length} task(s).`);

    return NextResponse.json({
      message: `Executed ${results.length} task(s)`,
      date: today,
      executed: results.length,
      results,
    });
  } catch (error) {
    console.error("[CRON] Fatal error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function calculateNextDueDate(currentDue: string, frequency: string): string {
  const date = new Date(currentDue + "T12:00:00Z");

  switch (frequency) {
    case "daily":
      date.setDate(date.getDate() + 1);
      break;
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "bi_weekly":
      date.setDate(date.getDate() + 14);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    case "quarterly":
      date.setMonth(date.getMonth() + 3);
      break;
    default:
      date.setDate(date.getDate() + 7);
  }

  return date.toISOString().split("T")[0];
}
