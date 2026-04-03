import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

// Agent-specific tools
const toolsByRole: Record<string, Tool[]> = {
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
  ],
};

export function getToolsForAgent(role: string): Tool[] {
  const shared = [createTaskTool, logActionTool, sendPartnerAlertTool];
  const specific = toolsByRole[role] ?? [];
  return [...specific, ...shared];
}

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  context: {
    agentId: string;
    partnerId: string;
    clientId?: string;
    conversationId: string;
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

    case "scan_onedrive_folder":
      return "OneDrive scanning requires Microsoft Graph integration. Please connect OneDrive in Settings to enable this feature.";

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

    default:
      return `Tool "${toolName}" is not yet implemented. This feature will be available in a future update.`;
  }
}
