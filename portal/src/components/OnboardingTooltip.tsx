"use client";

import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, Lightbulb } from "lucide-react";
import type { UserRole } from "@mecanova/shared";

interface TooltipStep {
  target: string; // CSS selector or nav item label
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
}

const DISTRIBUTOR_STEPS: TooltipStep[] = [
  {
    target: "Dashboard",
    title: "Dashboard",
    description: "Your home base. See open invoices, quick links, and inventory overview at a glance.",
  },
  {
    target: "Products",
    title: "Products & Documents",
    description: "Browse the product catalogue and access marketing documents, fact sheets, and compliance files.",
  },
  {
    target: "Orders",
    title: "Orders",
    description: "Manage orders from your clients and place new orders from Mecanova. Accept, reject, and track deliveries.",
  },
  {
    target: "Inventory",
    title: "Inventory",
    description: "Track your stock levels, make adjustments, and view movement history for all products.",
  },
  {
    target: "Invoices",
    title: "Invoices",
    description: "Create and manage invoices for your clients. Track payment status and send reminders.",
  },
  {
    target: "Analytics",
    title: "Analytics",
    description: "View performance metrics: acceptance rates, revenue, top products, and order trends.",
  },
];

const CLIENT_STEPS: TooltipStep[] = [
  {
    target: "Dashboard",
    title: "Dashboard",
    description: "Your home base. See open invoices, product availability, and quick links.",
  },
  {
    target: "Products",
    title: "Products & Documents",
    description: "Browse available products and access marketing documents from your distributor.",
  },
  {
    target: "Orders",
    title: "Orders",
    description: "Place new orders and track their status from submission to delivery.",
  },
  {
    target: "Invoices",
    title: "Invoices",
    description: "View invoices from your distributor and track payment status.",
  },
  {
    target: "Analytics",
    title: "Analytics",
    description: "View your ordering metrics: acceptance rates, spending, and top products.",
  },
];

const STORAGE_KEY = "mecanova_onboarding_complete";

interface OnboardingTooltipProps {
  role: UserRole | null;
}

export default function OnboardingTooltip({ role }: OnboardingTooltipProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  const steps = role === "distributor" ? DISTRIBUTOR_STEPS : CLIENT_STEPS;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !role) return;
    try {
      const completed = localStorage.getItem(STORAGE_KEY);
      if (completed) return;
    } catch { return; }
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, [role, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [mounted]);

  useEffect(() => {
    if (!visible || !steps[currentStep]) return;

    const target = steps[currentStep].target;
    // Find the nav link that contains this label text
    const links = document.querySelectorAll("nav a");
    let targetEl: Element | null = null;
    links.forEach((link) => {
      if (link.textContent?.trim() === target) {
        targetEl = link;
      }
    });

    if (targetEl && !isMobile) {
      const rect = (targetEl as HTMLElement).getBoundingClientRect();
      setTooltipPos({
        top: rect.top + rect.height / 2,
        left: rect.right + 16,
      });

      // Add highlight
      (targetEl as HTMLElement).style.outline = "2px solid var(--mc-cream)";
      (targetEl as HTMLElement).style.outlineOffset = "2px";
      (targetEl as HTMLElement).style.zIndex = "60";
      (targetEl as HTMLElement).style.position = "relative";

      return () => {
        (targetEl as HTMLElement).style.outline = "";
        (targetEl as HTMLElement).style.outlineOffset = "";
        (targetEl as HTMLElement).style.zIndex = "";
        (targetEl as HTMLElement).style.position = "";
      };
    }
  }, [visible, currentStep, steps, isMobile]);

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!mounted || !visible || !steps[currentStep]) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  // Ensure tooltip doesn't go off screen (desktop only)
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
  const adjustedTop = isMobile ? 0 : Math.max(80, Math.min(tooltipPos.top - 40, viewportHeight - 200));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[55]"
        style={{ background: "rgba(10, 11, 13, 0.5)", pointerEvents: "auto" }}
        onClick={handleComplete}
      />

      {/* Tooltip */}
      <div
        className={`fixed z-[60] mc-animate-fade ${
          isMobile
            ? "inset-x-4 top-1/2 -translate-y-1/2"
            : ""
        }`}
        style={
          isMobile
            ? { maxWidth: "400px", margin: "0 auto", pointerEvents: "auto" }
            : {
                top: adjustedTop,
                left: Math.max(240, tooltipPos.left),
                maxWidth: "320px",
                width: "calc(100vw - 260px)",
                pointerEvents: "auto",
              }
        }
      >
        <div
          className="p-4"
          style={{
            background: "var(--mc-card)",
            border: "1px solid var(--mc-cream-faint)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-3.5 h-3.5" style={{ color: "var(--mc-warning)" }} strokeWidth={1.5} />
              <span
                className="text-[10px] font-semibold tracking-[0.08em] uppercase"
                style={{ color: "var(--mc-cream-faint)" }}
              >
                Step {currentStep + 1} of {steps.length}
              </span>
            </div>
            <button
              onClick={handleComplete}
              className="p-0.5 transition-colors"
              style={{ color: "var(--mc-text-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-text-muted)")}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Content */}
          <h4
            className="text-sm font-semibold mb-1"
            style={{ fontFamily: "var(--font-jost), Jost, sans-serif", color: "var(--mc-text-primary)" }}
          >
            {step.title}
          </h4>
          <p className="text-xs leading-relaxed" style={{ color: "var(--mc-text-secondary)" }}>
            {step.description}
          </p>

          {/* Progress dots */}
          <div className="flex items-center gap-1 mt-3 mb-3">
            {steps.map((_, i) => (
              <div
                key={i}
                className="h-1 transition-all"
                style={{
                  width: i === currentStep ? "16px" : "6px",
                  background: i === currentStep ? "var(--mc-cream)" : "var(--mc-border)",
                }}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleComplete}
              className="text-[10px] tracking-wide uppercase transition-colors"
              style={{ color: "var(--mc-text-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mc-cream)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mc-text-muted)")}
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={handlePrev}
                  className="mc-btn text-[11px] py-1 px-2.5 inline-flex items-center gap-1"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--mc-border)",
                    color: "var(--mc-text-secondary)",
                  }}
                >
                  <ChevronLeft className="w-3 h-3" />
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                className="mc-btn mc-btn-primary text-[11px] py-1 px-2.5 inline-flex items-center gap-1"
              >
                {isLast ? "Finish" : "Next"}
                {!isLast && <ChevronRight className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* Arrow pointing left to nav item (desktop only) */}
        {!isMobile && (
          <div
            className="absolute"
            style={{
              top: "24px",
              left: "-6px",
              width: 0,
              height: 0,
              borderTop: "6px solid transparent",
              borderBottom: "6px solid transparent",
              borderRight: "6px solid var(--mc-cream-faint)",
            }}
          />
        )}
      </div>
    </>
  );
}
