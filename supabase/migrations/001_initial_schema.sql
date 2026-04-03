-- Evergrow AI Agent Platform - Database Schema
-- Run this in Supabase SQL Editor

-- Partners (extends Supabase auth.users)
CREATE TABLE partners (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'partner'
    CHECK (role IN ('admin', 'partner', 'staff')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agents (the AI "employees")
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  role TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'maintenance')),
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clients (the firm's clients)
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  entity_type TEXT CHECK (entity_type IN (
    'individual', 'sole_prop', 'partnership', 'corporation', 's_corp', 'llc', 'nonprofit'
  )),
  ein TEXT,
  email TEXT,
  phone TEXT,
  address JSONB,
  quickbooks_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'prospect')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client Schedules (payroll, filing deadlines, etc.)
CREATE TABLE client_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN (
    'payroll', 'sales_tax', 'bookkeeping', 'tax_filing'
  )),
  frequency TEXT NOT NULL CHECK (frequency IN (
    'weekly', 'bi_weekly', 'semi_monthly', 'monthly', 'quarterly', 'annually'
  )),
  states TEXT[] DEFAULT '{}',
  next_due_date DATE,
  notes TEXT,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Conversations (chat threads between partner and agent)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  partner_id UUID NOT NULL REFERENCES partners(id),
  client_id UUID REFERENCES clients(id),
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages within a conversation
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_results JSONB,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks / Tickets
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  agent_id UUID REFERENCES agents(id),
  assigned_by UUID NOT NULL REFERENCES partners(id),
  client_id UUID REFERENCES clients(id),
  conversation_id UUID REFERENCES conversations(id),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'review', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Document Tracker
CREATE TABLE document_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  category TEXT CHECK (category IN (
    'tax_return', 'payroll', 'financial_statement', 'receipt',
    'invoice', 'contract', 'correspondence', 'sales_tax', 'other'
  )),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'requested', 'received', 'processed', 'reviewed', 'filed')),
  due_date DATE,
  onedrive_path TEXT,
  tax_year INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit Trail
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id),
  partner_id UUID REFERENCES partners(id),
  client_id UUID REFERENCES clients(id),
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- QuickBooks Connection
CREATE TABLE quickbooks_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  connected_by UUID NOT NULL REFERENCES partners(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_tasks_status ON tasks(status, created_at);
CREATE INDEX idx_tasks_agent ON tasks(agent_id);
CREATE INDEX idx_tasks_client ON tasks(client_id);
CREATE INDEX idx_documents_client ON document_tracker(client_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_agent ON audit_log(agent_id, created_at DESC);
CREATE INDEX idx_conversations_agent ON conversations(agent_id, updated_at DESC);
CREATE INDEX idx_client_schedules_client ON client_schedules(client_id);
CREATE INDEX idx_client_schedules_due ON client_schedules(next_due_date);

-- Enable Row Level Security
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies: all authenticated partners share firm data
CREATE POLICY "partners_all" ON partners FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "agents_all" ON agents FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "clients_all" ON clients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "schedules_all" ON client_schedules FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "conversations_all" ON conversations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "messages_all" ON messages FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "tasks_all" ON tasks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "documents_all" ON document_tracker FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "audit_all" ON audit_log FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "qb_all" ON quickbooks_connections FOR ALL USING (auth.role() = 'authenticated');

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
