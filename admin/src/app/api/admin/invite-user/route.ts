import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  // Verify caller is admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { email, partner_id, role } = body;

  if (!email || !partner_id) {
    return NextResponse.json(
      { error: "Email and partner_id are required" },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();

  // Create user via admin API
  const { data: newUser, error: createError } =
    await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { partner_id, role: role || "partner" },
    });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  if (!newUser.user) {
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }

  // Create profile
  const { error: profileError } = await adminClient.from("profiles").insert({
    user_id: newUser.user.id,
    partner_id,
    role: role || "partner",
    full_name: email.split("@")[0],
  });

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message },
      { status: 500 }
    );
  }

  // Generate password reset link so the user can set their password
  const { data: linkData, error: linkError } =
    await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

  return NextResponse.json({
    success: true,
    user_id: newUser.user.id,
    magic_link: linkData && !linkError ? linkData.properties?.action_link : null,
  });
}




