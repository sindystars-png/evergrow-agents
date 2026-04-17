import { supabaseAdmin } from "@/lib/supabase/admin";

const MICROSOFT_CLIENT_ID = (process.env.MICROSOFT_CLIENT_ID ?? "").trim();
const MICROSOFT_TENANT_ID = (process.env.MICROSOFT_TENANT_ID ?? "").trim();

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// Folder structure constants matching Evergrow's OneDrive layout
export const FOLDER_STRUCTURE = {
  root: "Emily - Evergrow Financials",
  business: "Emily - Evergrow Financials/Clients-Business",
  individual: "Emily - Evergrow Financials/Clients-Individual",
  subfolders: ["Bookkeeping", "Payroll", "Sales", "Year End Tax"],
} as const;

// ============================================================
// Device Code Flow — no redirect URI needed
// ============================================================

export type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  message: string;
};

// Step 1: Request a device code from Microsoft
export async function requestDeviceCode(): Promise<DeviceCodeResponse | null> {
  try {
    const response = await fetch(
      `https://login.microsoftonline.com/common/oauth2/v2.0/devicecode`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: MICROSOFT_CLIENT_ID,
          scope: "https://graph.microsoft.com/Files.ReadWrite.All https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access",
        }),
      }
    );

    if (!response.ok) {
      console.error("Device code request failed:", await response.text());
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error("Device code error:", err);
    return null;
  }
}

// Step 2: Poll Microsoft until the user completes sign-in
export async function pollForToken(
  deviceCode: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  try {
    const response = await fetch(
      `https://login.microsoftonline.com/common/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: MICROSOFT_CLIENT_ID,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: deviceCode,
        }),
      }
    );

    const data = await response.json();

    if (data.error === "authorization_pending") {
      return null; // User hasn't completed sign-in yet
    }

    if (data.error) {
      console.error("Token poll error:", data.error, data.error_description);
      return null;
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    };
  } catch (err) {
    console.error("Poll error:", err);
    return null;
  }
}

// Step 3: Save the token and get user info
export async function saveConnection(
  partnerId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): Promise<{ ok: boolean; email?: string; error?: string }> {
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Get Microsoft user info
  let email: string | null = null;
  let name: string | null = null;
  try {
    const userResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (userResponse.ok) {
      const userData = await userResponse.json();
      email = userData.mail ?? userData.userPrincipalName ?? null;
      name = userData.displayName ?? null;
    }
  } catch {
    // Non-critical — proceed without user info
  }

  const { error } = await supabaseAdmin
    .from("microsoft_connections")
    .upsert(
      {
        partner_id: partnerId,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        microsoft_email: email,
        microsoft_name: name,
      },
      { onConflict: "partner_id" }
    );

  if (error) return { ok: false, error: error.message };
  return { ok: true, email: email ?? undefined };
}

// ============================================================
// Token Management
// ============================================================

async function getToken(partnerId: string): Promise<string | null> {
  // Try specific partner first, then fall back to any connection
  let { data } = await supabaseAdmin
    .from("microsoft_connections")
    .select("access_token, refresh_token, expires_at, partner_id")
    .eq("partner_id", partnerId)
    .single();

  if (!data) {
    // Fallback: use any available connection (small firm — shared OneDrive)
    const fallback = await supabaseAdmin
      .from("microsoft_connections")
      .select("access_token, refresh_token, expires_at, partner_id")
      .limit(1)
      .single();
    data = fallback.data;
  }

  if (!data) return null;

  // Check if token is expired (with 5 min buffer)
  const expiresAt = new Date(data.expires_at);
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);

  if (now >= expiresAt && data.refresh_token) {
    const newToken = await refreshAccessToken(data.refresh_token, data.partner_id);
    return newToken;
  }

  return data.access_token;
}

async function refreshAccessToken(
  refreshToken: string,
  partnerId: string
): Promise<string | null> {
  const MICROSOFT_CLIENT_SECRET = (process.env.MICROSOFT_CLIENT_SECRET ?? "").trim();

  try {
    const response = await fetch(
      `https://login.microsoftonline.com/common/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: MICROSOFT_CLIENT_ID,
          client_secret: MICROSOFT_CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          scope: "https://graph.microsoft.com/Files.ReadWrite.All https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access",
        }),
      }
    );

    if (!response.ok) {
      console.error("Token refresh failed:", await response.text());
      return null;
    }

    const tokenData = await response.json();
    const expiresAt = new Date(
      Date.now() + tokenData.expires_in * 1000
    ).toISOString();

    await supabaseAdmin
      .from("microsoft_connections")
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? refreshToken,
        expires_at: expiresAt,
      })
      .eq("partner_id", partnerId);

    return tokenData.access_token;
  } catch {
    return null;
  }
}

