/**
 * Cron Job: Execute Due Tasks
 *
 * Runs on a schedule (daily at 8 AM CT) via Vercel Cron.
 * Finds all tasks that are due today or overdue and executes them.
 *
 * Also handles recurring tasks: after completing a recurring task,
 * it creates the next occurrence.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { executeTask } from "@/lib/ai/task-executor";

// No timeout limit on Render (persistent server)

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  try {
    // Find tasks that are due today or overdue, with status "open"
    const { data: dueTasks, error } = await supabaseAdmin
      .from("tasks")
      .select("id, title, agent_id, due_date, status, priority")
      .in("status", ["open"])
      .not("agent_id", "is", null)
      .lte("due_date", today)
      .order("priority", { ascending: true }) // urgent first (alphabetical: high, low, medium, urgent — we'll sort properly)
      .limit(20); // Process max 20 tasks per run to stay within limits

    if (error) {
      console.error("Error fetching due tasks:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!dueTasks || dueTasks.length === 0) {
      return NextResponse.json({
        message: "No tasks due",
        date: today,
        executed: 0,
      });
    }

    // Sort by priority: urgent > high > medium > low
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    dueTasks.sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));

    // Execute each task
    const results = [];
    for (const task of dueTasks) {
      try {
        console.log(`Executing task: ${task.title} (${task.id})`);
        const result = await executeTask(task.id, "cron");
        results.push({
          taskId: task.id,
          title: task.title,
          status: result.status,
          toolsUsed: result.toolCalls.length,
        });

        // Handle recurring task — create next occurrence
        await handleRecurrence(task.id);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Failed to execute task ${task.id}:`, errMsg);
        results.push({
          taskId: task.id,
          title: task.title,
          status: "failed",
          error: errMsg,
        });
      }
    }

    return NextResponse.json({
      message: `Executed ${results.length} task(s)`,
      date: today,
      executed: results.length,
      results,
    });
  } catch (error) {
    console.error("Cron execute-tasks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * After a recurring task completes, create the next occurrence
 */
async function handleRecurrence(taskId: string) {
  // Check if this task has an active recurrence
  const { data: recurrence } = await supabaseAdmin
    .from("task_recurrences")
    .select("*")
    .eq("task_id", taskId)
    .eq("active", true)
    .limit(1)
    .single();

  if (!recurrence) return; // Not recurring or paused

  // Load the original task to clone it
  const { data: originalTask } = await supabaseAdmin
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (!originalTask) return;

  // Calculate next due date
  const nextDue = calculateNextDueDate(
    originalTask.due_date ?? new Date().toISOString().split("T")[0],
    recurrence.frequency
  );

  // Create the next task occurrence
  const { data: newTask } = await supabaseAdmin
    .from("tasks")
    .insert({
      title: originalTask.title,
      description: originalTask.description,
      priority: originalTask.priority,
      agent_id: originalTask.agent_id,
      assigned_by: originalTask.assigned_by,
      client_id: originalTask.client_id,
      due_date: nextDue,
      status: "open",
    })
    .select()
    .single();

  if (newTask) {
    // Create recurrence record for the new task
    await supabaseAdmin.from("task_recurrences").insert({
      task_id: newTask.id,
      frequency: recurrence.frequency,
      agent_id: originalTask.agent_id,
      active: true,
      next_run: nextDue,
    });

    // Update old recurrence's next_run
    await supabaseAdmin
      .from("task_recurrences")
      .update({ next_run: nextDue })
      .eq("id", recurrence.id);
  }
}

function calculateNextDueDate(currentDue: string, frequency: string): string {
  const date = new Date(currentDue + "T12:00:00Z"); // Noon to avoid timezone issues

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
      date.setDate(date.getDate() + 7); // Default weekly
  }

  return date.toISOString().split("T")[0];
}
