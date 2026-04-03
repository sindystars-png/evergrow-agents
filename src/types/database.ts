export type Partner = {
  id: string;
  full_name: string;
  role: "admin" | "partner" | "staff";
  avatar_url: string | null;
  created_at: string;
};

export type Agent = {
  id: string;
  slug: string;
  name: string;
  description: string;
  role: string;
  avatar_url: string | null;
  status: "active" | "paused" | "maintenance";
  config: {
    capabilities?: string[];
    [key: string]: unknown;
  };
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  name: string;
  entity_type:
    | "individual"
    | "sole_prop"
    | "partnership"
    | "corporation"
    | "s_corp"
    | "llc"
    | "nonprofit"
    | null;
  ein: string | null;
  email: string | null;
  phone: string | null;
  address: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  } | null;
  quickbooks_id: string | null;
  status: "active" | "inactive" | "prospect";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientSchedule = {
  id: string;
  client_id: string;
  schedule_type: "payroll" | "sales_tax" | "bookkeeping" | "tax_filing";
  frequency:
    | "weekly"
    | "bi_weekly"
    | "semi_monthly"
    | "monthly"
    | "quarterly"
    | "annually";
  states: string[];
  next_due_date: string | null;
  notes: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Conversation = {
  id: string;
  agent_id: string;
  partner_id: string;
  client_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tool_calls: unknown[] | null;
  tool_results: unknown[] | null;
  tokens_used: number | null;
  created_at: string;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  agent_id: string | null;
  assigned_by: string;
  client_id: string | null;
  conversation_id: string | null;
  status: "open" | "in_progress" | "review" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentTracker = {
  id: string;
  client_id: string;
  document_name: string;
  category:
    | "tax_return"
    | "payroll"
    | "financial_statement"
    | "receipt"
    | "invoice"
    | "contract"
    | "correspondence"
    | "sales_tax"
    | "other"
    | null;
  status:
    | "pending"
    | "requested"
    | "received"
    | "processed"
    | "reviewed"
    | "filed";
  due_date: string | null;
  onedrive_path: string | null;
  tax_year: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditLog = {
  id: string;
  agent_id: string | null;
  partner_id: string | null;
  client_id: string | null;
  action: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
};
