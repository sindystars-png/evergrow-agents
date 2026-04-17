import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  scanClientFolder,
  scanSubfolder,
  createClientFolders,
  searchFiles,
  listFolder,
  buildClientPath,
  isConnected,
  uploadFile,
  downloadFile,
  FOLDER_STRUCTURE,
} from "@/lib/microsoft/graph-client";
import ExcelJS from "exceljs";

// Shared tools available to all agents
const createTaskTool: Tool = {
  name: "create_task",
  description:
    "Create a task/ticket to track a work item. Use this when you identify something that needs follow-up.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: {
        type: "string",
        description: "Short title for the task",
      },
      description: {
        type: "string",
        description: "Detailed description of what needs to be done",
      },
      priority: {
        type: "string",
        enum: ["low", "medium", "high", "urgent"],
        description: "Task priority level",
      },
      due_date: {
        type: "string",
        description: "Due date in YYYY-MM-DD format",
      },
    },
    required: ["title"],
  },
};

const logActionTool: Tool = {
  name: "log_action",
  description:
    "Log a significant action to the audit trail for compliance and record-keeping.",
  input_schema: {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        description:
          "Short action identifier (e.g., 'reviewed_payroll', 'checked_banking_connections')",
      },
      description: {
        type: "string",
        description: "Detailed description of what was done and any findings",
      },
    },
    required: ["action", "description"],
  },
};

const sendPartnerAlertTool: Tool = {
  name: "send_partner_alert",
  description:
    "Send an alert/notification to a partner about an important finding or deadline.",
  input_schema: {
    type: "object" as const,
    properties: {
      alert_type: {
        type: "string",
        enum: ["deadline", "overdue", "issue", "update", "urgent"],
        description: "Type of alert",
      },
      message: {
        type: "string",
        description: "The alert message to send",
      },
    },
    required: ["alert_type", "message"],
  },
};

// OneDrive tools available to all agents
const checkOnedriveFolderTool: Tool = {
  name: "check_onedrive_folder",
  description:
    "Check a client's OneDrive folder for files and subfolders. Scans the folder structure to verify organization and find files. Folder structure: Clients-Business/{ClientName}/{Year}/{Bookkeeping|Payroll|Sales|Year End Tax}/",
  input_schema: {
    type: "object" as const,
    properties: {
      client_name: {
        type: "string",
        description: "Client's name as it appears in OneDrive folder names",
      },
      client_type: {
        type: "string",
        enum: ["business", "individual"],
        description: "Whether client is business or individual",
      },
      year: {
        type: "number",
        description: "Year folder to check (default: current year)",
      },
      subfolder: {
        type: "string",
        enum: ["Bookkeeping", "Payroll", "Sales", "Year End Tax"],
        description: "Specific subfolder to check (optional — omit to see all)",
      },
    },
    required: ["client_name", "client_type"],
  },
};

const searchOnedriveTool: Tool = {
  name: "search_onedrive",
  description:
    "Search for files in OneDrive by name or keyword. Searches across the client file structure.",
  input_schema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "Search query (file name, keyword, etc.)",
      },
      client_name: {
        type: "string",
        description: "Limit search to a specific client folder (optional)",
      },
      client_type: {
        type: "string",
        enum: ["business", "individual"],
        description: "Client type if client_name is provided",
      },
    },
    required: ["query"],
  },
};

const createOnedriveFoldersTool: Tool = {
  name: "create_onedrive_folders",
  description:
    "Create the standard folder structure for a new client on OneDrive: {Year}/Bookkeeping, Payroll, Sales, Year End Tax",
  input_schema: {
    type: "object" as const,
    properties: {
      client_name: {
        type: "string",
        description: "Client name for the folder",
      },
      client_type: {
        type: "string",
        enum: ["business", "individual"],
        description: "Whether this is a business or individual client",
      },
      year: {
        type: "number",
        description: "Year to create folders for (default: current year)",
      },
    },
    required: ["client_name", "client_type"],
  },
};

const listOnedriveFolderTool: Tool = {
  name: "list_onedrive_folder",
  description:
    "List the contents of any OneDrive folder by path. IMPORTANT: All paths MUST start with 'Emily - Evergrow Financials/' prefix.",
  input_schema: {
    type: "object" as const,
    properties: {
      folder_path: {
        type: "string",
        description: "Full folder path. MUST start with 'Emily - Evergrow Financials/'. Example: 'Emily - Evergrow Financials/Clients-Business/ABC Corp/2025/Payroll'",
      },
    },
    required: ["folder_path"],
  },
};

const createExcelTool: Tool = {
  name: "create_excel_file",
  description:
    "Create an Excel spreadsheet and upload it to the client's OneDrive folder. Use this for PBC lists, document checklists, summaries, or any structured data that should be saved as a spreadsheet. IMPORTANT: folder_path MUST start with 'Emily - Evergrow Financials/' prefix.",
  input_schema: {
    type: "object" as const,
    properties: {
      file_name: {
        type: "string",
        description: "Name for the Excel file (e.g., 'PBC_List_2025.xlsx'). Must end in .xlsx",
      },
      folder_path: {
        type: "string",
        description: "Full OneDrive folder path. MUST start with 'Emily - Evergrow Financials/'. Example: 'Emily - Evergrow Financials/Clients-Individual/Zeng, Qi/2025'",
      },
      sheet_name: {
        type: "string",
        description: "Name for the worksheet tab (default: 'Sheet1')",
      },
      headers: {
        type: "array",
        items: { type: "string" },
        description: "Column headers for the spreadsheet",
      },
      rows: {
        type: "array",
        items: {
          type: "array",
          items: { type: "string" },
        },
        description: "Array of rows, each row is an array of cell values matching the headers",
      },
    },
    required: ["file_name", "folder_path", "headers", "rows"],
  },
};

// Income Tax specific tools
const prepareOrganizerTool: Tool = {
  name: "prepare_organizer",
  description:
    "Generate a tax organizer and information request list based on the client's entity type and prior-year return. Creates a comprehensive, client-specific checklist of all documents and information needed for the current tax year.",
  input_schema: {
    type: "object" as const,
    properties: {
      client_id: { type: "string", description: "Client ID" },
      entity_type: {
        type: "string",
        enum: ["individual", "s_corp", "partnership", "corporation", "nonprofit", "trust"],
        description: "Entity type for the tax return",
      },
      tax_year: { type: "number", description: "Tax year to prepare organizer for" },
      prior_year_items: {
        type: "array",
        items: { type: "string" },
        description: "Key items from prior year return to include (e.g., 'Schedule C - consulting', 'Rental property on Schedule E', 'K-1 from XYZ Partnership')",
      },
    },
    required: ["client_id", "entity_type", "tax_year"],
  },
};

const prepareTaxReturnTool: Tool = {
  name: "prepare_tax_return",
  description:
    "Prepare a tax return workpaper for a client based on entity type. Generates the key schedules and calculations based on provided financial data. Saves workpapers to OneDrive.",
  input_schema: {
    type: "object" as const,
    properties: {
      client_id: { type: "string", description: "Client ID" },
      entity_type: {
        type: "string",
        enum: ["individual", "s_corp", "partnership", "corporation", "nonprofit", "trust"],
        description: "Entity type for the tax return",
      },
      tax_year: { type: "number", description: "Tax year" },
      financial_data: {
        type: "object",
        description: "Key financial data: revenue, expenses, assets, etc. Structure depends on entity type.",
      },
    },
    required: ["client_id", "entity_type", "tax_year"],
  },
};

const reviewTaxReturnTool: Tool = {
  name: "review_tax_return",
  description:
    "Review a staff-prepared tax return by comparing it line-by-line to the agent-prepared version. Flags inconsistencies, missing items, calculation errors, and classification issues. Returns a detailed review report.",
  input_schema: {
    type: "object" as const,
    properties: {
      client_id: { type: "string", description: "Client ID" },
      tax_year: { type: "number", description: "Tax year" },
      entity_type: {
        type: "string",
        enum: ["individual", "s_corp", "partnership", "corporation", "nonprofit", "trust"],
        description: "Entity type",
      },
      staff_return_data: {
        type: "object",
        description: "Key line items from the staff-prepared return for comparison",
      },
      agent_return_data: {
        type: "object",
        description: "Key line items from the agent-prepared return for comparison",
      },
    },
    required: ["client_id", "tax_year", "entity_type"],
  },
};

const createReviewCommentTool: Tool = {
  name: "create_review_comment",
  description:
    "Create a review comment for a tax return. Each comment includes a category, description, line reference, severity, and staff assignment. Comments are tracked until resolved.",
  input_schema: {
    type: "object" as const,
    properties: {
      client_id: { type: "string", description: "Client ID" },
      tax_year: { type: "number", description: "Tax year" },
      category: {
        type: "string",
        enum: ["missing_info", "inconsistency", "calculation_error", "classification_error", "disclosure_issue", "carryforward_mismatch", "general", "follow_up"],
        description: "Category of the review comment",
      },
      description: { type: "string", description: "Detailed description of the issue found" },
      line_reference: { type: "string", description: "Tax form line reference (e.g., 'Form 1040 Line 12', 'Schedule C Line 31')" },
      severity: {
        type: "string",
        enum: ["low", "medium", "high", "critical"],
        description: "Severity of the issue",
      },
      assigned_to: { type: "string", description: "Name of the staff member to review this comment" },
    },
    required: ["client_id", "tax_year", "category", "description"],
  },
};