// ============================================================
// Graph API Helper
// ============================================================

async function graphFetch(
  accessToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const response = await fetch(`${GRAPH_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return { ok: false, error: `Graph API error (${response.status}): ${error}` };
    }

    if (response.status === 204) return { ok: true };

    const data = await response.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: `Request failed: ${err}` };
  }
}

// ============================================================
// OneDrive Operations
// ============================================================

type DriveItem = {
  name: string;
  folder?: { childCount: number };
  file?: { mimeType: string };
  size: number;
  lastModifiedDateTime: string;
};

export async function listFolder(
  partnerId: string,
  folderPath: string
): Promise<{ ok: boolean; items?: DriveItem[]; error?: string }> {
  const token = await getToken(partnerId);
  if (!token) return { ok: false, error: "OneDrive not connected. Please connect OneDrive in Settings." };

  const encodedPath = encodeURIComponent(folderPath).replace(/%2F/g, "/");
  const endpoint = `/me/drive/root:/${encodedPath}:/children?$select=name,folder,file,size,lastModifiedDateTime&$top=200`;

  const result = await graphFetch(token, endpoint);
  if (!result.ok) return { ok: false, error: result.error };

  const items = ((result.data as { value: DriveItem[] })?.value ?? []) as DriveItem[];
  return { ok: true, items };
}

export async function getItem(
  partnerId: string,
  itemPath: string
): Promise<{ ok: boolean; item?: DriveItem; error?: string }> {
  const token = await getToken(partnerId);
  if (!token) return { ok: false, error: "OneDrive not connected. Please connect OneDrive in Settings." };

  const encodedPath = encodeURIComponent(itemPath).replace(/%2F/g, "/");
  const endpoint = `/me/drive/root:/${encodedPath}?$select=name,folder,file,size,lastModifiedDateTime`;

  const result = await graphFetch(token, endpoint);
  if (!result.ok) return { ok: false, error: result.error };

  return { ok: true, item: result.data as DriveItem };
}

export async function createFolder(
  partnerId: string,
  parentPath: string,
  folderName: string
): Promise<{ ok: boolean; error?: string }> {
  const token = await getToken(partnerId);
  if (!token) return { ok: false, error: "OneDrive not connected. Please connect OneDrive in Settings." };

  const encodedPath = encodeURIComponent(parentPath).replace(/%2F/g, "/");
  const endpoint = `/me/drive/root:/${encodedPath}:/children`;

  const result = await graphFetch(token, endpoint, {
    method: "POST",
    body: JSON.stringify({
      name: folderName,
      folder: {},
      "@microsoft.graph.conflictBehavior": "fail",
    }),
  });

  if (!result.ok) {
    if (result.error?.includes("nameAlreadyExists")) return { ok: true };
    return { ok: false, error: result.error };
  }

  return { ok: true };
}

export async function searchFiles(
  partnerId: string,
  query: string,
  folderPath?: string
): Promise<{ ok: boolean; items?: DriveItem[]; error?: string }> {
  const token = await getToken(partnerId);
  if (!token) return { ok: false, error: "OneDrive not connected. Please connect OneDrive in Settings." };

  let endpoint: string;
  if (folderPath) {
    const encodedPath = encodeURIComponent(folderPath).replace(/%2F/g, "/");
    endpoint = `/me/drive/root:/${encodedPath}:/search(q='${encodeURIComponent(query)}')`;
  } else {
    endpoint = `/me/drive/root/search(q='${encodeURIComponent(query)}')`;
  }

  const result = await graphFetch(token, endpoint);
  if (!result.ok) return { ok: false, error: result.error };

  const items = ((result.data as { value: DriveItem[] })?.value ?? []) as DriveItem[];
  return { ok: true, items };
}

export async function uploadFile(
  partnerId: string,
  folderPath: string,
  fileName: string,
  content: Uint8Array,
  contentType: string = "application/octet-stream"
): Promise<{ ok: boolean; webUrl?: string; error?: string }> {
  const token = await getToken(partnerId);
  if (!token) return { ok: false, error: "OneDrive not connected." };

  const encodedPath = encodeURIComponent(`${folderPath}/${fileName}`).replace(/%2F/g, "/");
  const endpoint = `${GRAPH_BASE}/me/drive/root:/${encodedPath}:/content`;

  try {
    const response = await fetch(endpoint, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      body: content as unknown as BodyInit,
    });

    if (!response.ok) {
      const errText = await response.text();
      return { ok: false, error: `Upload failed (${response.status}): ${errText}` };
    }

    const data = await response.json();
    return { ok: true, webUrl: data.webUrl };
  } catch (err) {
    return { ok: false, error: `Upload error: ${err}` };
  }
}

export async function downloadFile(
  partnerId: string,
  filePath: string
): Promise<{ ok: boolean; buffer?: ArrayBuffer; error?: string }> {
  const token = await getToken(partnerId);
  if (!token) return { ok: false, error: "OneDrive not connected." };

  const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, "/");
  const endpoint = `${GRAPH_BASE}/me/drive/root:/${encodedPath}:/content`;

  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const errText = await response.text();
      return { ok: false, error: `Download failed (${response.status}): ${errText}` };
    }

    const arrayBuffer = await response.arrayBuffer();
    return { ok: true, buffer: arrayBuffer };
  } catch (err) {
    return { ok: false, error: `Download error: ${err}` };
  }
}

// ============================================================
// High-level agent operations
// ============================================================

export function buildClientPath(
  clientName: string,
  clientType: "business" | "individual",
  year?: number,
  subfolder?: string
): string {
  const base =
    clientType === "business"
      ? FOLDER_STRUCTURE.business
      : FOLDER_STRUCTURE.individual;

  let path = `${base}/${clientName}`;
  if (year) path += `/${year}`;
  if (subfolder) path += `/${subfolder}`;
  return path;
}

export async function scanClientFolder(
  partnerId: string,
  clientName: string,
  clientType: "business" | "individual",
  year?: number
): Promise<string> {
  const currentYear = year ?? new Date().getFullYear();
  const basePath = buildClientPath(clientName, clientType, currentYear);

  const result = await listFolder(partnerId, basePath);
  if (!result.ok) {
    return `Could not access folder "${basePath}": ${result.error}`;
  }

  const items = result.items ?? [];
  const folders = items.filter((i) => i.folder);
  const files = items.filter((i) => i.file);

  const existingFolders = folders.map((f) => f.name);
  const missingFolders = FOLDER_STRUCTURE.subfolders.filter(
    (sf) => !existingFolders.some((ef) => ef.toLowerCase() === sf.toLowerCase())
  );

  let summary = `Folder: ${basePath}\n\n`;
  summary += `Folders: ${folders.length} | Files: ${files.length}\n\n`;

  if (folders.length > 0) {
    summary += `Subfolders found:\n`;
    for (const f of folders) {
      summary += `  [OK] ${f.name}/ (${f.folder?.childCount ?? 0} items)\n`;
    }
  }

  if (missingFolders.length > 0) {
    summary += `\nMissing standard subfolders:\n`;
    for (const mf of missingFolders) {
      summary += `  [MISSING] ${mf}/\n`;
    }
  }

  if (files.length > 0) {
    summary += `\nFiles at root level:\n`;
    for (const f of files) {
      const modified = new Date(f.lastModifiedDateTime).toLocaleDateString();
      const sizeMB = (f.size / 1024 / 1024).toFixed(1);
      summary += `  ${f.name} (${sizeMB} MB, modified ${modified})\n`;
    }
  }

  return summary;
}

export async function scanSubfolder(
  partnerId: string,
  clientName: string,
  clientType: "business" | "individual",
  subfolder: string,
  year?: number
): Promise<string> {
  const currentYear = year ?? new Date().getFullYear();
  const path = buildClientPath(clientName, clientType, currentYear, subfolder);

  const result = await listFolder(partnerId, path);
  if (!result.ok) {
    return `Could not access "${path}": ${result.error}`;
  }

  const items = result.items ?? [];
  if (items.length === 0) {
    return `Folder: ${path} — Empty folder. No files found.`;
  }

  let summary = `Folder: ${path} — ${items.length} items\n\n`;
  for (const item of items) {
    if (item.folder) {
      summary += `  [DIR] ${item.name}/ (${item.folder.childCount} items)\n`;
    } else {
      const modified = new Date(item.lastModifiedDateTime).toLocaleDateString();
      const sizeMB = (item.size / 1024 / 1024).toFixed(1);
      summary += `  ${item.name} (${sizeMB} MB, modified ${modified})\n`;
    }
  }

  return summary;
}

export async function createClientFolders(
  partnerId: string,
  clientName: string,
  clientType: "business" | "individual",
  year?: number
): Promise<string> {
  const currentYear = year ?? new Date().getFullYear();
  const base =
    clientType === "business"
      ? FOLDER_STRUCTURE.business
      : FOLDER_STRUCTURE.individual;

  let res = await createFolder(partnerId, base, clientName);
  if (!res.ok) return `Error creating client folder: ${res.error}`;

  res = await createFolder(partnerId, `${base}/${clientName}`, String(currentYear));
  if (!res.ok) return `Error creating year folder: ${res.error}`;

  const yearPath = `${base}/${clientName}/${currentYear}`;
  const results: string[] = [];
  for (const subfolder of FOLDER_STRUCTURE.subfolders) {
    const r = await createFolder(partnerId, yearPath, subfolder);
    results.push(r.ok ? `[OK] ${subfolder}` : `[FAIL] ${subfolder}: ${r.error}`);
  }

  return `Created folder structure for ${clientName} (${currentYear}):\nPath: ${yearPath}/\n${results.map((r) => `  ${r}`).join("\n")}`;
}

export async function isConnected(partnerId: string): Promise<boolean> {
  // First try by specific partner
  const { data } = await supabaseAdmin
    .from("microsoft_connections")
    .select("id")
    .eq("partner_id", partnerId)
    .single();
  if (data) return true;

  // Fallback: check if ANY connection exists (small firm — shared OneDrive)
  const { data: anyConn } = await supabaseAdmin
    .from("microsoft_connections")
    .select("id")
    .limit(1)
    .single();
  return !!anyConn;
}

// ============================================================
// OAuth Redirect Flow (uses permanent custom domain)
// ============================================================

const REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || "https://agents.evergrowfin.com"}/api/microsoft/callback`;

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: "https://graph.microsoft.com/Files.ReadWrite.All https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access",
    state,
    response_mode: "query",
    prompt: "select_account", // Force account picker so user can choose a different account
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
}

export async function exchangeCodeForToken(
  code: string,
  partnerId: string
): Promise<{ ok: boolean; email?: string; error?: string }> {
  const MICROSOFT_CLIENT_SECRET = (process.env.MICROSOFT_CLIENT_SECRET ?? "").trim();

  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/common/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        client_secret: MICROSOFT_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        scope: "https://graph.microsoft.com/Files.ReadWrite.All https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access",
      }),
    }
  );

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text();
    console.error("Token exchange failed:", errText);
    return { ok: false, error: "Token exchange failed" };
  }

  const tokenData = await tokenResponse.json();
  return saveConnection(partnerId, tokenData.access_token, tokenData.refresh_token, tokenData.expires_in);
}

