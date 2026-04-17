-- Recurring task definitions
CREATE TABLE IF NOT EXISTS task_recurrences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'bi_weekly', 'monthly', 'quarterly')),
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  next_run date,
  last_run timestamptz,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE task_recurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage task_recurrences"
  ON task_recurrences FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
