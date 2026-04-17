import { exchangeCodeForToken } from "@/lib/microsoft/graph-client";
import { NextRequest, NextResponse } from "next/server";

// OAuth callback: Microsoft redirects here after user signs in
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // This is the partner_id
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const baseUrl = "https://agents.evergrowfin.com";

  if (error) {
    console.error("OAuth error from Microsoft:", error, errorDescription);
    return NextResponse.redirect(
      `${baseUrl}/settings?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    console.error("Missing code or state in callback", { code: !!code, state: !!state });
    return NextResponse.redirect(`${baseUrl}/settings?error=missing_code`);
  }

  console.log("Exchanging code for token, partner_id:", state);
  const result = await exchangeCodeForToken(code, state);

  if (!result.ok) {
    console.error("Token exchange failed:", result.error);
    return NextResponse.redirect(
      `${baseUrl}/settings?error=${encodeURIComponent(result.error || "connection_failed")}`
    );
  }

  console.log("OneDrive connected successfully for:", result.email);
  return NextResponse.redirect(`${baseUrl}/settings?success=onedrive_connected`);
}
