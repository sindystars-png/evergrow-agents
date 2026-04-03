-- Seed the 4 Phase 1 AI Agents

INSERT INTO agents (slug, name, description, role, config) VALUES
(
  'payroll-manager',
  'Payroll Manager',
  'Supervises payroll staff, manages processing schedules, reviews reports for reasonableness, and ensures timely payroll processing for all clients.',
  'payroll_manager',
  '{"capabilities": ["read_payroll_schedule", "compare_payroll_reports", "check_onedrive_folder", "store_to_onedrive", "send_partner_alert", "create_task", "read_quickbooks_payroll", "log_action"]}'::jsonb
),
(
  'bookkeeper',
  'Bookkeeping Manager',
  'Supervises bookkeeping staff, monitors checklist completion, checks QuickBooks banking connections, reviews financials for reasonableness, and sends status updates to partners.',
  'bookkeeper',
  '{"capabilities": ["read_excel_checklist", "check_quickbooks_status", "check_banking_connections", "compare_financials", "send_partner_alert", "check_onedrive_folder", "create_task", "log_action"]}'::jsonb
),
(
  'sales-tax-specialist',
  'Sales Tax Specialist',
  'Manages sales tax filing schedules, prepares filing summaries, tracks nexus, monitors rates and exemption certificates, and ensures timely submissions.',
  'sales_tax',
  '{"capabilities": ["calculate_sales_tax", "check_nexus", "read_filing_schedule", "compare_filings", "check_onedrive_folder", "store_to_onedrive", "send_partner_alert", "create_task", "log_action"]}'::jsonb
),
(
  'document-manager',
  'Document Manager',
  'Manages client document intake, tracks document requests, enforces OneDrive folder structures, monitors processing status, and alerts on missing documents.',
  'document_manager',
  '{"capabilities": ["scan_onedrive_folder", "create_onedrive_folder", "move_onedrive_file", "generate_document_request", "track_document_status", "send_client_reminder", "send_partner_alert", "create_task", "log_action"]}'::jsonb
);
