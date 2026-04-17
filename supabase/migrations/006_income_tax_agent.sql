-- Income Tax Specialist agent
INSERT INTO agents (slug, name, description, role, config) VALUES
(
  'income-tax-specialist',
  'Income Tax Specialist',
  'Manages the full income tax engagement lifecycle: prepares organizers and information request lists from prior-year data, prepares tax returns using entity-specific skills, reviews staff-prepared returns against agent-prepared returns, flags inconsistencies, manages review comment logs, and coordinates with staff until returns are ready for partner final review.',
  'income_tax',
  '{"capabilities": ["prepare_organizer", "prepare_tax_return", "review_tax_return", "create_review_comment", "update_return_tracker", "check_onedrive_folder", "store_to_onedrive", "send_partner_alert", "create_task", "log_action", "create_excel_file"]}'::jsonb
);

-- Tax return tracker table
CREATE TABLE IF NOT EXISTS tax_return_tracker (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tax_year integer NOT NULL,
  entity_type text NOT NULL,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN (
    'not_started', 'organizer_sent', 'info_gathering', 'in_preparation',
    'under_review', 'review_comments_sent', 'corrections_in_progress',
    'ready_for_partner_review', 'partner_approved', 'filed', 'extended'
  )),
  assigned_staff text,
  preparer_notes text,
  reviewer_notes text,
  due_date date,
  extension_date date,
  filed_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, tax_year)
);

ALTER TABLE tax_return_tracker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage tax_return_tracker"
  ON tax_return_tracker FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_tax_return_tracker_client ON tax_return_tracker(client_id);
CREATE INDEX IF NOT EXISTS idx_tax_return_tracker_status ON tax_return_tracker(status);
CREATE INDEX IF NOT EXISTS idx_tax_return_tracker_due ON tax_return_tracker(due_date);

-- Review comment log table
CREATE TABLE IF NOT EXISTS review_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tax_return_id uuid NOT NULL REFERENCES tax_return_tracker(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  comment_date date NOT NULL DEFAULT CURRENT_DATE,
  category text CHECK (category IN (
    'missing_info', 'inconsistency', 'calculation_error', 'classification_error',
    'disclosure_issue', 'carryforward_mismatch', 'general', 'follow_up'
  )),
  description text NOT NULL,
  line_reference text,
  severity text DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  assigned_to text,
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'deferred')),
  resolution text,
  resolved_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE review_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage review_comments"
  ON review_comments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_review_comments_return ON review_comments(tax_return_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_client ON review_comments(client_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_status ON review_comments(status);