// ============================================================
// Email (Outlook) Operations — for shared mailbox triage
// ============================================================

// Use /me/ by default (reads authenticated user's mailbox).
// Set EMAIL_MAILBOX env var to target a specific shared mailbox instead.
const EMAIL_MAILBOX = process.env.EMAIL_MAILBOX ?? "";

export type EmailMessage = {
  id: string;
  subject: string;
  from: { emailAddress: { name: string; address: string } };
  receivedDateTime: string;
  isRead: boolean;
  bodyPreview: string;
  body?: { contentType: string; content: string };
  hasAttachments: boolean;
  parentFolderId: string;
  toRecipients?: { emailAddress: { name: string; address: string } }[];
};

export type MailFolder = {
  id: string;
  displayName: string;
  parentFolderId: string;
  childFolderCount: number;
  totalItemCount: number;
  unreadItemCount: number;
};

/**
 * List emails in a folder (defaults to Inbox).
 * Uses the shared mailbox specified in EMAIL_MAILBOX.
 */
export async function listEmails(
  partnerId: string,
  options: {
    folderId?: string;
    top?: number;
    unreadOnly?: boolean;
    since?: string; // ISO date string
  } = {}
): Promise<{ ok: boolean; emails?: EmailMessage[]; error?: string }> {
  const token = await getToken(partnerId);
  if (!token) return { ok: false, error: "Microsoft not connected." };

  const folder = options.folderId ?? "inbox";
  const top = options.top ?? 25;

  let filter = "";
  const filters: string[] = [];
  if (options.unreadOnly) filters.push("isRead eq false");
  if (options.since) filters.push(`receivedDateTime ge ${options.since}`);
  if (filters.length > 0) filter = `&$filter=${encodeURIComponent(filters.join(" and "))}`;

  const endpoint = `${GRAPH_BASE}/${EMAIL_MAILBOX ? `users/${EMAIL_MAILBOX}` : "me"}/mailFolders/${folder}/messages?$select=id,subject,from,receivedDateTime,isRead,bodyPreview,hasAttachments,parentFolderId,toRecipients&$orderby=receivedDateTime desc&$top=${top}${filter}`;

  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const errText = await response.text();
      return { ok: false, error: `Failed to list emails (${response.status}): ${errText}` };
    }

    const data = await response.json();
    return { ok: true, emails: data.value as EmailMessage[] };
  } catch (err) {
    return { ok: false, error: `Email list error: ${err}` };
  }
}

