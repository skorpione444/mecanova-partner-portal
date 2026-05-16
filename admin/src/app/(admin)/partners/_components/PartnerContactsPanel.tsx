"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PartnerContact } from "@mecanova/shared";
import { Plus, Trash2, Mail, Phone } from "lucide-react";

interface Props {
  partnerId: string;
  editable: boolean;
  onChanged?: () => void;
}

export default function PartnerContactsPanel({ partnerId, editable, onChanged }: Props) {
  const supabase = createClient();
  const [rows, setRows] = useState<PartnerContact[]>([]);
  const [loading, setLoading] = useState(true);

  const [person, setPerson] = useState("");
  const [position, setPosition] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("partner_contacts")
      .select("*")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false });
    setRows((data as PartnerContact[]) || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId]);

  useEffect(() => {
    load();
  }, [load]);

  const addContact = async () => {
    setError(null);
    if (!person.trim()) {
      setError("Enter at least a contact name.");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not signed in.");
      setSaving(false);
      return;
    }
    const { error: insertError } = await supabase.from("partner_contacts").insert({
      partner_id: partnerId,
      contact_person: person.trim(),
      contact_position: position.trim() || null,
      contact_email: email.trim() || null,
      contact_phone: phone.trim() || null,
      notes: notes.trim() || null,
      created_by: user.id,
    });
    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }
    setPerson("");
    setPosition("");
    setEmail("");
    setPhone("");
    setNotes("");
    setSaving(false);
    await load();
    onChanged?.();
  };

  const deleteContact = async (id: string) => {
    if (!confirm("Delete this contact? This cannot be undone.")) return;
    await supabase.from("partner_contacts").delete().eq("id", id);
    setRows((prev) => prev.filter((r) => r.id !== id));
    onChanged?.();
  };

  return (
    <div>
      {editable && (
        <div
          className="p-4 mb-4"
          style={{ background: "var(--mc-surface-elevated)", border: "1px solid var(--mc-border)" }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mc-label" htmlFor="pc-person">Contact Person *</label>
              <input
                id="pc-person"
                type="text"
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                className="mc-input"
                placeholder="e.g. Anna Klein"
              />
            </div>
            <div>
              <label className="mc-label" htmlFor="pc-position">Position</label>
              <input
                id="pc-position"
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="mc-input"
                placeholder="e.g. Buyer"
              />
            </div>
            <div>
              <label className="mc-label" htmlFor="pc-email">Email</label>
              <input
                id="pc-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mc-input"
                placeholder="e.g. anna@company.de"
              />
            </div>
            <div>
              <label className="mc-label" htmlFor="pc-phone">Phone</label>
              <input
                id="pc-phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mc-input"
                placeholder="e.g. +49 30 12345678"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="mc-label" htmlFor="pc-notes">Note (optional)</label>
            <input
              id="pc-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mc-input"
              placeholder="e.g. best reached mornings; handles reorders"
            />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={addContact}
              disabled={saving || !person.trim()}
              className="mc-btn mc-btn-primary"
            >
              <Plus className="w-3.5 h-3.5" />
              {saving ? "Adding…" : "Add contact"}
            </button>
            {error && (
              <span className="text-[11px]" style={{ color: "var(--mc-error)" }}>{error}</span>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="mc-skeleton h-12" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs py-6 text-center" style={{ color: "var(--mc-text-muted)" }}>
          No additional contacts.
        </p>
      ) : (
        <div style={{ border: "1px solid var(--mc-border)" }}>
          {rows.map((row, i) => (
            <div
              key={row.id}
              className="px-4 py-3 flex items-start gap-3"
              style={{
                borderBottom: i < rows.length - 1 ? "1px solid var(--mc-border)" : "none",
                background: i === 0 ? "rgba(236,223,204,0.04)" : "transparent",
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium" style={{ color: "var(--mc-text-primary)" }}>
                  {row.contact_person || "—"}
                  {row.contact_position && (
                    <span className="font-normal" style={{ color: "var(--mc-text-muted)" }}>
                      {" · "}{row.contact_position}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                  {row.contact_email && (
                    <a
                      href={`mailto:${row.contact_email}`}
                      className="inline-flex items-center gap-1 text-[11px]"
                      style={{ color: "var(--mc-info)", textDecoration: "none" }}
                    >
                      <Mail className="w-3 h-3" />
                      {row.contact_email}
                    </a>
                  )}
                  {row.contact_phone && (
                    <a
                      href={`tel:${row.contact_phone}`}
                      className="inline-flex items-center gap-1 text-[11px]"
                      style={{ color: "var(--mc-info)", textDecoration: "none" }}
                    >
                      <Phone className="w-3 h-3" />
                      {row.contact_phone}
                    </a>
                  )}
                </div>
                {row.notes && (
                  <p className="text-[11px] mt-1" style={{ color: "var(--mc-text-secondary)", whiteSpace: "pre-wrap" }}>
                    {row.notes}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-[10px] tabular-nums" style={{ color: "var(--mc-text-muted)" }}>
                  {new Date(row.created_at).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                {editable && (
                  <button
                    type="button"
                    onClick={() => deleteContact(row.id)}
                    className="mc-btn mc-btn-danger"
                    style={{ fontSize: 11 }}
                    title="Delete contact"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
