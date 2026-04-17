import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// GET all tasks — optionally filtered by agent_id
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agent_id");

  // Try with recurrence join first, fall back without
  let query = supabaseAdmin
    .from("tasks")
    .select("*, agents(name), clients(name), task_recurrences(*)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (agentId) {
    query = query.eq("agent_id", agentId);
  }

  let { data: tasks, error } = await query;

  if (error) {
    // task_recurrences table may not exist — retry without join
    let fallbackQuery = supabaseAdmin
      .from("tasks")
      .select("*, agents(name), clients(name)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (agentId) {
      fallbackQuery = fallbackQuery.eq("agent_id", agentId);
    }

    const fallback = await fallbackQuery;
    if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    tasks = fallback.data;
  }

  return NextResponse.json({ tasks: tasks ?? [] });
}

// POST create a new task
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, description, priority, due_date, agent_id, assigned_by, client_id, recurrence_frequency } = body;

  if (!title || !assigned_by) {
    return NextResponse.json({ error: "Title and assigned_by required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .insert({
      title,
      description: description ?? null,
      priority: priority ?? "medium",
      due_date: due_date ?? null,
      agent_id: agent_id ?? null,
      assigned_by,
      client_id: client_id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If recurring, save recurrence metadata (may fail if table not yet created)
  const freq = recurrence_frequency || body.recurrence?.frequency;
  if (freq && freq !== "none") {
    try {
      await supabaseAdmin
        .from("task_recurrences")
        .insert({
          task_id: data.id,
          frequency: freq,
          agent_id: agent_id ?? null,
          next_run: due_date ?? null,
        });
    } catch {
      // task_recurrences table may not exist yet — task still created
    }
  }

  return NextResponse.json(data);
}