/**
 * Read a single email's full content.
 */
export async function readEmail(
  partnerId: string,
  messageId: string
): Promise<{ ok: boolean; email?: EmailMessage; error?: string }> {
  const token = await getToken(partnerId);
  if (!token) return { ok: false, error: "Microsoft not connected." };

  const endpoint = `${GRAPH_BASE}/${EMAIL_MAILBOX ? `users/${EMAIL_MAILBOX}` : "me"}/messages/${messageId}?$select=id,subject,from,receivedDateTime,isRead,bodyPreview,body,hasAttachments,parentFolderId,toRecipients`;

  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const errText = await response.text();
      return { ok: false, error: `Failed to read email (${response.status}): ${errText}` };
    }

    const email = await response.json();
    return { ok: true, email: email as EmailMessage };
  } catch (err) {
    return { ok: false, error: `Email read error: ${err}` };
  }
}

/**
 * Move an email to a specific folder.
 */
export async function moveEmail(
  partnerId: string,
  messageId: string,
  destinationFolderId: string
): Promise<{ ok: boolean; error?: string }> {
  const token = await getToken(partnerId);
  if (!token) return { ok: false, error: "Microsoft not connected." };

  const endpoint = `${GRAPH_BASE}/${EMAIL_MAILBOX ? `users/${EMAIL_MAILBOX}` : "me"}/messages/${messageId}/move`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ destinationId: destinationFolderId }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { ok: false, error: `Failed to move email (${response.status}): ${errText}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Email move error: ${err}` };
  }
}

