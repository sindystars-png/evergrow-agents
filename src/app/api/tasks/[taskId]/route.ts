import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// PATCH update a task
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const body = await request.json();

  // Only allow updating these fields
  const allowed: Record<string, unknown> = {};
  if (body.title !== undefined) allowed.title = body.title;
  if (body.description !== undefined) allowed.description = body.description;
  if (body.priority !== undefined) allowed.priority = body.priority;
  if (body.due_date !== undefined) allowed.due_date = body.due_date || null;
  if (body.status !== undefined) {
    allowed.status = body.status;
    if (body.status === "completed") {
      allowed.completed_at = new Date().toISOString();
    }
  }
  allowed.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .update(allowed)
    .eq("id", taskId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Handle recurrence updates
  if (body.recurrence_frequency !== undefined || body.recurrence_active !== undefined) {
    // Check if a recurrence record exists
    const { data: existing } = await supabaseAdmin
      .from("task_recurrences")
      .select("id")
      .eq("task_id", taskId)
      .limit(1)
      .single();

    if (existing) {
      const recUpdates: Record<string, unknown> = {};
      if (body.recurrence_frequency !== undefined) recUpdates.frequency = body.recurrence_frequency;
      if (body.recurrence_active !== undefined) recUpdates.active = body.recurrence_active;

      await supabaseAdmin
        .from("task_recurrences")
        .update(recUpdates)
        .eq("task_id", taskId);
    } else if (body.recurrence_frequency && body.recurrence_frequency !== "none") {
      // Create new recurrence record
      await supabaseAdmin
        .from("task_recurrences")
        .insert({
          task_id: taskId,
          frequency: body.recurrence_frequency,
          agent_id: data.agent_id ?? null,
          active: body.recurrence_active ?? true,
          next_run: data.due_date ?? null,
        });
    }
  }

  // Return task with recurrence data
  const { data: fullTask } = await supabaseAdmin
    .from("tasks")
    .select("*, task_recurrences(*), clients(name)")
    .eq("id", taskId)
    .single();

  return NextResponse.json(fullTask ?? data);
}

// DELETE a task
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  const { error } = await supabaseAdmin
    .from("tasks")
    .delete()
    .eq("id", taskId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
