/**
 * Debug endpoint — shows the shape of env vars (not full values) to diagnose
 * whitespace, truncation, or missing vars. Safe to call, reveals no secrets.
 */

import { NextResponse } from "next/server";

function mask(value: string | undefined, visibleChars = 4): string {
  if (!value) return "MISSING";
  const trimmed = value.trim();
  if (trimmed.length < visibleChars * 2) return `TOO SHORT (${trimmed.length} chars)`;
  return `${trimmed.slice(0, visibleChars)}...${trimmed.slice(-visibleChars)} (len=${trimmed.length}, raw_len=${value.length})`;
}

export async function GET() {
  const vars = {
    ANTHROPIC_API_KEY: mask(process.env.ANTHROPIC_API_KEY),
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "MISSING",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: mask(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: mask(process.env.SUPABASE_SERVICE_ROLE_KEY),
    MICROSOFT_CLIENT_ID: mask(process.env.MICROSOFT_CLIENT_ID, 8),
    MICROSOFT_CLIENT_SECRET: mask(process.env.MICROSOFT_CLIENT_SECRET),
    MICROSOFT_TENANT_ID: mask(process.env.MICROSOFT_TENANT_ID, 8),
    CRON_SECRET: mask(process.env.CRON_SECRET, 2),
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "MISSING",
    NODE_ENV: process.env.NODE_ENV,
  };

  return NextResponse.json({
    message: "Env var diagnostic (values masked)",
    notes: "If raw_len > len, the value has trailing whitespace. ANTHROPIC_API_KEY should be ~108 chars.",
    vars,
  });
}