/**
 * Mark an email as read.
 */
export async function markEmailRead(
  partnerId: string,
  messageId: string
): Promise<{ ok: boolean; error?: string }> {
  const token = await getToken(partnerId);
  if (!token) return { ok: false, error: "Microsoft not connected." };

  const endpoint = `${GRAPH_BASE}/${EMAIL_MAILBOX ? `users/${EMAIL_MAILBOX}` : "me"}/messages/${messageId}`;

  try {
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isRead: true }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { ok: false, error: `Failed to mark read (${response.status}): ${errText}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Mark read error: ${err}` };
  }
}

/**
 * List mail folders (top-level or children of a folder).
 */
export async function listMailFolders(
  partnerId: string,
  parentFolderId?: string
): Promise<{ ok: boolean; folders?: MailFolder[]; error?: string }> {
  const token = await getToken(partnerId);
  if (!token) return { ok: false, error: "Microsoft not connected." };

  const endpoint = parentFolderId
    ? `${GRAPH_BASE}/${EMAIL_MAILBOX ? `users/${EMAIL_MAILBOX}` : "me"}/mailFolders/${parentFolderId}/childFolders?$top=50`
    : `${GRAPH_BASE}/${EMAIL_MAILBOX ? `users/${EMAIL_MAILBOX}` : "me"}/mailFolders?$top=50`;

  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const errText = await response.text();
      return { ok: false, error: `Failed to list folders (${response.status}): ${errText}` };
    }

    const data = await response.json();
    return { ok: true, folders: data.value as MailFolder[] };
  } catch (err) {
    return { ok: false, error: `Folder list error: ${err}` };
  }
}

/**
 * Create a mail folder. Can create top-level or nested folders.
 */
export async function createMailFolder(
  partnerId: string,
  displayName: string,
  parentFolderId?: string
): Promise<{ ok: boolean; folder?: MailFolder; error?: string }> {
  const token = await getToken(partnerId);
  if (!token) return { ok: false, error: "Microsoft not connected." };

  const endpoint = parentFolderId
    ? `${GRAPH_BASE}/${EMAIL_MAILBOX ? `users/${EMAIL_MAILBOX}` : "me"}/mailFolders/${parentFolderId}/childFolders`
    : `${GRAPH_BASE}/${EMAIL_MAILBOX ? `users/${EMAIL_MAILBOX}` : "me"}/mailFolders`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ displayName }),
    });

    if (!response.ok) {
      const errText = await response.text();
      // If folder already exists, try to find it
      if (errText.includes("already exists") || response.status === 409) {
        const list = await listMailFolders(partnerId, parentFolderId);
        const existing = list.folders?.find(
          (f) => f.displayName.toLowerCase() === displayName.toLowerCase()
        );
        if (existing) return { ok: true, folder: existing };
      }
      return { ok: false, error: `Failed to create folder (${response.status}): ${errText}` };
    }

    const folder = await response.json();
    return { ok: true, folder: folder as MailFolder };
  } catch (err) {
    return { ok: false, error: `Create folder error: ${err}` };
  }
}