const updateReturnTrackerTool: Tool = {
  name: "update_return_tracker",
  description:
    "Update the income tax return tracker status for a client. Tracks the return through the full pipeline from Not Started to Filed. Use this to advance the return status or check current status of all returns.",
  input_schema: {
    type: "object" as const,
    properties: {
      client_id: { type: "string", description: "Client UUID or client name (e.g., 'Zeng, Qi'). If a name is provided, it will be resolved to the UUID automatically. Omit to list all returns." },
      tax_year: { type: "number", description: "Tax year" },
      new_status: {
        type: "string",
        enum: [
          "not_started", "organizer_sent", "info_gathering", "in_preparation",
          "under_review", "review_comments_sent", "corrections_in_progress",
          "ready_for_partner_review", "partner_approved", "filed", "extended",
        ],
        description: "New status for the return",
      },
      assigned_staff: { type: "string", description: "Staff member assigned to prepare the return" },
      notes: { type: "string", description: "Additional notes about the status change" },
    },
    required: [],
  },
};

const getReviewCommentsTool: Tool = {
  name: "get_review_comments",
  description:
    "Get all review comments for a tax return, optionally filtered by status. Returns the full comment log with dates, categories, and resolution status.",
  input_schema: {
    type: "object" as const,
    properties: {
      client_id: { type: "string", description: "Client ID" },
      tax_year: { type: "number", description: "Tax year" },
      status_filter: {
        type: "string",
        enum: ["open", "in_progress", "resolved", "deferred"],
        description: "Filter by comment status (omit for all)",
      },
    },
    required: ["client_id"],
  },
};

// ============================================================
// Generic Skill Tools — work with ANY skill, no hard-coding
// ============================================================

const copySkillTemplateTool: Tool = {
  name: "copy_skill_template",
  description:
    "Copy a skill's template file to a client's OneDrive folder. This creates a fresh copy of the template (e.g., a 1040 workbook with formulas) in the specified destination. Use this at the start of any skill workflow that requires a template file.",
  input_schema: {
    type: "object" as const,
    properties: {
      skill_name: { type: "string", description: "Name of the skill (e.g., '1040-tax-return')" },
      template_file: { type: "string", description: "Template filename (e.g., '1040_Template_2025.xlsx')" },
      destination_folder: { type: "string", description: "OneDrive folder path to copy to" },
      destination_filename: { type: "string", description: "Name for the copied file (e.g., 'Zeng_Qi_2025_1040_Workbook.xlsx')" },
    },
    required: ["skill_name", "template_file", "destination_folder", "destination_filename"],
  },
};

const downloadExcelTool: Tool = {
  name: "download_excel",
  description:
    "Download an Excel workbook from OneDrive and return information about its structure (sheet names, dimensions). Use this before read_excel_cells or write_excel_cells.",
  input_schema: {
    type: "object" as const,
    properties: {
      file_path: { type: "string", description: "OneDrive path to the Excel file" },
    },
    required: ["file_path"],
  },
};

const readExcelCellsTool: Tool = {
  name: "read_excel_cells",
  description:
    "Read specific cells or ranges from an Excel workbook on OneDrive. Returns the values at the specified locations. Use this to verify data in a workbook or read calculated values from formula cells.",
  input_schema: {
    type: "object" as const,
    properties: {
      file_path: { type: "string", description: "OneDrive path to the Excel file" },
      sheet_name: { type: "string", description: "Name of the worksheet tab to read from" },
      cells: {
        type: "array",
        items: { type: "string" },
        description: "Array of cell references like ['C6', 'D52', 'C116'] or ranges like ['B52:I56', 'C200:C214']",
      },
    },
    required: ["file_path", "sheet_name", "cells"],
  },
};

const writeExcelCellsTool: Tool = {
  name: "write_excel_cells",
  description:
    "Write values to specific cells in an Excel workbook on OneDrive. Downloads the file, writes the values, and re-uploads. Use this to populate data into workbook templates. Provide cell addresses and values as key-value pairs. IMPORTANT: Do NOT write to formula cells or total rows — only write to data cells.",
  input_schema: {
    type: "object" as const,
    properties: {
      file_path: { type: "string", description: "OneDrive path to the Excel file" },
      sheet_name: { type: "string", description: "Name of the worksheet tab to write to" },
      cells: {
        type: "object",
        description: "Object mapping cell addresses to values, e.g., {\"C6\": 2, \"C14\": \"John\", \"D52\": 85000}. Use column letters and row numbers (e.g., C14 = column C, row 14).",
        additionalProperties: true,
      },
    },
    required: ["file_path", "sheet_name", "cells"],
  },
};

const readClientDocumentsTool: Tool = {
  name: "read_client_documents",
  description:
    "Scan a client's OneDrive folder for documents. Returns the file list with detected document types (W-2, 1099, K-1, etc.). Use this as the first step in any document ingestion workflow.",
  input_schema: {
    type: "object" as const,
    properties: {
      client_name: { type: "string", description: "Client name as in OneDrive" },
      client_type: {
        type: "string",
        enum: ["business", "individual"],
        description: "Client type",
      },
      year: { type: "number", description: "Year folder to scan" },
      subfolder: { type: "string", description: "Specific subfolder (e.g., 'Year End Tax')" },
    },
    required: ["client_name", "client_type", "year"],
  },
};

