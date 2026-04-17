-- Add contact fields for entity clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- Recurring services provided to each client
CREATE TABLE IF NOT EXISTS client_services (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_type text NOT NULL CHECK (service_type IN (
    'yearend_tax', 'bookkeeping', 'sales_tax', 'payroll', 'property_tax'
  )),
  frequency text CHECK (frequency IN (
    'weekly', 'bi_weekly', 'semi_monthly', 'monthly', 'quarterly', 'annually'
  )),
  notes text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, service_type)
);

ALTER TABLE client_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage client_services"
  ON client_services FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_client_services_client ON client_services(client_id);
