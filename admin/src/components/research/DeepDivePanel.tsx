import type { DeepDiveResult } from "@/lib/research-types";
import {
  X,
  Newspaper,
  Share2,
  UtensilsCrossed,
  Package,
  Target,
  Mail,
  Phone,
  MapPin,
  Globe,
} from "lucide-react";

interface DeepDivePanelProps {
  data: DeepDiveResult | null;
  loading: boolean;
  businessName: string;
  onClose: () => void;
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-4 p-6">
      {[...Array(6)].map((_, i) => (
        <div key={i}>
          <div className="mc-skeleton h-3 w-24 mb-2" />
          <div className="mc-skeleton h-4 w-full mb-1" />
          <div className="mc-skeleton h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export default function DeepDivePanel({
  data,
  loading,
  businessName,
  onClose,
}: DeepDivePanelProps) {
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 transition-opacity"
        style={{ background: "rgba(10, 11, 13, 0.7)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-[480px] max-w-full overflow-y-auto"
        style={{
          background: "var(--mc-surface)",
          borderLeft: "1px solid var(--mc-border)",
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
          style={{
            background: "var(--mc-surface)",
            borderBottom: "1px solid var(--mc-border)",
          }}
        >
          <div>
            <p
              className="text-[9px] font-semibold tracking-[0.1em] uppercase"
              style={{ color: "var(--mc-cream-faint)" }}
            >
              Deep dive
            </p>
            <h2
              className="text-sm font-semibold mt-0.5"
              style={{
                fontFamily: "var(--font-jost), Jost, sans-serif",
                color: "var(--mc-text-primary)",
              }}
            >
              {businessName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 transition-colors"
            style={{ color: "var(--mc-text-muted)" }}
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {loading ? (
          <Skeleton />
        ) : data ? (
          <div className="p-6 flex flex-col gap-5">
            {/* Enriched details */}
            <Section title="Overview">
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--mc-text-secondary)" }}>
                {data.enrichedDetails}
              </p>
            </Section>

            {/* Contact info */}
            <Section title="Contact" icon={Mail}>
              <div className="flex flex-col gap-1.5">
                {data.contactInfo.email && (
                  <ContactRow icon={Mail} value={data.contactInfo.email} />
                )}
                {data.contactInfo.phone && (
                  <ContactRow icon={Phone} value={data.contactInfo.phone} />
                )}
                {data.contactInfo.address && (
                  <ContactRow icon={MapPin} value={data.contactInfo.address} />
                )}
                {data.contactInfo.website && (
                  <ContactRow
                    icon={Globe}
                    value={data.contactInfo.website}
                    href={data.contactInfo.website.startsWith("http") ? data.contactInfo.website : `https://${data.contactInfo.website}`}
                  />
                )}
                {!data.contactInfo.email && !data.contactInfo.phone && !data.contactInfo.address && !data.contactInfo.website && (
                  <p className="text-[11px]" style={{ color: "var(--mc-text-muted)" }}>
                    No contact information found
                  </p>
                )}
              </div>
            </Section>

            {/* Recent news */}
            {data.recentNews?.length > 0 && (
              <Section title="Recent news" icon={Newspaper}>
                <ul className="flex flex-col gap-1.5">
                  {data.recentNews.map((item, i) => (
                    <li
                      key={i}
                      className="text-[11px] leading-relaxed pl-3"
                      style={{
                        color: "var(--mc-text-secondary)",
                        borderLeft: "2px solid var(--mc-border)",
                      }}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Social media */}
            {data.socialMedia?.length > 0 && (
              <Section title="Social media" icon={Share2}>
                <div className="flex flex-col gap-1.5">
                  {data.socialMedia.map((sm, i) => (
                    <a
                      key={i}
                      href={sm.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] hover:underline flex items-center gap-1.5"
                      style={{ color: "var(--mc-cream-muted)" }}
                    >
                      <Globe className="w-3 h-3" strokeWidth={1.5} />
                      {sm.platform}
                    </a>
                  ))}
                </div>
              </Section>
            )}

            {/* Menu analysis */}
            {data.menuAnalysis && (
              <Section title="Menu analysis" icon={UtensilsCrossed}>
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--mc-text-secondary)" }}>
                  {data.menuAnalysis}
                </p>
              </Section>
            )}

            {/* Product catalog */}
            {data.productCatalog && (
              <Section title="Product catalog" icon={Package}>
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--mc-text-secondary)" }}>
                  {data.productCatalog}
                </p>
              </Section>
            )}

            {/* Competitive position */}
            {data.competitivePosition && (
              <Section title="Competitive position" icon={Target}>
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--mc-text-secondary)" }}>
                  {data.competitivePosition}
                </p>
              </Section>
            )}
          </div>
        ) : (
          <div className="p-6 text-center">
            <p className="text-[11px]" style={{ color: "var(--mc-text-muted)" }}>
              No data available
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  return (
    <div
      className="p-4"
      style={{
        background: "rgba(236, 223, 204, 0.02)",
        border: "1px solid var(--mc-border)",
      }}
    >
      <div className="flex items-center gap-1.5 mb-2" style={{ color: "var(--mc-cream-muted)" }}>
        {Icon && (
          <Icon className="w-3 h-3" strokeWidth={1.5} />
        )}
        <p
          className="text-[9px] font-semibold tracking-[0.08em] uppercase"
          style={{ color: "var(--mc-cream-muted)" }}
        >
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}

function ContactRow({
  icon: Icon,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--mc-text-secondary)" }}>
      <Icon className="w-3 h-3 flex-shrink-0" strokeWidth={1.5} />
      <span className="truncate">{value}</span>
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">
        {content}
      </a>
    );
  }

  return content;
}