// Agent-specific tools
const toolsByRole: Record<string, Tool[]> = {
  income_tax: [
    prepareOrganizerTool,
    prepareTaxReturnTool,
    reviewTaxReturnTool,
    createReviewCommentTool,
    updateReturnTrackerTool,
    getReviewCommentsTool,
    // Generic skill tools — work with any skill's templates and workbooks
    copySkillTemplateTool,
    downloadExcelTool,
    readExcelCellsTool,
    writeExcelCellsTool,
    readClientDocumentsTool,
  ],
  payroll_manager: [
    {
      name: "read_payroll_schedule",
      description:
        "Read the payroll processing schedule for a client or all clients. Returns upcoming deadlines and processing status.",
      input_schema: {
        type: "object" as const,
        properties: {
          client_id: {
            type: "string",
            description: "Specific client ID, or omit for all clients",
          },
          days_ahead: {
            type: "number",
            description:
              "Number of days ahead to look (default 14)",
          },
        },
        required: [],
      },
    },
    {
      name: "compare_payroll_reports",
      description:
        "Compare current payroll to prior period. Flags variances in headcount, gross pay, deductions, and net pay.",
      input_schema: {
        type: "object" as const,
        properties: {
          client_id: {
            type: "string",
            description: "Client ID to compare",
          },
          current_period: {
            type: "string",
            description: "Current pay period end date (YYYY-MM-DD)",
          },
        },
        required: ["client_id"],
      },
    },
  ],
  bookkeeper: [
    {
      name: "check_quickbooks_status",
      description:
        "Check the bookkeeping status in QuickBooks for a client. Returns reconciliation status, uncategorized transactions, and last activity date.",
      input_schema: {
        type: "object" as const,
        properties: {
          client_id: {
            type: "string",
            description: "Client ID to check, or omit for all",
          },
        },
        required: [],
      },
    },
    {
      name: "check_banking_connections",
      description:
        "Check QuickBooks banking feed connections for all clients. Returns status of each bank feed (connected, disconnected, error).",
      input_schema: {
        type: "object" as const,
        properties: {
          client_id: {
            type: "string",
            description: "Specific client ID, or omit for all",
          },
        },
        required: [],
      },
    },
    {
      name: "compare_financials",
      description:
        "Compare current month financials to prior month and/or prior year. Flags unusual variances.",
      input_schema: {
        type: "object" as const,
        properties: {
          client_id: {
            type: "string",
            description: "Client ID",
          },
          period: {
            type: "string",
            description: "Period to compare (YYYY-MM)",
          },
        },
        required: ["client_id"],
      },
    },
  ],
  sales_tax: [
    {
      name: "calculate_sales_tax",
      description:
        "Calculate sales tax for given sales amounts by state/jurisdiction.",
      input_schema: {
        type: "object" as const,
        properties: {
          state: {
            type: "string",
            description: "State abbreviation (e.g., MO, IL)",
          },
          taxable_sales: {
            type: "number",
            description: "Total taxable sales amount",
          },
          locality: {
            type: "string",
            description: "City or county for local tax rates",
          },
        },
        required: ["state", "taxable_sales"],
      },
    },
    {
      name: "check_nexus",
      description:
        "Check if a client has sales tax nexus in a given state based on economic thresholds.",
      input_schema: {
        type: "object" as const,
        properties: {
          client_id: {
            type: "string",
            description: "Client ID",
          },
          state: {
            type: "string",
            description: "State to check nexus for",
          },
          annual_sales: {
            type: "number",
            description:
              "Annual sales into that state",
          },
          transaction_count: {
            type: "number",
            description: "Number of transactions into that state",
          },
        },
        required: ["state"],
      },
    },
    {
      name: "read_filing_schedule",
      description:
        "Read sales tax filing schedule and deadlines for a client or all clients.",
      input_schema: {
        type: "object" as const,
        properties: {
          client_id: {
            type: "string",
            description: "Specific client ID, or omit for all",
          },
          days_ahead: {
            type: "number",
            description: "Days ahead to look (default 30)",
          },
        },
        required: [],
      },
    },
  ],
  document_manager: [
    {
      name: "scan_onedrive_folder",
      description:
        "Scan a client's OneDrive folder structure to check for completeness and proper organization.",
      input_schema: {
        type: "object" as const,
        properties: {
          client_id: {
            type: "string",
            description: "Client ID to scan",
          },
          folder_path: {
            type: "string",
            description: "Specific folder path to scan (optional)",
          },
        },
        required: ["client_id"],
      },
    },
    {
      name: "generate_document_request",
      description:
        "Generate a PBC (Provided By Client) document request list for a client engagement.",
      input_schema: {
        type: "object" as const,
        properties: {
          client_id: {
            type: "string",
            description: "Client ID",
          },
          engagement_type: {
            type: "string",
            enum: [
              "individual_tax",
              "business_tax",
              "bookkeeping",
              "payroll_setup",
              "sales_tax",
            ],
            description: "Type of engagement",
          },
          tax_year: {
            type: "number",
            description: "Tax year if applicable",
          },
        },
        required: ["client_id", "engagement_type"],
      },
    },
    {
      name: "track_document_status",
      description:
        "Get or update the status of documents for a client. Returns pending, received, processed status.",
      input_schema: {
        type: "object" as const,
        properties: {
          client_id: {
            type: "string",
            description: "Client ID",
          },
          document_id: {
            type: "string",
            description:
              "Specific document to update (omit to list all)",
          },
          new_status: {
            type: "string",
            enum: [
              "pending",
              "requested",
              "received",
              "processed",
              "reviewed",
              "filed",
            ],
            description: "New status to set",
          },
        },
        required: ["client_id"],
      },
    },
    // Email triage tools
    {
      name: "list_emails",
      description:
        "List emails from the firm's info@ mailbox. Returns subject, sender, date, read status, and preview. Use this to check for new emails that need triage.",
      input_schema: {
        type: "object" as const,
        properties: {
          folder: {
            type: "string",
            description: "Folder name or ID to list from (default: inbox). Use 'inbox' for unprocessed emails.",
          },
          unread_only: {
            type: "boolean",
            description: "Only show unread emails (default: true)",
          },
          count: {
            type: "number",
            description: "Number of emails to return (default: 50, max: 100)",
          },
          since: {
            type: "string",
            description: "Only show emails received since this ISO date (e.g., '2026-04-16T00:00:00Z')",
          },
        },
        required: [],
      },
    },
    {
      name: "read_email",
      description:
        "Read the full content of a specific email by its ID. Use after list_emails to read individual emails for categorization.",
      input_schema: {
        type: "object" as const,
        properties: {
          message_id: {
            type: "string",
            description: "The email message ID (from list_emails results)",
          },
        },
        required: ["message_id"],
      },
    },
    {
      name: "categorize_email",
      description:
        "Move a SINGLE email to a folder. WARNING: For multiple emails, use batch_categorize_emails instead — it's much faster. Only use this tool for one-off moves.",
      input_schema: {
        type: "object" as const,
        properties: {
          message_id: {
            type: "string",
            description: "The email message ID to move",
          },
          folder_name: {
            type: "string",
            description: "Destination folder name (e.g., 'E-Filing Acceptance', 'E-Fax Confirmations', 'Payroll Notifications', 'IRS & State Guidance', 'Client Correspondence'). The folder will be created if it doesn't exist.",
          },
          mark_read: {
            type: "boolean",
            description: "Mark the email as read after moving (default: true)",
          },
        },
        required: ["message_id", "folder_name"],
      },
    },
    {
      name: "batch_categorize_emails",
      description:
        "Move multiple emails to their destination folders in a single call. MUCH more efficient than calling categorize_email repeatedly. Use this after analyzing emails from list_emails to categorize them all at once.",
      input_schema: {
        type: "object" as const,
        properties: {
          categorizations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                message_id: {
                  type: "string",
                  description: "The email message ID",
                },
                folder_name: {
                  type: "string",
                  description:
                    "Destination folder name (e.g., 'E-Filing Acceptance', 'E-Fax Confirmations', 'Payroll Notifications', 'IRS & State Guidance', 'Client Correspondence')",
                },
              },
              required: ["message_id", "folder_name"],
            },
            description:
              "Array of email categorizations — each with a message_id and folder_name",
          },
          mark_read: {
            type: "boolean",
            description:
              "Mark all emails as read after moving (default: true)",
          },
        },
        required: ["categorizations"],
      },
    },
    {
      name: "list_mail_folders",
      description:
        "List all mail folders in the info@ mailbox. Shows folder names, email counts, and unread counts. Use to see the current folder structure.",
      input_schema: {
        type: "object" as const,
        properties: {
          parent_folder: {
            type: "string",
            description: "Parent folder ID to list subfolders of (omit for top-level folders)",
          },
        },
        required: [],
      },
    },
    {
      name: "create_mail_folder",
      description:
        "Create a new mail folder in the info@ mailbox for organizing emails.",
      input_schema: {
        type: "object" as const,
        properties: {
          folder_name: {
            type: "string",
            description: "Name for the new folder",
          },
          parent_folder: {
            type: "string",
            description: "Parent folder ID to create under (omit for top-level)",
          },
        },
        required: ["folder_name"],
      },
    },
    {
      name: "send_email",
      description:
        "Send an email from the firm's info@ mailbox. Use this to send the email triage summary to partners after processing the inbox. Can also be used to send follow-up emails to clients or other notifications.",
      input_schema: {
        type: "object" as const,
        properties: {
          to: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Recipient name" },
                address: { type: "string", description: "Recipient email" },
              },
              required: ["name", "address"],
            },
            description: "Array of recipients",
          },
          cc: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "CC name" },
                address: { type: "string", description: "CC email" },
              },
              required: ["name", "address"],
            },
            description: "Optional CC recipients",
          },
          subject: {
            type: "string",
            description: "Email subject line",
          },
          body: {
            type: "string",
            description: "Email body content (supports HTML formatting)",
          },
        },
        required: ["to", "subject", "body"],
      },
    },
    {
      name: "triage_inbox",
      description:
        "ALL-IN-ONE email triage: lists all unread emails, auto-categorizes them by subject/sender patterns, moves them to the correct folders, and returns a complete summary ready to email to partners. USE THIS TOOL FIRST — it handles the entire triage workflow in a single call.",
      input_schema: {
        type: "object" as const,
        properties: {
          limit: {
            type: "number",
            description: "Max emails to process (default: 100)",
          },
        },
        required: [],
      },
    },
  ],
};

export function getToolsForAgent(role: string): Tool[] {
  const shared = [createTaskTool, logActionTool, sendPartnerAlertTool];
  const onedrive = [checkOnedriveFolderTool, searchOnedriveTool, createOnedriveFoldersTool, listOnedriveFolderTool, createExcelTool];
  const specific = toolsByRole[role] ?? [];
  return [...specific, ...onedrive, ...shared];
}

/**
 * Resolve a client identifier (name or UUID) to a UUID.
 * If already a UUID, returns as-is. If a name, looks up in the clients table.
 * Falls back to context.clientId if available.
 */
