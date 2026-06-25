"use client";

import { useState, useTransition } from "react";
import { updateCompanyInfo } from "@/app/admin/actions";
import type { CompanyInfo } from "@/lib/types";

export default function CompanyInfoEditor({ info }: { info: CompanyInfo }) {
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    whatsapp: info.whatsapp,
    email: info.email,
    phone: info.phone,
    schedule: info.schedule,
  });

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    startTransition(async () => {
      try {
        await updateCompanyInfo(form);
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar.");
      } finally {
        setSaving(false);
      }
    });
  }

  const inputCls =
    "w-full bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm px-4 py-3 text-white focus:border-[#E8231A] focus:outline-none transition-colors";
  const labelCls =
    "block text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6 space-y-5">
        {/* WhatsApp */}
        <div>
          <label className={labelCls}>Número de WhatsApp</label>
          <input
            className={inputCls}
            value={form.whatsapp}
            onChange={(e) => setField("whatsapp", e.target.value)}
            placeholder="5491112345678"
          />
          <p className="text-[11px] text-[#8A8A8A] mt-1.5">
            Formato internacional sin + ni espacios. Ej: <code className="bg-[#0D0D0F] px-1">5491112345678</code>
          </p>
        </div>

        {/* Email */}
        <div>
          <label className={labelCls}>Email de contacto</label>
          <input
            type="email"
            className={inputCls}
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
            placeholder="ventas@forcom.com.ar"
          />
        </div>

        {/* Teléfono */}
        <div>
          <label className={labelCls}>Teléfono (visible en el sitio)</label>
          <input
            className={inputCls}
            value={form.phone}
            onChange={(e) => setField("phone", e.target.value)}
            placeholder="+54 11 xxxx-xxxx"
          />
        </div>

        {/* Horario */}
        <div>
          <label className={labelCls}>Horario de atención</label>
          <input
            className={inputCls}
            value={form.schedule}
            onChange={(e) => setField("schedule", e.target.value)}
            placeholder="Lun — Vie, 9:00 a 18:00"
          />
        </div>
      </div>

      {/* Preview */}
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6">
        <h3 className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-4">
          Vista previa
        </h3>
        <div className="space-y-3">
          <InfoRow icon="email" label="Email" value={form.email || "—"} />
          <InfoRow icon="phone" label="Teléfono" value={form.phone || "—"} />
          <InfoRow icon="clock" label="Horario" value={form.schedule || "—"} />
          <InfoRow
            icon="whatsapp"
            label="WhatsApp"
            value={form.whatsapp ? `wa.me/${form.whatsapp}` : "—"}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-[#E8231A] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-4 py-3">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="px-8 py-3 bg-[#E8231A] text-white font-display font-bold text-sm tracking-widest uppercase rounded-sm hover:bg-[#C41D16] transition-colors disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        {saved && (
          <span className="text-sm text-green-400 font-display font-semibold">
            ✓ Guardado
          </span>
        )}
      </div>
    </form>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: "email" | "phone" | "clock" | "whatsapp";
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-[#1A1A1E] border border-[#2A2A2E] rounded-sm flex items-center justify-center text-[#E8231A] shrink-0">
        {icon === "email" && (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        )}
        {icon === "phone" && (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
          </svg>
        )}
        {icon === "clock" && (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        {icon === "whatsapp" && (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>
        )}
      </div>
      <div>
        <p className="text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A]">{label}</p>
        <p className="text-sm text-white">{value}</p>
      </div>
    </div>
  );
}
