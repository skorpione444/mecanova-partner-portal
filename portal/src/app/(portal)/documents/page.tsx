"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Document as DocRow, UserRole } from "@/lib/supabase/types";
import {
  FileText,
  ShieldCheck,
  Receipt,
  Truck,
  DollarSign,
  Megaphone,
  Globe,
  Building2,
  Download,
  FolderOpen,
} from "lucide-react";

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  compliance: {
    label: "Compliance",
    icon: ShieldCheck,
    color: "var(--mc-success)",
  },
  invoice: {
    label: "Invoice",
    icon: Receipt,
    color: "var(--mc-foreground)",
  },
  delivery_note: {
    label: "Delivery Note",
    icon: Truck,
    color: "var(--mc-info)",
  },
  price_list: {
    label: "Price List",
    icon: DollarSign,
    color: "var(--mc-foreground)",
  },
  marketing: {
    label: "Marketing",
    icon: Megaphone,
    color: "var(--mc-warning)",
  },
};

export default function DocumentsPage() {
  const [sharedDocs, setSharedDocs] = useState<DocRow[]>([]);
  const [partnerDocs, setPartnerDocs] = useState<DocRow[]>([]);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, partner_id")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        setRole(profile.role);
      }

      const { data: shared } = await supabase
        .from("documents")
        .select("*")
        .eq("is_shared", true)
        .order("created_at", { ascending: false });

      if (shared) setSharedDocs(shared);

      if (profile?.partner_id) {
        const { data: partner } = await supabase
          .from("documents")
          .select("*")
          .eq("partner_id", profile.partner_id)
          .eq("is_shared", false)
          .order("created_at", { ascending: false });

        if (partner) setPartnerDocs(partner);
      } else if (profile?.role === "admin") {
        const { data: allPartner } = await supabase
          .from("documents")
          .select("*")
          .eq("is_shared", false)
          .order("created_at", { ascending: false });

        if (allPartner) setPartnerDocs(allPartner);
      }

      setLoading(false);
    };

    load();
  }, [supabase]);

  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString("de-DE", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";

  const renderDocGrid = (docs: DocRow[], emptyMsg: string) => {
    if (docs.length === 0) {
      return (
        <div className="mc-card p-16 text-center">
          <FolderOpen
            className="w-10 h-10 mx-auto mb-4"
            style={{ color: "var(--mc-text-muted)" }}
            strokeWidth={1}
          />
          <p
            className="text-base font-medium mb-1"
            style={{
              color: "var(--mc-text-secondary)",
              fontFamily: "var(--font-jost), sans-serif",
            }}
          >
            No documents available
          </p>
          <p className="text-sm" style={{ color: "var(--mc-text-muted)" }}>
            {emptyMsg}
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mc-stagger">
        {docs.map((doc) => {
          const typeConf = TYPE_CONFIG[doc.type] || {
            label: doc.type,
            icon: FileText,
            color: "var(--mc-text-tertiary)",
          };
          const TypeIcon = typeConf.icon;

          return (
            <div key={doc.id} className="mc-card mc-card-lift p-5 group">
              <div className="flex items-start gap-3.5">
                {/* Icon */}
                <div
                  className="w-10 h-10 flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105"
                  style={{
                    background: `${typeConf.color}10`,
                    color: typeConf.color,
                  }}
                >
                  <TypeIcon className="w-5 h-5" strokeWidth={1.5} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate mb-0.5"
                    style={{ color: "var(--mc-text-primary)" }}
                  >
                    {doc.title}
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs px-2 py-0.5 font-medium"
                      style={{
                        background: `${typeConf.color}10`,
                        color: typeConf.color,
                      }}
                    >
                      {typeConf.label}
                    </span>
                    <span
                      className="text-xs"
                      style={{
                        color: "var(--mc-text-muted)",
                        fontFamily:
                          "var(--font-jetbrains), monospace",
                        fontSize: "0.6875rem",
                      }}
                    >
                      {formatDate(doc.updated_at || doc.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Download action */}
              <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--mc-border)" }}>
                <button
                  className="mc-btn mc-btn-ghost w-full py-2 text-xs justify-center gap-1.5"
                  onClick={() => {
                    // Future: implement download
                  }}
                >
                  <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Download
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <div className="mc-skeleton h-8 w-40 mb-3" />
          <div className="mc-skeleton h-5 w-72" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="mc-card p-5">
              <div className="flex items-start gap-3.5">
                <div className="mc-skeleton w-10 h-10" />
                <div className="flex-1">
                  <div className="mc-skeleton h-4 w-32 mb-2" />
                  <div className="mc-skeleton h-3 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1
          className="text-3xl font-semibold tracking-tight"
          style={{
            fontFamily: "var(--font-jost), sans-serif",
            color: "var(--mc-text-primary)",
          }}
        >
          Documents
        </h1>
        <p
          className="mt-2 text-sm"
          style={{
            color: "var(--mc-text-tertiary)",
            fontFamily: "var(--font-manrope), sans-serif",
          }}
        >
          Compliance, marketing, and partner-specific resources
        </p>
      </div>

      {/* Shared Documents */}
      <section>
        <div className="flex items-center gap-2.5 mb-5">
          <div
            className="w-8 h-8 flex items-center justify-center"
            style={{
              background: "rgba(236, 223, 204, 0.08)",
              color: "var(--mc-foreground)",
            }}
          >
            <Globe className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <h2
            className="text-lg font-semibold"
            style={{
              fontFamily: "var(--font-jost), sans-serif",
              color: "var(--mc-text-primary)",
            }}
          >
            Shared Documents
          </h2>
          {sharedDocs.length > 0 && (
            <span
              className="text-xs px-2 py-0.5 font-medium"
              style={{
                background: "var(--mc-secondary)",
                color: "var(--mc-text-tertiary)",
              }}
            >
              {sharedDocs.length}
            </span>
          )}
        </div>
        {renderDocGrid(sharedDocs, "Shared documents will appear here.")}
      </section>

      {/* Partner Documents */}
      <section>
        <div className="flex items-center gap-2.5 mb-5">
          <div
            className="w-8 h-8 flex items-center justify-center"
            style={{
              background: "rgba(236, 223, 204, 0.08)",
              color: "var(--mc-foreground)",
            }}
          >
            <Building2 className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <h2
            className="text-lg font-semibold"
            style={{
              fontFamily: "var(--font-jost), sans-serif",
              color: "var(--mc-text-primary)",
            }}
          >
            {role === "admin" ? "All Partner Documents" : "Your Documents"}
          </h2>
          {partnerDocs.length > 0 && (
            <span
              className="text-xs px-2 py-0.5 font-medium"
              style={{
                background: "var(--mc-secondary)",
                color: "var(--mc-text-tertiary)",
              }}
            >
              {partnerDocs.length}
            </span>
          )}
        </div>
        {renderDocGrid(
          partnerDocs,
          role === "admin"
            ? "No partner documents found."
            : "Documents for your account will appear here."
        )}
      </section>
    </div>
  );
}
