-- Microsoft OneDrive connections (stores OAuth tokens per partner)
CREATE TABLE IF NOT EXISTS microsoft_connections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz NOT NULL,
  microsoft_email text,
  microsoft_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(partner_id)
);

ALTER TABLE microsoft_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage microsoft_connections"
  ON microsoft_connections FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
