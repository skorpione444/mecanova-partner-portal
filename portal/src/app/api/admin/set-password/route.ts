import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin endpoint to set user passwords directly
 * Bypasses Supabase recovery email throttling
 * 
 * Security:
 * - Protected by ADMIN_TOOL_TOKEN Bearer auth
 * - Uses Supabase Admin API (service role key)
 * - Server-only, never exposes secrets to client
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify Authorization Bearer token
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.ADMIN_TOOL_TOKEN;

    if (!expectedToken) {
      console.error("[ADMIN SET-PASSWORD] ADMIN_TOOL_TOKEN not configured");
      return NextResponse.json(
        { ok: false, error: "Admin tool not configured" },
        { status: 500 }
      );
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const providedToken = authHeader.substring(7); // Remove "Bearer " prefix

    // Use constant-time comparison to prevent timing attacks
    if (providedToken !== expectedToken) {
      return NextResponse.json(
        { ok: false, error: "Invalid authorization token" },
        { status: 401 }
      );
    }

    // 2. Parse request body
    let body;
    try {
      body = await request.json();
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { email, newPassword } = body;

    // 3. Validate input
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid email" },
        { status: 400 }
      );
    }

    if (!newPassword || typeof newPassword !== "string") {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid newPassword" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { ok: false, error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // 4. Create admin client and find user by email
    const adminClient = createAdminClient();

    // List users and find by email
    // Note: Supabase Admin API doesn't have a direct "getUserByEmail" method
    // We need to list users and filter
    const { data: users, error: listError } = await adminClient.auth.admin.listUsers();

    if (listError) {
      console.error("[ADMIN SET-PASSWORD] Error listing users:", listError.message);
      return NextResponse.json(
        { ok: false, error: "Failed to find user" },
        { status: 500 }
      );
    }

    // Find user by email (case-insensitive)
    const user = users.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!user) {
      return NextResponse.json(
        { ok: false, error: `User not found: ${email}` },
        { status: 404 }
      );
    }

    // 5. Update user password using Admin API
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      user.id,
      {
        password: newPassword,
      }
    );

    if (updateError) {
      console.error("[ADMIN SET-PASSWORD] Error updating password:", updateError.message);
      return NextResponse.json(
        { ok: false, error: `Failed to update password: ${updateError.message}` },
        { status: 500 }
      );
    }

    // 6. Success - return clean response (never log secrets)
    return NextResponse.json(
      { ok: true },
      { status: 200 }
    );
  } catch (error) {
    // Catch any unexpected errors
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[ADMIN SET-PASSWORD] Unexpected error:", errorMessage);
    
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Only allow POST requests
export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Method not allowed. Use POST." },
    { status: 405 }
  );
}





