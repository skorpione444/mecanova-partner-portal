"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import type { Profile } from "@mecanova/shared";
import { Settings, User } from "lucide-react";

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email || null);

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      setProfile(data);
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div>
        <div className="mc-skeleton h-8 w-48 mb-6" />
        <div className="mc-skeleton h-48 max-w-lg" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="System configuration and account settings"
        icon={Settings}
      />

      <div className="max-w-lg space-y-5">
        {/* Account info */}
        <div className="mc-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <User
              className="w-4 h-4"
              style={{ color: "var(--mc-text-muted)" }}
            />
            <h3
              className="text-xs font-semibold tracking-[0.08em] uppercase"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Account
            </h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="mc-label">Email</p>
              <p className="text-sm">{email}</p>
            </div>
            <div>
              <p className="mc-label">Name</p>
              <p className="text-sm">
                {profile?.full_name || (
                  <span style={{ color: "var(--mc-text-muted)" }}>Not set</span>
                )}
              </p>
            </div>
            <div>
              <p className="mc-label">Role</p>
              <span
                className="inline-flex px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
                style={{
                  background: "rgba(236, 223, 204, 0.08)",
                  border: "1px solid var(--mc-border-warm)",
                  color: "var(--mc-cream)",
                }}
              >
                {profile?.role || "admin"}
              </span>
            </div>
          </div>
        </div>

        {/* System info */}
        <div className="mc-card p-5">
          <h3
            className="text-xs font-semibold tracking-[0.08em] uppercase mb-4"
            style={{ color: "var(--mc-text-muted)" }}
          >
            System
          </h3>
          <div className="space-y-3">
            <div>
              <p className="mc-label">Environment</p>
              <p className="text-sm">
                {process.env.NODE_ENV === "production"
                  ? "Production"
                  : "Development"}
              </p>
            </div>
            <div>
              <p className="mc-label">Supabase URL</p>
              <p className="text-xs font-mono" style={{ color: "var(--mc-text-muted)" }}>
                {process.env.NEXT_PUBLIC_SUPABASE_URL || "Not configured"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