async function resolveClientId(
  clientIdOrName: string,
  contextClientId?: string
): Promise<string | null> {
  // Already a UUID
  if (clientIdOrName.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return clientIdOrName;
  }
  // Look up by name (fuzzy match, replace underscores with wildcards)
  const searchName = clientIdOrName.replace(/_/g, " ").replace(/\s+/g, "%");
  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("id")
    .ilike("name", `%${searchName}%`)
    .limit(1)
    .single();
  if (client) return client.id;
  // Fallback to context
  if (contextClientId) return contextClientId;
  return null;
}

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  context: {
    agentId: string;
    partnerId: string;
    clientId?: string;
    conversationId?: string;
  }
): Promise<string> {
  switch (toolName) {
    case "create_task": {
      const { data, error } = await supabaseAdmin
        .from("tasks")
        .insert({
          title: input.title as string,
          description: (input.description as string) ?? null,
          agent_id: context.agentId,
          assigned_by: context.partnerId,
          client_id: context.clientId ?? null,
          conversation_id: context.conversationId,
          priority: (input.priority as string) ?? "medium",
          due_date: (input.due_date as string) ?? null,
        })
        .select()
        .single();
      if (error) return `Error creating task: ${error.message}`;
      return `Task created: "${data.title}" (ID: ${data.id}, Priority: ${data.priority})`;
    }

    case "log_action": {
      await supabaseAdmin.from("audit_log").insert({
        agent_id: context.agentId,
        partner_id: context.partnerId,
        client_id: context.clientId ?? null,
        action: input.action as string,
        description: input.description as string,
      });
      return "Action logged to audit trail.";
    }

    case "send_partner_alert": {
      await supabaseAdmin.from("audit_log").insert({
        agent_id: context.agentId,
        partner_id: context.partnerId,
        client_id: context.clientId ?? null,
        action: `alert_${input.alert_type}`,
        description: input.message as string,
        metadata: { alert_type: input.alert_type },
      });
      return `Alert sent to partner: [${input.alert_type}] ${input.message}`;
    }

    case "read_payroll_schedule": {
      const query = supabaseAdmin
        .from("client_schedules")
        .select("*, clients(name)")
        .eq("schedule_type", "payroll");
      if (input.client_id) query.eq("client_id", input.client_id);
      const { data, error } = await query;
      if (error) return `Error: ${error.message}`;
      if (!data?.length) return "No payroll schedules found. Schedules need to be set up for clients in the system.";
      return JSON.stringify(data, null, 2);
    }

    case "compare_payroll_reports":
      return "Payroll comparison requires QuickBooks integration. Please connect QuickBooks in Settings to enable this feature.";

    case "check_quickbooks_status":
      return "QuickBooks status check requires QuickBooks integration. Please connect QuickBooks in Settings to enable this feature.";

    case "check_banking_connections":
      return "Banking connection check requires QuickBooks integration. Please connect QuickBooks in Settings to enable this feature.";

    case "compare_financials":
      return "Financial comparison requires QuickBooks integration. Please connect QuickBooks in Settings to enable this feature.";

    case "calculate_sales_tax": {
      const state = input.state as string;
      const sales = input.taxable_sales as number;
      // Common state rates (simplified — in production, use a tax rate API)
      const rates: Record<string, number> = {
        MO: 0.04225,
        IL: 0.0625,
        KS: 0.065,
        CA: 0.0725,
        TX: 0.0625,
        NY: 0.04,
        FL: 0.06,
      };
      const rate = rates[state.toUpperCase()] ?? 0.05;
      const tax = sales * rate;
      return JSON.stringify({
        state: state.toUpperCase(),
        taxable_sales: sales,
        state_rate: rate,
        state_tax: Math.round(tax * 100) / 100,
        note: "Local/city taxes may apply in addition. Verify current rates before filing.",
      });
    }

    case "check_nexus": {
      const state = input.state as string;
      const sales = (input.annual_sales as number) ?? 0;
      const txns = (input.transaction_count as number) ?? 0;
      // Common economic nexus thresholds
      const thresholds: Record<
        string,
        { sales: number; transactions: number }
      > = {
        MO: { sales: 100000, transactions: 200 },
        IL: { sales: 100000, transactions: 200 },
        CA: { sales: 500000, transactions: 0 },
        TX: { sales: 500000, transactions: 0 },
        NY: { sales: 500000, transactions: 100 },
      };
      const threshold = thresholds[state.toUpperCase()] ?? {
        sales: 100000,
        transactions: 200,
      };
      const hasNexus =
        sales >= threshold.sales || txns >= threshold.transactions;
      return JSON.stringify({
        state: state.toUpperCase(),
        has_nexus: hasNexus,
        annual_sales: sales,
        transaction_count: txns,
        threshold_sales: threshold.sales,
        threshold_transactions: threshold.transactions,
        note: hasNexus
          ? "Client likely has economic nexus. Verify with a tax advisor."
          : "Client appears to be below nexus thresholds. Continue monitoring.",
      });
    }

    case "read_filing_schedule": {
      const query = supabaseAdmin
        .from("client_schedules")
        .select("*, clients(name)")
        .eq("schedule_type", "sales_tax");
      if (input.client_id) query.eq("client_id", input.client_id);
      const { data, error } = await query;
      if (error) return `Error: ${error.message}`;
      if (!data?.length) return "No sales tax filing schedules found. Set up filing schedules for clients in the system.";
      return JSON.stringify(data, null, 2);
    }

    case "scan_onedrive_folder": {
      // Legacy tool name — redirect to new check_onedrive_folder
      const connected = await isConnected(context.partnerId);
      if (!connected) return "OneDrive not connected. Please connect OneDrive in Settings first.";
      const clientName = (input.client_name as string) ?? "Unknown";
      return await scanClientFolder(context.partnerId, clientName, "business");
    }

    case "check_onedrive_folder": {
      const connected = await isConnected(context.partnerId);
      if (!connected) return "OneDrive not connected. Please connect OneDrive in Settings first (click 'Connect OneDrive' button).";
      const name = input.client_name as string;
      const type = (input.client_type as "business" | "individual") ?? "business";
      const year = input.year as number | undefined;
      const sub = input.subfolder as string | undefined;
      if (sub) {
        return await scanSubfolder(context.partnerId, name, type, sub, year);
      }
      return await scanClientFolder(context.partnerId, name, type, year);
    }

    case "search_onedrive": {
      const connected = await isConnected(context.partnerId);
      if (!connected) return "OneDrive not connected. Please connect OneDrive in Settings first.";
      const query = input.query as string;
      const clientName = input.client_name as string | undefined;
      const clientType = (input.client_type as "business" | "individual") ?? "business";
      const folderPath = clientName ? buildClientPath(clientName, clientType) : undefined;
      const result = await searchFiles(context.partnerId, query, folderPath);
      if (!result.ok) return `Search error: ${result.error}`;
      if (!result.items?.length) return `No files found matching "${query}".`;
      let response = `Found ${result.items.length} result(s) for "${query}":\n\n`;
      for (const item of result.items) {
        const modified = new Date(item.lastModifiedDateTime).toLocaleDateString();
        const icon = item.folder ? "📁" : "📄";
        response += `${icon} ${item.name} (modified ${modified})\n`;
      }
      return response;
    }

    case "create_onedrive_folders": {
      const connected = await isConnected(context.partnerId);
      if (!connected) return "OneDrive not connected. Please connect OneDrive in Settings first.";
      const name = input.client_name as string;
      const type = (input.client_type as "business" | "individual") ?? "business";
      const year = input.year as number | undefined;
      return await createClientFolders(context.partnerId, name, type, year);
    }

    case "list_onedrive_folder": {
      const connected = await isConnected(context.partnerId);
      if (!connected) return "OneDrive not connected. Please connect OneDrive in Settings first.";
      const folderPath = input.folder_path as string;
      const result = await listFolder(context.partnerId, folderPath);
      if (!result.ok) return `Error: ${result.error}`;
      if (!result.items?.length) return `📂 ${folderPath} — Empty folder.`;
      let response = `📂 **${folderPath}** — ${result.items.length} items\n\n`;
      for (const item of result.items) {
        if (item.folder) {
          response += `  📁 ${item.name}/ (${item.folder.childCount} items)\n`;
        } else {
          const modified = new Date(item.lastModifiedDateTime).toLocaleDateString();
          const sizeMB = (item.size / 1024 / 1024).toFixed(1);
          response += `  📄 ${item.name} (${sizeMB} MB, modified ${modified})\n`;
        }
      }
      return response;
    }

    case "generate_document_request": {
      const engagementType = input.engagement_type as string;
      const lists: Record<string, string[]> = {
        individual_tax: [
          "W-2s from all employers",
          "1099-INT / 1099-DIV (interest and dividends)",
          "1099-NEC / 1099-MISC (freelance/contract income)",
          "1099-B (brokerage statements)",
          "1099-R (retirement distributions)",
          "1099-G (unemployment or state refunds)",
          "Mortgage interest statement (1098)",
          "Property tax bills",
          "Charitable donation receipts",
          "Medical expense receipts",
          "Business expense records (if self-employed)",
          "Estimated tax payment records",
          "Prior year tax return",
          "Social Security numbers for all dependents",
          "Health insurance coverage forms (1095-A/B/C)",
        ],
        business_tax: [
          "Profit & Loss statement (full year)",
          "Balance Sheet (year-end)",
          "General Ledger",
          "Bank statements (all accounts)",
          "Depreciation schedule",
          "Vehicle mileage logs",
          "Payroll reports (annual summary)",
          "1099s issued to contractors",
          "Inventory records (if applicable)",
          "Loan statements with interest paid",
          "Rent/lease agreements",
          "Insurance policies and premiums",
          "Prior year tax return",
          "Officer compensation details",
          "Capital asset purchases/dispositions",
        ],
        bookkeeping: [
          "Bank statements (all accounts)",
          "Credit card statements",
          "Prior year financial statements",
          "Chart of accounts",
          "QuickBooks backup file (if switching from another bookkeeper)",
          "Accounts receivable aging",
          "Accounts payable aging",
          "Loan amortization schedules",
          "Recurring journal entries",
          "Bank login credentials (for feed connections)",
        ],
        payroll_setup: [
          "Employee list with full legal names",
          "I-9 forms for all employees",
          "W-4 federal withholding forms",
          "State withholding forms",
          "Pay rates and salary information",
          "Pay frequency selection",
          "Direct deposit authorization forms",
          "Employer EIN",
          "State employer ID numbers",
          "Workers compensation policy",
          "Benefits/deduction details",
          "Prior payroll reports (if switching providers)",
        ],
        sales_tax: [
          "Sales records by state/jurisdiction",
          "Exemption certificates on file",
          "Prior period sales tax returns",
          "State sales tax account numbers",
          "Nexus analysis documentation",
          "Product/service taxability classification",
        ],
      };
      const items = lists[engagementType] ?? ["No template found for this engagement type"];
      // Save to document tracker
      for (const item of items) {
        await supabaseAdmin.from("document_tracker").insert({
          client_id: input.client_id as string,
          document_name: item,
          category: engagementType.includes("tax")
            ? "tax_return"
            : engagementType === "payroll_setup"
              ? "payroll"
              : "other",
          status: "pending",
          tax_year: (input.tax_year as number) ?? null,
        });
      }
      return `Document request list generated for ${engagementType} engagement:\n${items.map((item, i) => `${i + 1}. ${item}`).join("\n")}\n\nAll ${items.length} items have been added to the document tracker with 'pending' status.`;
    }

    case "track_document_status": {
      if (input.document_id && input.new_status) {
        const { error } = await supabaseAdmin
          .from("document_tracker")
          .update({ status: input.new_status as string, updated_at: new Date().toISOString() })
          .eq("id", input.document_id);
        if (error) return `Error updating: ${error.message}`;
        return `Document status updated to "${input.new_status}".`;
      }
      const { data, error } = await supabaseAdmin
        .from("document_tracker")
        .select("*")
        .eq("client_id", input.client_id as string)
        .order("status");
      if (error) return `Error: ${error.message}`;
      if (!data?.length) return "No documents tracked for this client yet.";
      return JSON.stringify(data, null, 2);
    }

    // === Email Triage tools ===

    case "list_emails": {
      const connected = await isConnected(context.partnerId);
      if (!connected) return "Microsoft not connected. Please connect Microsoft 365 in Settings first.";

      const { listEmails } = await import("@/lib/microsoft/graph-client");
      const folderId = (input.folder as string) ?? "inbox";
      const unreadOnly = (input.unread_only as boolean) ?? true;
      const count = Math.min((input.count as number) ?? 50, 100);
      const since = input.since as string | undefined;

      const result = await listEmails(context.partnerId, {
        folderId,
        top: count,
        unreadOnly,
        since,
      });

      if (!result.ok) return `Error listing emails: ${result.error}`;
      if (!result.emails?.length) return "No emails found matching the criteria.";

      const lines = result.emails.map((e, i) => {
        const date = new Date(e.receivedDateTime).toLocaleString("en-US", {
          month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
        });
        const read = e.isRead ? "Read" : "UNREAD";
        const attach = e.hasAttachments ? " 📎" : "";
        return `${i + 1}. [${read}] ${date}${attach}\n   From: ${e.from.emailAddress.name} <${e.from.emailAddress.address}>\n   Subject: ${e.subject}\n   Preview: ${e.bodyPreview.substring(0, 120)}...\n   ID: ${e.id}`;
      });

      return `Emails (${result.emails.length} found):\n\n${lines.join("\n\n")}`;
    }

    case "read_email": {
      const connected = await isConnected(context.partnerId);
      if (!connected) return "Microsoft not connected.";

      const { readEmail } = await import("@/lib/microsoft/graph-client");
      const messageId = input.message_id as string;

      const result = await readEmail(context.partnerId, messageId);
      if (!result.ok) return `Error reading email: ${result.error}`;
      if (!result.email) return "Email not found.";

      const e = result.email;
      // Strip HTML tags for plain text reading
      let bodyText = e.body?.content ?? e.bodyPreview;
      if (e.body?.contentType === "html") {
        bodyText = bodyText
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/\s+/g, " ")
          .trim();
      }

      // Truncate very long emails
      if (bodyText.length > 3000) {
        bodyText = bodyText.substring(0, 3000) + "\n\n[... truncated — email is very long ...]";
      }

      return `Email Details:\n\nFrom: ${e.from.emailAddress.name} <${e.from.emailAddress.address}>\nDate: ${new Date(e.receivedDateTime).toLocaleString()}\nSubject: ${e.subject}\nRead: ${e.isRead ? "Yes" : "No"}\nAttachments: ${e.hasAttachments ? "Yes" : "No"}\n\nBody:\n${bodyText}`;
    }

    case "categorize_email": {
      const connected = await isConnected(context.partnerId);
      if (!connected) return "Microsoft not connected.";

      const { findMailFolder, createMailFolder: createMF, moveEmail, markEmailRead } = await import("@/lib/microsoft/graph-client");

      const messageId = input.message_id as string;
      const folderName = input.folder_name as string;
      const markRead = (input.mark_read as boolean) ?? true;

      // Find or create the destination folder
      let folderId: string;
      const found = await findMailFolder(context.partnerId, folderName);
      if (found.ok && found.folder) {
        folderId = found.folder.id;
      } else {
        // Create the folder
        const created = await createMF(context.partnerId, folderName);
        if (!created.ok || !created.folder) {
          return `Error: Could not find or create folder "${folderName}": ${created.error}`;
        }
        folderId = created.folder.id;
      }

      // Move the email
      const moveResult = await moveEmail(context.partnerId, messageId, folderId);
      if (!moveResult.ok) return `Error moving email: ${moveResult.error}`;

      // Mark as read if requested
      if (markRead) {
        await markEmailRead(context.partnerId, messageId);
      }

      return `Email moved to "${folderName}" folder${markRead ? " and marked as read" : ""}.`;
    }

    case "batch_categorize_emails": {
      const connected = await isConnected(context.partnerId);
      if (!connected) return "Microsoft not connected.";

      const { findMailFolder, createMailFolder: createMF, batchMoveEmails } = await import("@/lib/microsoft/graph-client");

      const categorizations = input.categorizations as Array<{ message_id: string; folder_name: string }>;
      const markRead = (input.mark_read as boolean) ?? true;

      if (!categorizations || categorizations.length === 0) {
        return "No categorizations provided.";
      }

      // Pre-resolve all unique folder names to folder IDs in parallel
      const uniqueFolders = [...new Set(categorizations.map((c) => c.folder_name))];
      const folderIdMap: Record<string, string> = {};

      const folderResults = await Promise.allSettled(
        uniqueFolders.map(async (folderName) => {
          const found = await findMailFolder(context.partnerId, folderName);
          if (found.ok && found.folder) return { name: folderName, id: found.folder.id };
          const created = await createMF(context.partnerId, folderName);
          if (created.ok && created.folder) return { name: folderName, id: created.folder.id };
          return { name: folderName, id: "" };
        })
      );

      for (const r of folderResults) {
        if (r.status === "fulfilled" && r.value.id) {
          folderIdMap[r.value.name] = r.value.id;
        }
      }

      // Build operations list and track folder counts
      const operations: { messageId: string; destinationFolderId: string }[] = [];
      const folderCounts: Record<string, number> = {};
      const skipped: string[] = [];

      for (const cat of categorizations) {
        const folderId = folderIdMap[cat.folder_name];
        if (!folderId) {
          skipped.push(`Could not find/create folder "${cat.folder_name}"`);
          continue;
        }
        operations.push({ messageId: cat.message_id, destinationFolderId: folderId });
        folderCounts[cat.folder_name] = (folderCounts[cat.folder_name] || 0) + 1;
      }

      // Execute all moves in parallel chunks (10 at a time)
      const batchResult = await batchMoveEmails(context.partnerId, operations, markRead);

      // Build summary
      const total = categorizations.length;
      const summary = [`✅ Categorized ${batchResult.success}/${total} emails:`];
      for (const [folder, count] of Object.entries(folderCounts)) {
        summary.push(`  - ${folder}: ${count} emails`);
      }
      if (batchResult.failed > 0) {
        summary.push(`\n❌ ${batchResult.failed} emails failed to move`);
      }
      if (skipped.length > 0) {
        summary.push(`\n⚠️ ${skipped.length} skipped: ${skipped[0]}`);
      }

      return summary.join("\n");
    }

    case "list_mail_folders": {
      const connected = await isConnected(context.partnerId);
      if (!connected) return "Microsoft not connected.";

      const { listMailFolders } = await import("@/lib/microsoft/graph-client");
      const parentFolder = input.parent_folder as string | undefined;

      const result = await listMailFolders(context.partnerId, parentFolder);
      if (!result.ok) return `Error listing folders: ${result.error}`;
      if (!result.folders?.length) return "No folders found.";

      const lines = result.folders.map((f) => {
        const unread = f.unreadItemCount > 0 ? ` (${f.unreadItemCount} unread)` : "";
        return `  - ${f.displayName}: ${f.totalItemCount} emails${unread} [ID: ${f.id}]`;
      });

      return `Mail Folders:\n\n${lines.join("\n")}`;
    }

    case "create_mail_folder": {
      const connected = await isConnected(context.partnerId);
      if (!connected) return "Microsoft not connected.";

      const { createMailFolder: createMF } = await import("@/lib/microsoft/graph-client");
      const folderName = input.folder_name as string;
      const parentFolder = input.parent_folder as string | undefined;

      const result = await createMF(context.partnerId, folderName, parentFolder);
      if (!result.ok) return `Error creating folder: ${result.error}`;

      return `Mail folder "${folderName}" created successfully.\nFolder ID: ${result.folder?.id}`;
    }

    case "send_email": {
      const connected = await isConnected(context.partnerId);
      if (!connected) return "Microsoft not connected.";

      const { sendEmail } = await import("@/lib/microsoft/graph-client");
      const to = input.to as { name: string; address: string }[];
      const cc = input.cc as { name: string; address: string }[] | undefined;
      const subject = input.subject as string;
      const body = input.body as string;

      if (!to?.length) return "Error: At least one recipient is required.";
      if (!subject) return "Error: Subject is required.";
      if (!body) return "Error: Body is required.";

      const result = await sendEmail(context.partnerId, {
        to,
        cc,
        subject,
        body,
        bodyType: "HTML",
      });

      if (!result.ok) return `Error sending email: ${result.error}`;

      const recipientList = to.map(r => `${r.name} <${r.address}>`).join(", ");
      return `Email sent successfully!\n\nTo: ${recipientList}\nSubject: ${subject}`;
    }

    case "triage_inbox": {
      const connected = await isConnected(context.partnerId);
      if (!connected) return "Microsoft not connected.";

      const { listEmails, findMailFolder, createMailFolder: createMF, batchMoveEmails } = await import("@/lib/microsoft/graph-client");

      const limit = Math.min((input.limit as number) ?? 100, 100);

      // 1. List all unread emails
      const emailResult = await listEmails(context.partnerId, {
        folderId: "inbox",
        top: limit,
        unreadOnly: true,
      });

      if (!emailResult.ok) return `Error listing emails: ${emailResult.error}`;
      if (!emailResult.emails?.length) return "No unread emails found in the inbox. Nothing to triage.";

      const emails = emailResult.emails;

      // 2. Auto-categorize each email by subject/sender patterns
      const categorizations: { messageId: string; folder: string; subject: string; from: string; fromEmail: string; preview: string }[] = [];
      const clientEmails: { from: string; fromEmail: string; subject: string; preview: string }[] = [];

      for (const email of emails) {
        const subject = (email.subject ?? "").toLowerCase();
        const fromName = email.from?.emailAddress?.name ?? "";
        const fromEmail = email.from?.emailAddress?.address ?? "";
        const preview = (email.bodyPreview ?? "").substring(0, 200);

        let folder = "Client Correspondence"; // default

        // Form 8879
        if (subject.includes("8879") || subject.includes("form 8879")) {
          folder = "Form 8879";
        }
        // E-Filing Acceptance
        else if (
          subject.includes("accepted") ||
          subject.includes("e-file") ||
          subject.includes("efile") ||
          subject.includes("mef") ||
          subject.includes("acknowledgement") ||
          subject.includes("e-filed") ||
          subject.includes("filing accepted") ||
          subject.includes("return accepted")
        ) {
          folder = "E-Filing Acceptance";
        }
        // E-Fax Confirmations
        else if (
          subject.includes("fax") ||
          subject.includes("efax") ||
          subject.includes("e-fax")
        ) {
          folder = "E-Fax Confirmations";
        }
        // Payroll Notifications
        else if (
          subject.includes("payroll") ||
          subject.includes("adp") ||
          subject.includes("gusto") ||
          subject.includes("direct deposit") ||
          subject.includes("pay stub") ||
          subject.includes("paychex") ||
          subject.includes("wage") ||
          fromEmail.includes("adp.com") ||
          fromEmail.includes("gusto.com") ||
          fromEmail.includes("paychex.com")
        ) {
          folder = "Payroll Notifications";
        }
        // IRS & State Guidance
        else if (
          subject.includes("irs") ||
          subject.includes("internal revenue") ||
          subject.includes("revenue ruling") ||
          subject.includes("dor") ||
          subject.includes("tax law") ||
          subject.includes("cpe") ||
          subject.includes("tax update") ||
          subject.includes("regulatory") ||
          fromEmail.includes("irs.gov") ||
          fromEmail.includes(".gov")
        ) {
          folder = "IRS & State Guidance";
        }
        // Newsletters / Marketing — file to IRS & State Guidance if tax-related
        else if (
          subject.includes("newsletter") ||
          subject.includes("webinar") ||
          subject.includes("tax alert") ||
          subject.includes("tax news")
        ) {
          folder = "IRS & State Guidance";
        }

        categorizations.push({
          messageId: email.id,
          folder,
          subject: email.subject ?? "(no subject)",
          from: fromName,
          fromEmail,
          preview,
        });

        // Track client emails for the partner summary
        if (folder === "Client Correspondence") {
          clientEmails.push({
            from: fromName,
            fromEmail,
            subject: email.subject ?? "(no subject)",
            preview,
          });
        }
      }

      // 3. Resolve all unique folder names to IDs in parallel
      const uniqueFolders = [...new Set(categorizations.map((c) => c.folder))];
      const folderIdMap: Record<string, string> = {};

      const folderResults = await Promise.allSettled(
        uniqueFolders.map(async (folderName) => {
          const found = await findMailFolder(context.partnerId, folderName);
          if (found.ok && found.folder) return { name: folderName, id: found.folder.id };
          const created = await createMF(context.partnerId, folderName);
          if (created.ok && created.folder) return { name: folderName, id: created.folder.id };
          return { name: folderName, id: "" };
        })
      );

      for (const r of folderResults) {
        if (r.status === "fulfilled" && r.value.id) {
          folderIdMap[r.value.name] = r.value.id;
        }
      }

      // 4. Build move operations and execute in parallel
      const operations = categorizations
        .filter((c) => folderIdMap[c.folder])
        .map((c) => ({ messageId: c.messageId, destinationFolderId: folderIdMap[c.folder] }));

      const batchResult = await batchMoveEmails(context.partnerId, operations, true);

      // 5. Build folder counts
      const folderCounts: Record<string, number> = {};
      for (const c of categorizations) {
        folderCounts[c.folder] = (folderCounts[c.folder] || 0) + 1;
      }

      // 6. Build the summary for the agent to use
      const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const summaryLines = [
        `📬 EMAIL TRIAGE COMPLETE — ${today}`,
        ``,
        `Processed ${batchResult.success} of ${emails.length} emails.`,
        ``,
        `📊 Emails Filed:`,
      ];

      for (const [folder, count] of Object.entries(folderCounts)) {
        if (folder !== "Client Correspondence") {
          summaryLines.push(`  - ${folder}: ${count} emails`);
        }
      }

      if (clientEmails.length > 0) {
        summaryLines.push(``, `🔴 Client Emails Needing Attention (${clientEmails.length}):`);
        for (const ce of clientEmails) {
          summaryLines.push(`  - From: ${ce.from} <${ce.fromEmail}>`);
          summaryLines.push(`    Subject: ${ce.subject}`);
          summaryLines.push(`    Preview: ${ce.preview}`);
          summaryLines.push(``);
        }
      } else {
        summaryLines.push(``, `✅ No client emails needing partner attention.`);
      }

      if (batchResult.failed > 0) {
        summaryLines.push(``, `⚠️ ${batchResult.failed} emails failed to move.`);
      }

      summaryLines.push(``, `Next step: Use send_email to forward this summary to both partners (Emily Chen: emily.chen@evergrowfin.com, Cara Jiang: jiangy@evergrowfin.com).`);

      return summaryLines.join("\n");
    }

    // === Income Tax Specialist tools ===

    case "prepare_organizer": {
      const clientId = input.client_id as string;
      const entityType = input.entity_type as string;
      const taxYear = input.tax_year as number;
      const priorYearItems = (input.prior_year_items as string[]) ?? [];

      // Base organizer items by entity type
      const organizers: Record<string, string[]> = {
        individual: [
          "W-2s from all employers",
          "1099-INT / 1099-DIV (interest and dividends)",
          "1099-NEC / 1099-MISC (freelance/contract income)",
          "1099-B (brokerage/investment sale statements)",
          "1099-R (retirement distributions)",
          "1099-G (unemployment, state refunds)",
          "1099-K (payment card/third-party network)",
          "1099-SA / 5498-SA (HSA distributions/contributions)",
          "SSA-1099 (Social Security benefits)",
          "K-1s from partnerships, S-corps, trusts",
          "Mortgage interest statement (1098)",
          "Property tax bills (all properties)",
          "Charitable donation receipts (cash and non-cash)",
          "Medical/dental expense receipts",
          "State and local taxes paid",
          "Estimated tax payment records (federal and state)",
          "Prior year tax return (for carryforward items)",
          "Health insurance forms (1095-A/B/C)",
          "Child care provider info (name, address, EIN, amount paid)",
          "Education expenses (1098-T, 529 distributions)",
          "Student loan interest (1098-E)",
          "Educator expenses receipts",
          "IRA/401k contribution records",
          "Business income and expenses (if Schedule C)",
          "Rental property income and expenses (if Schedule E)",
          "Vehicle mileage log (if business use)",
          "Home office measurements (if applicable)",
          "Cryptocurrency transaction records",
          "Foreign bank account info (FBAR if >$10,000 aggregate)",
        ],
        s_corp: [
          "Trial balance / General ledger (full year)",
          "Profit & Loss statement",
          "Balance Sheet (year-end)",
          "Officer compensation details and W-2s",
          "Shareholder ownership percentages",
          "Shareholder basis calculations (prior year)",
          "Bank statements (all accounts)",
          "Depreciation schedule / Fixed asset listing",
          "Vehicle mileage logs (per vehicle)",
          "1099s issued to contractors",
          "Payroll tax returns (941s, annual summary)",
          "State payroll returns",
          "Loan statements with interest paid",
          "Rent/lease agreements and payments",
          "Insurance policies and premiums",
          "Prior year tax return (for carryforwards)",
          "Capital asset purchases and dispositions",
          "Health insurance premiums paid for >2% shareholders",
          "Retirement plan contributions (401k, SEP, SIMPLE)",
          "Distributions to shareholders",
          "State tax payments",
          "AAA/OAA schedule from prior year",
        ],
        partnership: [
          "Trial balance / General ledger (full year)",
          "Profit & Loss statement",
          "Balance Sheet (year-end)",
          "Partnership agreement (current version)",
          "Partner ownership and profit/loss sharing percentages",
          "Capital account reconciliation (prior year)",
          "Guaranteed payment details per partner",
          "Partner contribution and distribution records",
          "Bank statements (all accounts)",
          "Depreciation schedule / Fixed asset listing",
          "1099s issued to contractors",
          "Loan statements with interest",
          "Rent/lease agreements",
          "Prior year tax return and K-1s",
          "Section 754 election documentation (if applicable)",
          "Capital asset purchases and dispositions",
          "At-risk and passive activity information per partner",
        ],
        corporation: [
          "Trial balance / General ledger (full year)",
          "Profit & Loss statement",
          "Balance Sheet (year-end)",
          "Officer compensation details",
          "Shareholder information",
          "Bank statements (all accounts)",
          "Depreciation schedule / Fixed asset listing",
          "1099s issued to contractors",
          "Payroll tax returns",
          "Estimated tax payment records",
          "Prior year tax return (for NOL carryforwards)",
          "Capital asset purchases and dispositions",
          "Dividend payment records",
          "Schedule M-1/M-3 book-tax differences",
          "R&D credit documentation (if applicable)",
          "State apportionment data (revenue, payroll, property by state)",
        ],
        nonprofit: [
          "Trial balance / General ledger (full year)",
          "Statement of Financial Position",
          "Statement of Activities",
          "Statement of Functional Expenses",
          "Donor/Grant revenue detail",
          "Program service revenue detail",
          "Fundraising event details and expenses",
          "Board member/officer compensation",
          "Top 5 highest compensated employees",
          "Independent contractor payments (>$100k)",
          "Investment portfolio statements",
          "Unrelated business income details",
          "Public support schedule data",
          "Governance policies documentation",
          "Prior year Form 990",
        ],
        trust: [
          "Trust agreement / Will",
          "Fiduciary income (interest, dividends, capital gains)",
          "Trust expenses (trustee fees, legal, accounting)",
          "Distributions to beneficiaries",
          "Beneficiary information (names, SSN, addresses)",
          "K-1s received from partnerships/S-corps",
          "Prior year Form 1041 and K-1s issued",
          "DNI calculation from prior year",
          "Tax-exempt income allocations",
          "Capital gain allocation (corpus vs. income)",
        ],
      };

      const baseItems = organizers[entityType] ?? organizers.individual;

      // Add prior-year specific items
      const allItems = [...baseItems];
      for (const item of priorYearItems) {
        if (!allItems.some((i) => i.toLowerCase().includes(item.toLowerCase()))) {
          allItems.push(`[Prior Year] ${item}`);
        }
      }

      // Save to document tracker
      for (const item of allItems) {
        await supabaseAdmin.from("document_tracker").insert({
          client_id: clientId,
          document_name: item,
          category: "tax_return",
          status: "pending",
          tax_year: taxYear,
        });
      }

      // Update or create return tracker
      await supabaseAdmin.from("tax_return_tracker").upsert({
        client_id: clientId,
        tax_year: taxYear,
        entity_type: entityType,
        status: "organizer_sent",
      }, { onConflict: "client_id,tax_year" });

      return `Tax organizer prepared for ${taxYear} (${entityType}):\n\n${allItems.map((item, i) => `${i + 1}. ${item}`).join("\n")}\n\nTotal items: ${allItems.length}\nAll items added to document tracker with 'pending' status.\nReturn tracker updated to 'Organizer Sent'.`;
    }

    case "prepare_tax_return": {
      const entityType = input.entity_type as string;
      const taxYear = input.tax_year as number;
      const clientId = input.client_id as string;
      const financialData = input.financial_data as Record<string, unknown> ?? {};

      // Update tracker
      await supabaseAdmin.from("tax_return_tracker").upsert({
        client_id: clientId,
        tax_year: taxYear,
        entity_type: entityType,
        status: "in_preparation",
      }, { onConflict: "client_id,tax_year" });

      const formMap: Record<string, string> = {
        individual: "Form 1040",
        s_corp: "Form 1120-S",
        partnership: "Form 1065",
        corporation: "Form 1120",
        nonprofit: "Form 990",
        trust: "Form 1041",
      };

      return `Tax return preparation initiated for ${taxYear} ${formMap[entityType] ?? entityType}.\n\nFinancial data received: ${JSON.stringify(financialData, null, 2)}\n\nThe agent will now prepare the return workpapers based on the provided data. Key schedules will be calculated and stored. Return tracker updated to 'In Preparation'.\n\nNote: Please provide the financial data (income, expenses, balance sheet items) so I can prepare the detailed workpapers and calculations. I'll create Excel workpapers in the client's OneDrive folder.`;
    }

    case "review_tax_return": {
      const clientId = input.client_id as string;
      const taxYear = input.tax_year as number;
      const entityType = input.entity_type as string;
      const staffData = input.staff_return_data as Record<string, unknown> ?? {};
      const agentData = input.agent_return_data as Record<string, unknown> ?? {};

      // Update tracker
      await supabaseAdmin.from("tax_return_tracker").upsert({
        client_id: clientId,
        tax_year: taxYear,
        entity_type: entityType,
        status: "under_review",
      }, { onConflict: "client_id,tax_year" });

      return `Tax return review initiated for ${taxYear} (${entityType}).\n\nStaff return data: ${JSON.stringify(staffData, null, 2)}\nAgent return data: ${JSON.stringify(agentData, null, 2)}\n\nReturn tracker updated to 'Under Review'.\n\nI will now compare the two versions line by line. Please provide the key line items from both the staff-prepared return and my prepared workpapers so I can identify discrepancies and create review comments.`;
    }

    case "create_review_comment": {
      let clientId = input.client_id as string;
      const taxYear = input.tax_year as number;
      const category = input.category as string;
      const description = input.description as string;
      const lineRef = (input.line_reference as string) ?? null;
      const severity = (input.severity as string) ?? "medium";
      const assignedTo = (input.assigned_to as string) ?? null;

      // Resolve client name to UUID
      const resolvedCrc = await resolveClientId(clientId, context.clientId);
      if (resolvedCrc) clientId = resolvedCrc;

      // Get or create the tax return tracker record
      let { data: tracker } = await supabaseAdmin
        .from("tax_return_tracker")
        .select("id")
        .eq("client_id", clientId)
        .eq("tax_year", taxYear)
        .single();

      if (!tracker) {
        const { data: newTracker } = await supabaseAdmin
          .from("tax_return_tracker")
          .insert({ client_id: clientId, tax_year: taxYear, entity_type: "individual", status: "under_review" })
          .select("id")
          .single();
        tracker = newTracker;
      }

      if (!tracker) return "Error: Could not find or create tax return tracker record.";

      const { data: comment, error } = await supabaseAdmin
        .from("review_comments")
        .insert({
          tax_return_id: tracker.id,
          client_id: clientId,
          category,
          description,
          line_reference: lineRef,
          severity,
          assigned_to: assignedTo,
          status: "open",
        })
        .select()
        .single();

      if (error) return `Error creating review comment: ${error.message}`;

      // If assigned to someone, create a task for them
      if (assignedTo) {
        await supabaseAdmin.from("tasks").insert({
          title: `Review Comment: ${category.replace("_", " ")} - ${taxYear} Tax Return`,
          description: `${description}${lineRef ? `\nLine Reference: ${lineRef}` : ""}\nSeverity: ${severity}`,
          agent_id: context.agentId,
          assigned_by: context.partnerId,
          client_id: clientId,
          priority: severity === "critical" ? "urgent" : severity === "high" ? "high" : "medium",
        });
      }

      return `Review comment created (ID: ${comment.id}):\n- Category: ${category}\n- Description: ${description}\n- Line Reference: ${lineRef ?? "N/A"}\n- Severity: ${severity}\n- Assigned to: ${assignedTo ?? "Unassigned"}\n- Status: Open${assignedTo ? `\n\nTask created and assigned to ${assignedTo}.` : ""}`;
    }

    case "update_return_tracker": {
      let clientId = input.client_id as string | undefined;
      const taxYear = input.tax_year as number | undefined;
      const newStatus = input.new_status as string | undefined;
      const assignedStaff = input.assigned_staff as string | undefined;
      const notes = input.notes as string | undefined;

      // Resolve client name to UUID
      if (clientId) {
        const resolved = await resolveClientId(clientId, context.clientId);
        if (!resolved) return `Could not find a client matching "${clientId}". Please provide the exact client name.`;
        clientId = resolved;
      }

      // If no client_id, list all returns
      if (!clientId) {
        const { data, error } = await supabaseAdmin
          .from("tax_return_tracker")
          .select("*, clients(name)")
          .order("due_date");
        if (error) return `Error: ${error.message}`;
        if (!data?.length) return "No tax returns in the tracker yet. Use this tool with a client_id and tax_year to create one.";
        return `Tax Return Tracker:\n${JSON.stringify(data, null, 2)}`;
      }

      // Update existing or create
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (newStatus) updates.status = newStatus;
      if (assignedStaff) updates.assigned_staff = assignedStaff;
      if (notes) updates.reviewer_notes = notes;

      if (newStatus === "ready_for_partner_review") {
        // Also send a partner alert
        await supabaseAdmin.from("audit_log").insert({
          agent_id: context.agentId,
          partner_id: context.partnerId,
          client_id: clientId,
          action: "return_ready_for_review",
          description: `${taxYear} tax return is ready for partner final review. All review comments have been resolved.`,
        });
      }

      const { data, error } = await supabaseAdmin
        .from("tax_return_tracker")
        .upsert({
          client_id: clientId,
          tax_year: taxYear ?? new Date().getFullYear(),
          entity_type: "individual",
          ...updates,
        }, { onConflict: "client_id,tax_year" })
        .select("*, clients(name)")
        .single();

      if (error) return `Error updating tracker: ${error.message}`;

      const statusLabels: Record<string, string> = {
        not_started: "Not Started",
        organizer_sent: "Organizer Sent",
        info_gathering: "Info Gathering",
        in_preparation: "In Preparation",
        under_review: "Under Review",
        review_comments_sent: "Review Comments Sent",
        corrections_in_progress: "Corrections In Progress",
        ready_for_partner_review: "Ready for Partner Review",
        partner_approved: "Partner Approved",
        filed: "Filed",
        extended: "Extended",
      };

      return `Tax return tracker updated:\n- Client: ${(data.clients as Record<string, string>)?.name ?? clientId}\n- Tax Year: ${data.tax_year}\n- Status: ${statusLabels[data.status] ?? data.status}\n- Assigned Staff: ${data.assigned_staff ?? "Unassigned"}${newStatus === "ready_for_partner_review" ? "\n\nPartner has been notified that the return is ready for final review." : ""}`;
    }

    case "get_review_comments": {
      let clientId = input.client_id as string;
      const taxYear = input.tax_year as number | undefined;
      const statusFilter = input.status_filter as string | undefined;

      // Resolve client name to UUID
      const resolvedGrc = await resolveClientId(clientId, context.clientId);
      if (resolvedGrc) clientId = resolvedGrc;

      let query = supabaseAdmin
        .from("review_comments")
        .select("*")
        .eq("client_id", clientId)
        .order("comment_date", { ascending: false });

      if (statusFilter) query = query.eq("status", statusFilter);

      const { data, error } = await query;
      if (error) return `Error: ${error.message}`;
      if (!data?.length) return "No review comments found for this client.";

      // Filter by tax year if provided (through the tracker)
      let filtered = data;
      if (taxYear) {
        const { data: tracker } = await supabaseAdmin
          .from("tax_return_tracker")
          .select("id")
          .eq("client_id", clientId)
          .eq("tax_year", taxYear)
          .single();
        if (tracker) {
          filtered = data.filter((c) => c.tax_return_id === tracker.id);
        }
      }

      if (!filtered.length) return `No review comments found for tax year ${taxYear}.`;

      const summary = {
        total: filtered.length,
        open: filtered.filter((c) => c.status === "open").length,
        in_progress: filtered.filter((c) => c.status === "in_progress").length,
        resolved: filtered.filter((c) => c.status === "resolved").length,
        deferred: filtered.filter((c) => c.status === "deferred").length,
      };

      return `Review Comment Summary:\n- Total: ${summary.total}\n- Open: ${summary.open}\n- In Progress: ${summary.in_progress}\n- Resolved: ${summary.resolved}\n- Deferred: ${summary.deferred}\n\nComments:\n${JSON.stringify(filtered, null, 2)}`;
    }

    case "create_excel_file": {
      const connected = await isConnected(context.partnerId);
      if (!connected) return "OneDrive not connected. Please connect OneDrive in Settings first.";

      const fileName = input.file_name as string;
      const folderPath = input.folder_path as string;
      const sheetName = (input.sheet_name as string) ?? "Sheet1";
      const headers = input.headers as string[];
      const rows = input.rows as string[][];

      try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "Evergrow AI Agent";
        workbook.created = new Date();

        const sheet = workbook.addWorksheet(sheetName);

        // Add headers with styling
        sheet.addRow(headers);
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, size: 11 };
        headerRow.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF2D5016" },
        };
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };

        // Add data rows
        for (const row of rows) {
          sheet.addRow(row);
        }

        // Auto-fit column widths
        sheet.columns.forEach((col, i) => {
          let maxLen = headers[i]?.length ?? 10;
          for (const row of rows) {
            if (row[i] && row[i].length > maxLen) maxLen = row[i].length;
          }
          col.width = Math.min(maxLen + 4, 50);
        });

        // Add borders
        sheet.eachRow((row) => {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            };
          });
        });

        const buffer = new Uint8Array(await workbook.xlsx.writeBuffer());

        const result = await uploadFile(
          context.partnerId,
          folderPath,
          fileName,
          buffer,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        if (!result.ok) return `Error uploading Excel file: ${result.error}`;

        return `Excel file created and uploaded successfully!\nFile: ${fileName}\nLocation: ${folderPath}/${fileName}\nLink: ${result.webUrl ?? "Available in OneDrive"}\nContents: ${headers.length} columns, ${rows.length} data rows`;
      } catch (err) {
        return `Error creating Excel file: ${err instanceof Error ? err.message : err}`;
      }
    }

    // === Generic Skill Tools ===

    case "copy_skill_template": {
      const connected = await isConnected(context.partnerId);
      if (!connected) return "OneDrive not connected. Please connect OneDrive in Settings first.";

      const skillName = input.skill_name as string;
      const templateFile = input.template_file as string;
      const destFolder = input.destination_folder as string;
      const destFilename = input.destination_filename as string;

      try {
        const { getSkillTemplatePath } = await import("@/lib/skills/loader");
        const templatePath = getSkillTemplatePath(skillName, templateFile);

        if (!templatePath) {
          return `Error: Template "${templateFile}" not found for skill "${skillName}". Available skills are in src/lib/skills/.`;
        }

        const fs = await import("fs");
        const fileBuffer = fs.readFileSync(templatePath);
        const buffer = new Uint8Array(fileBuffer);

        const result = await uploadFile(
          context.partnerId,
          destFolder,
          destFilename,
          buffer,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        if (!result.ok) return `Error uploading template: ${result.error}`;

        return `Template copied successfully!\n\nSource: ${skillName}/${templateFile}\nDestination: ${destFolder}/${destFilename}\nLink: ${result.webUrl ?? "Available in OneDrive"}\n\nThe template is now ready. Use write_excel_cells to populate it with data.`;
      } catch (err) {
        return `Error copying template: ${err instanceof Error ? err.message : err}`;
      }
    }

    case "download_excel": {
      const connected = await isConnected(context.partnerId);
      if (!connected) return "OneDrive not connected. Please connect OneDrive in Settings first.";

      const filePath = input.file_path as string;

      try {
        const dl = await downloadFile(context.partnerId, filePath);
        if (!dl.ok || !dl.buffer) return `Error downloading file: ${dl.error}`;

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(dl.buffer);

        const sheets: string[] = [];
        workbook.eachSheet((ws) => {
          const rowCount = ws.rowCount;
          const colCount = ws.columnCount;
          sheets.push(`  - ${ws.name}: ${rowCount} rows × ${colCount} columns`);
        });

        return `Excel workbook downloaded: ${filePath}\n\nSheets:\n${sheets.join("\n")}\n\nUse read_excel_cells to read specific cells, or write_excel_cells to write data.`;
      } catch (err) {
        return `Error reading Excel file: ${err instanceof Error ? err.message : err}`;
      }
    }

    case "read_excel_cells": {
      const connected = await isConnected(context.partnerId);
      if (!connected) return "OneDrive not connected. Please connect OneDrive in Settings first.";

      const filePath = input.file_path as string;
      const sheetName = input.sheet_name as string;
      const cells = input.cells as string[];

      try {
        const dl = await downloadFile(context.partnerId, filePath);
        if (!dl.ok || !dl.buffer) return `Error downloading file: ${dl.error}`;

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(dl.buffer);

        const ws = workbook.getWorksheet(sheetName);
        if (!ws) return `Error: Sheet "${sheetName}" not found. Available sheets: ${workbook.worksheets.map(s => s.name).join(", ")}`;

        const results: string[] = [];
        for (const cellRef of cells) {
          // Handle range like "B52:I56"
          if (cellRef.includes(":")) {
            const [start, end] = cellRef.split(":");
            const startCell = ws.getCell(start);
            const endCell = ws.getCell(end);
            const startRow = Number(startCell.row);
            const endRow = Number(endCell.row);
            const startCol = Number(startCell.col);
            const endCol = Number(endCell.col);

            results.push(`\n[Range ${cellRef}]:`);
            for (let r = startRow; r <= endRow; r++) {
              const rowVals: string[] = [];
              for (let c = startCol; c <= endCol; c++) {
                const cell = ws.getCell(r, c);
                const val = cell.value;
                if (val !== null && val !== undefined) {
                  // Handle formula results
                  if (typeof val === "object" && val !== null && "result" in (val as unknown as Record<string, unknown>)) {
                    rowVals.push(`${(val as unknown as Record<string, unknown>).result}`);
                  } else {
                    rowVals.push(`${val}`);
                  }
                } else {
                  rowVals.push("");
                }
              }
              results.push(`  Row ${r}: ${rowVals.join(" | ")}`);
            }
          } else {
            // Single cell
            const cell = ws.getCell(cellRef);
            const val = cell.value;
            let displayVal: string;
            if (val === null || val === undefined) {
              displayVal = "(empty)";
            } else if (typeof val === "object" && val !== null && "result" in (val as unknown as Record<string, unknown>)) {
              displayVal = `${(val as unknown as Record<string, unknown>).result} (formula)`;
            } else {
              displayVal = `${val}`;
            }
            results.push(`${cellRef}: ${displayVal}`);
          }
        }

        return `Reading from ${sheetName} in ${filePath}:\n\n${results.join("\n")}`;
      } catch (err) {
        return `Error reading cells: ${err instanceof Error ? err.message : err}`;
      }
    }

    case "write_excel_cells": {
      const connected = await isConnected(context.partnerId);
      if (!connected) return "OneDrive not connected. Please connect OneDrive in Settings first.";

      const filePath = input.file_path as string;
      const sheetName = input.sheet_name as string;
      const cells = input.cells as Record<string, unknown>;

      if (!cells || Object.keys(cells).length === 0) {
        return "Error: No cells provided. Pass an object like {\"C6\": 2, \"C14\": \"John\"}.";
      }

      try {
        // Download
        const dl = await downloadFile(context.partnerId, filePath);
        if (!dl.ok || !dl.buffer) return `Error downloading file: ${dl.error}`;

        // Load workbook
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(dl.buffer);

        const ws = workbook.getWorksheet(sheetName);
        if (!ws) return `Error: Sheet "${sheetName}" not found. Available sheets: ${workbook.worksheets.map(s => s.name).join(", ")}`;

        // Write cells
        let written = 0;
        const writtenCells: string[] = [];
        for (const [cellRef, value] of Object.entries(cells)) {
          if (value !== undefined && value !== null) {
            const cell = ws.getCell(cellRef);
            cell.value = value as ExcelJS.CellValue;
            written++;
            writtenCells.push(`${cellRef} = ${value}`);
          }
        }

        // Re-upload
        const outputBuffer = await workbook.xlsx.writeBuffer();
        const folder = filePath.substring(0, filePath.lastIndexOf("/"));
        const fileName = filePath.substring(filePath.lastIndexOf("/") + 1);

        const uploadResult = await uploadFile(
          context.partnerId,
          folder,
          fileName,
          new Uint8Array(outputBuffer),
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        if (!uploadResult.ok) return `Wrote ${written} cells but re-upload failed: ${uploadResult.error}`;

        return `Successfully wrote ${written} cells to ${sheetName} in ${filePath}:\n\n${writtenCells.join("\n")}\n\nLink: ${uploadResult.webUrl ?? "Available in OneDrive"}\n\nFormula cells will auto-calculate when the workbook is opened in Excel.`;
      } catch (err) {
        return `Error writing cells: ${err instanceof Error ? err.message : err}`;
      }
    }

    case "read_client_documents": {
      const connected = await isConnected(context.partnerId);
      if (!connected) return "OneDrive not connected. Please connect OneDrive in Settings first.";

      const clientName = input.client_name as string;
      const clientType = (input.client_type as "business" | "individual") ?? "individual";
      const year = input.year as number;
      const subfolder = input.subfolder as string | undefined;

      // Scan the folder
      let result: string;
      if (subfolder) {
        result = await scanSubfolder(context.partnerId, clientName, clientType, subfolder, year);
      } else {
        result = await scanClientFolder(context.partnerId, clientName, clientType, year);
      }

      // Add document type analysis
      const docTypes: string[] = [];
      const lower = result.toLowerCase();
      if (lower.includes("w-2") || lower.includes("w2")) docTypes.push("W-2 (Wages)");
      if (lower.includes("1099-int") || lower.includes("1099int")) docTypes.push("1099-INT (Interest)");
      if (lower.includes("1099-div") || lower.includes("1099div")) docTypes.push("1099-DIV (Dividends)");
      if (lower.includes("1099-b") || lower.includes("1099b")) docTypes.push("1099-B (Brokerage)");
      if (lower.includes("1099-r") || lower.includes("1099r")) docTypes.push("1099-R (Retirement)");
      if (lower.includes("1099-nec") || lower.includes("1099nec")) docTypes.push("1099-NEC (Self-Employment)");
      if (lower.includes("1099-ssa") || lower.includes("ssa")) docTypes.push("SSA-1099 (Social Security)");
      if (lower.includes("k-1") || lower.includes("k1")) docTypes.push("Schedule K-1 (Partnership/Trust)");
      if (lower.includes("1098") && !lower.includes("1099")) docTypes.push("1098 (Mortgage Interest)");
      if (lower.includes("property tax")) docTypes.push("Property Tax Statement");
      if (lower.includes("1040") || lower.includes("tax return")) docTypes.push("Prior Year Return");
      if (lower.includes("organizer")) docTypes.push("Client Organizer");
      if (lower.includes("vanguard") || lower.includes("schwab") || lower.includes("fidelity")) docTypes.push("Investment Statements");

      const analysis = docTypes.length > 0
        ? `\n\nDocument types detected:\n${docTypes.map(d => `  - ${d}`).join("\n")}`
        : "\n\nNo standard tax document types detected in filenames.";

      return result + analysis + "\n\nUse the individual file reading tools to extract data from each document.";
    }

    default:
      return `Tool "${toolName}" is not yet implemented. This feature will be available in a future update.`;
  }
}
