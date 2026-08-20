import type { CrmContact } from "@/lib/types";

/**
 * Los tres puntitos de contacto: WhatsApp, email, teléfono.
 *
 * Comunican la prioridad de un vistazo sin una columna con un número, que no
 * le diría nada a nadie. Se usan en la fila de la tabla y en la cabecera de la
 * ficha, por eso vive en su propio archivo.
 */
export default function ContactDots({ c }: { c: CrmContact }) {
  const items = [
    {
      on: !!c.whatsapp_phone,
      label: "WhatsApp",
      text: "WA",
      color: "text-green-400 border-green-500/30 bg-green-500/10",
    },
    {
      on: !!c.email,
      label: c.email ?? "Email",
      text: "@",
      color: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    },
    {
      on: !!c.phone,
      label: c.phone ?? "Teléfono",
      text: "Tel",
      color: "text-[#B0B0B0] border-[#2A2A2E] bg-[#1A1A1E]",
    },
  ];

  return (
    <div className="flex items-center gap-1">
      {items.map((it) => (
        <span
          key={it.text}
          title={it.on ? it.label : `Sin ${it.text}`}
          className={`px-1.5 py-0.5 text-[10px] font-display font-bold rounded-sm border ${
            it.on ? it.color : "text-[#3A3A3E] border-[#1F1F23] bg-transparent"
          }`}
        >
          {it.text}
        </span>
      ))}
      {/* Solo informativo: el teléfono que dio Google venía marcado como
          celular. No cuenta como WhatsApp confirmado y por eso no cambia la
          prioridad — para eso hace falta evidencia. */}
      {!c.whatsapp_phone && c.whatsapp_likely && (
        <span
          title="El teléfono parece un celular — puede tener WhatsApp, pero no está confirmado"
          className="px-1.5 py-0.5 text-[10px] font-display rounded-sm border border-dashed border-green-500/25 text-green-500/50"
        >
          ?
        </span>
      )}
    </div>
  );
}