/**
 * Find a mail folder by name (searches top-level and one level of children).
 */
export async function findMailFolder(
  partnerId: string,
  folderName: string
): Promise<{ ok: boolean; folder?: MailFolder; error?: string }> {
  const token = await getToken(partnerId);
  if (!token) return { ok: false, error: "Microsoft not connected." };

  // Search top-level
  const topLevel = await listMailFolders(partnerId);
  if (!topLevel.ok) return topLevel;

  const lowerName = folderName.toLowerCase();
  let match = topLevel.folders?.find(
    (f) => f.displayName.toLowerCase() === lowerName
  );
  if (match) return { ok: true, folder: match };

  // Search children of top-level folders
  for (const parent of topLevel.folders ?? []) {
    if (parent.childFolderCount > 0) {
      const children = await listMailFolders(partnerId, parent.id);
      match = children.folders?.find(
        (f) => f.displayName.toLowerCase() === lowerName
      );
      if (match) return { ok: true, folder: match };
    }
  }

  return { ok: false, error: `Folder "${folderName}" not found` };
}

/**
 * Send an email from the connected mailbox.
 */
export async function sendEmail(
  partnerId: string,
  options: {
    to: { name: string; address: string }[];
    cc?: { name: string; address: string }[];
    subject: string;
    body: string;
    bodyType?: "Text" | "HTML";
  }
): Promise<{ ok: boolean; error?: string }> {
  const token = await getToken(partnerId);
  if (!token) return { ok: false, error: "Microsoft not connected." };

  const mailboxPath = EMAIL_MAILBOX ? `users/${EMAIL_MAILBOX}` : "me";
  const endpoint = `${GRAPH_BASE}/${mailboxPath}/sendMail`;

  const message = {
    subject: options.subject,
    body: {
      contentType: options.bodyType ?? "HTML",
      content: options.body,
    },
    toRecipients: options.to.map((r) => ({
      emailAddress: { name: r.name, address: r.address },
    })),
    ...(options.cc && {
      ccRecipients: options.cc.map((r) => ({
        emailAddress: { name: r.name, address: r.address },
      })),
    }),
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, saveToSentItems: true }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { ok: false, error: `Failed to send email (${response.status}): ${errText}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Send email error: ${err}` };
  }
}

/**
 * Batch move + mark-read for multiple emails in parallel.
 * Processes in chunks of 10 to avoid throttling.
 */
export async function batchMoveEmails(
  partnerId: string,
  operations: { messageId: string; destinationFolderId: string }[],
  markRead = true
): Promise<{ ok: boolean; success: number; failed: number; errors: string[] }> {
  const token = await getToken(partnerId);
  if (!token) return { ok: false, success: 0, failed: operations.length, errors: ["Microsoft not connected."] };

  const mailboxPath = EMAIL_MAILBOX ? `users/${EMAIL_MAILBOX}` : "me";
  const CHUNK_SIZE = 10;
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  // Process in parallel chunks
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE);

    const results = await Promise.allSettled(
      chunk.map(async (op) => {
        // Mark as read first (before move, since move may change the message ID)
        if (markRead) {
          await fetch(`${GRAPH_BASE}/${mailboxPath}/messages/${op.messageId}`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ isRead: true }),
          }).catch(() => {}); // Non-critical
        }

        // Move to destination folder
        const moveRes = await fetch(
          `${GRAPH_BASE}/${mailboxPath}/messages/${op.messageId}/move`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ destinationId: op.destinationFolderId }),
          }
        );

        if (!moveRes.ok) {
          const errText = await moveRes.text();
          throw new Error(`Move failed (${moveRes.status}): ${errText}`);
        }
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        success++;
      } else {
        failed++;
        errors.push(r.reason?.message ?? "Unknown error");
      }
    }
  }

  return { ok: true, success, failed, errors };
}

export { REDIRECT_URI };
