"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Package,
  Layers,
  FileText,
  Truck,
  DollarSign,
  Contact,
  Scale,
  Search,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";

interface AdminShellProps {
  children: React.ReactNode;
}

const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/kpis", label: "KPIs", icon: BarChart3 },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/partners", label: "Partners", icon: Users },
      { href: "/products", label: "Products", icon: Package },
      { href: "/operations", label: "Operations", icon: Layers },
      { href: "/documents", label: "Documents", icon: FileText },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/logistics", label: "Logistics", icon: Truck },
      { href: "/finance", label: "Finance", icon: DollarSign },
      { href: "/crm", label: "CRM", icon: Contact },
      { href: "/contracts", label: "Contracts", icon: Scale },
      { href: "/research", label: "Research", icon: Search },
    ],
  },
  {
    label: "System",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

export default function AdminShell({ children }: AdminShellProps) {
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    const loadSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setEmail(user.email || null);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name);
      }

      setLoading(false);
    };

    loadSession();
  }, [router, supabase]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/login");
  }, [supabase, router]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--mc-charcoal)" }}
      >
        <div className="flex flex-col items-center gap-4 mc-animate-fade">
          <div
            className="w-5 h-5 border border-transparent animate-spin"
            style={{ borderTopColor: "var(--mc-cream)" }}
          />
          <p
            className="text-[10px] tracking-[0.1em] uppercase"
            style={{ color: "var(--mc-cream-faint)" }}
          >
            Loading...
          </p>
        </div>
      </div>
    );
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname?.startsWith(href) || false;
  };

  const displayName = fullName || email || "Admin";
  const initials = (fullName || email || "A")
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");

  return (
    <div className="min-h-screen" style={{ background: "var(--mc-charcoal)" }}>
      {/* Mobile top bar */}
      <div
        className="lg:hidden flex items-center justify-between px-4 py-3"
        style={{
          background: "var(--mc-black)",
          borderBottom: "1px solid var(--mc-sidebar-border)",
        }}
      >
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5"
          style={{ color: "var(--mc-sidebar-text)" }}
          aria-label="Toggle menu"
        >
          {sidebarOpen ? (
            <X className="w-5 h-5" strokeWidth={1.5} />
          ) : (
            <Menu className="w-5 h-5" strokeWidth={1.5} />
          )}
        </button>
        <span
          className="text-xs font-light tracking-[0.2em] uppercase"
          style={{
            fontFamily: "var(--font-jost), Jost, sans-serif",
            color: "var(--mc-cream)",
          }}
        >
          Mecanova Admin
        </span>
        <div className="w-8" />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          style={{ background: "rgba(10, 11, 13, 0.8)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50 w-[220px] h-screen transform ${
            sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0"
          } transition-transform duration-300 ease-in-out overflow-y-auto`}
          style={{
            background: "var(--mc-sidebar)",
            borderRight: "1px solid var(--mc-sidebar-border)",
          }}
        >
          <div className="h-full flex flex-col">
            {/* Brand */}
            <div
              className="px-5 py-5 flex-shrink-0"
              style={{ borderBottom: "1px solid var(--mc-sidebar-border)" }}
            >
              <h1
                className="text-xs font-light tracking-[0.25em] uppercase"
                style={{
                  fontFamily: "var(--font-jost), Jost, sans-serif",
                  color: "var(--mc-cream)",
                }}
              >
                Mecanova
              </h1>
              <p
                className="text-[8px] tracking-[0.12em] uppercase mt-0.5"
                style={{ color: "var(--mc-cream-faint)" }}
              >
                Administration
              </p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-3 overflow-y-auto">
              {NAV_SECTIONS.map((section) => (
                <div key={section.label} className="mb-1">
                  <p
                    className="px-5 py-1.5 text-[9px] font-semibold tracking-[0.1em] uppercase"
                    style={{ color: "var(--mc-cream-faint)" }}
                  >
                    {section.label}
                  </p>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className="group flex items-center gap-2.5 mx-2 px-3 py-2 text-[12px] transition-all duration-200 relative"
                        style={{
                          background: active
                            ? "var(--mc-sidebar-active)"
                            : "transparent",
                          color: active
                            ? "var(--mc-sidebar-text-active)"
                            : "var(--mc-sidebar-text)",
                          borderLeft: active
                            ? "2px solid var(--mc-cream)"
                            : "2px solid transparent",
                        }}
                        onMouseEnter={(e) => {
                          if (!active) {
                            e.currentTarget.style.color =
                              "var(--mc-cream-muted)";
                            e.currentTarget.style.background =
                              "var(--mc-sidebar-hover)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!active) {
                            e.currentTarget.style.color =
                              "var(--mc-sidebar-text)";
                            e.currentTarget.style.background = "transparent";
                          }
                        }}
                      >
                        <Icon
                          className="w-[14px] h-[14px] flex-shrink-0"
                          strokeWidth={active ? 2 : 1.5}
                        />
                        <span
                          className="font-medium tracking-wide flex-1"
                          style={{
                            fontFamily:
                              "var(--font-manrope), Manrope, sans-serif",
                          }}
                        >
                          {item.label}
                        </span>
                        {active && (
                          <ChevronRight
                            className="w-3 h-3 opacity-40"
                            strokeWidth={2}
                          />
                        )}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>

            {/* User section */}
            <div
              className="px-4 py-3 flex-shrink-0"
              style={{ borderTop: "1px solid var(--mc-sidebar-border)" }}
            >
              <div className="flex items-center gap-2.5 px-1 mb-2">
                <div
                  className="w-7 h-7 flex items-center justify-center flex-shrink-0 text-[9px] font-semibold tracking-wider"
                  style={{
                    background: "var(--mc-graphite)",
                    color: "var(--mc-cream-dark)",
                    border: "1px solid var(--mc-border)",
                  }}
                >
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[11px] font-medium truncate"
                    style={{ color: "var(--mc-cream-muted)" }}
                  >
                    {displayName}
                  </p>
                  <p
                    className="text-[9px] truncate tracking-wide uppercase"
                    style={{ color: "var(--mc-cream-faint)" }}
                  >
                    Administrator
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-[11px] transition-all duration-200 tracking-wide"
                style={{ color: "var(--mc-sidebar-text)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--mc-sidebar-hover)";
                  e.currentTarget.style.color = "var(--mc-error)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--mc-sidebar-text)";
                }}
              >
                <LogOut className="w-[13px] h-[13px]" strokeWidth={1.5} />
                Sign out
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 min-h-screen">
          <div className="max-w-7xl mx-auto px-5 lg:px-8 py-6 lg:py-8">
            <div className="mc-animate-page">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}




