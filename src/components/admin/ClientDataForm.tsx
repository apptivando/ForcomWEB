"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateClient, deleteClient } from "@/app/admin/actions";
import { unfreezeClient } from "@/app/admin/client-actions";
import type { ClientEdit } from "@/app/admin/actions";
import type { CrmContact } from "@/lib/types";

const FIELDS: Array<{ key: keyof ClientEdit; label: string; hint?: string; disputed: boolean }> = [
  { key: "business_name", label: "Razón social", disputed: true },
  { key: "contact_name", label: "Nombre de contacto", disputed: true },
  { key: "email", label: "Email", disputed: true },
  { key: "phone", label: "Teléfono", hint: "ej. 351 421-8834", disputed: true },
  { key: "whatsapp_phone", label: "WhatsApp", hint: "ej. 351 518-1882", disputed: true },
  { key: "rubro", label: "Rubro", disputed: true },
  { key: "locality", label: "Localidad", disputed: true },
  { key: "address", label: "Dirección", disputed: true },
  { key: "website", label: "Sitio web", disputed: true },
  { key: "instagram_url", label: "Instagram", disputed: true },
  { key: "facebook_url", label: "Facebook", disputed: true },
  { key: "linkedin_url", label: "LinkedIn", disputed: true },
  { key: "google_maps_url", label: "Google Maps", disputed: false },
];

function toForm(c: CrmContact): Record<string, string> {
  return Object.fromEntries(
    FIELDS.map((f) => [f.key, (c[f.key as keyof CrmContact] as string | null) ?? ""])
  );
}

export default function ClientDataForm({
  client,
  canDelete,
  onDeleted,
  onSaved,
}: {
  client: CrmContact;
  canDelete: boolean;
  onDeleted: () => void;
  /** Le avisa a la ficha que relea el cliente. Sin esto, después de guardar
   *  seguía mostrando la versión vieja — por ejemplo sin el candado nuevo. */
  onSaved: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [form, setForm] = useState(() => toForm(client));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setForm(toForm(client));
    setError(null);
    setSaved(false);
    setConfirmDelete(false);
  }, [client]);

  const original = toForm(client);
  const dirty = FIELDS.filter((f) => form[f.key] !== original[f.key]);
  // El aviso del candado solo aparece si de verdad va a congelar: antes era
  // incondicional y por eso se volvía invisible de tan repetido.
  const willFreeze = !client.manual_lock && dirty.some((f) => f.disputed);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateClient(client.id, Object.fromEntries(dirty.map((f) => [f.key, form[f.key]])));
      setSaved(true);
      // Primero la ficha, que es lo que estás mirando; después la lista de
      // atrás, que puede tardar sin que se note.
      await onSaved();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  const field =
    "w-full bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-2.5 py-1.5 text-[13px] text-white placeholder:text-[#8A8A8A] focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none";

  return (
    <div className="px-6 py-4 space-y-4">
      {client.manual_lock && (
        <div className="flex items-start justify-between gap-3 bg-[#141416] border border-[#2A2A2E] rounded-sm px-3 py-2.5">
          <p className="text-[13px] text-[#B0B0B0]">
            🔒 Ficha congelada: la búsqueda automática de datos no la vuelve a tocar. Si le faltan
            datos, se puede descongelar.
          </p>
          <button
            onClick={async () => {
              await unfreezeClient(client.id);
              await onSaved();
              router.refresh();
            }}
            className="shrink-0 text-[13px] font-semibold text-[#B0B0B0] hover:text-white whitespace-nowrap"
          >
            Descongelar y volver a buscar
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="block text-[12px] text-[#8A8A8A] mb-1">
              {f.label}
              {f.hint && <span className="text-[#3A3A3E]"> · {f.hint}</span>}
            </span>
            <input
              className={field}
              value={form[f.key] ?? ""}
              onChange={(e) => {
                setForm({ ...form, [f.key]: e.target.value });
                setSaved(false);
              }}
            />
          </label>
        ))}
      </div>

      {willFreeze && (
        <p className="text-[13px] text-yellow-400">
          Guardar esto congela la ficha: {dirty.filter((f) => f.disputed).map((f) => f.label.toLowerCase()).join(", ")}{" "}
          {dirty.filter((f) => f.disputed).length === 1 ? "es un campo" : "son campos"} que la
          búsqueda automática también completa, y lo que cargues a mano no se vuelve a discutir.
        </p>
      )}

      {error && (
        <p className="text-[13px] text-[#FF6A5C] bg-[#E8231A]/5 border border-[#E8231A]/20 rounded-sm px-3 py-2">
          {error}
        </p>
      )}
      {saved && dirty.length === 0 && <p className="text-[13px] text-green-400">Guardado.</p>}

      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          onClick={save}
          disabled={saving || dirty.length === 0}
          className="px-5 py-2 bg-[#C41D16] text-white font-bold text-[13px] tracking-widest uppercase rounded-sm hover:bg-[#E8231A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Guardando…" : dirty.length === 0 ? "Sin cambios" : `Guardar ${dirty.length} cambio(s)`}
        </button>

        {canDelete &&
          (confirmDelete ? (
            <div className="flex items-center gap-3 text-[13px]">
              <span className="text-[#8A8A8A]">¿Borrar el cliente y todo su historial?</span>
              <button
                onClick={async () => {
                  await deleteClient(client.id);
                  onDeleted();
                  router.refresh();
                }}
                className="text-[#FF6A5C] hover:text-white font-display font-semibold"
              >
                Confirmar
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[#8A8A8A] hover:text-white"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-[13px] text-[#8A8A8A] hover:text-[#FF6A5C] transition-colors"
            >
              Eliminar cliente
            </button>
          ))}
      </div>
    </div>
  );
}
