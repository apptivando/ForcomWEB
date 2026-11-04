"use client";

import { useState } from "react";
import { setOwnContactForm } from "@/app/admin/actions";
import Toggle from "./Toggle";
import { useToast } from "./Toast";

/**
 * Qué formulario muestra la sección Contacto del sitio. Se guarda al tocar el
 * interruptor (sin botón "Guardar"): está pensado para usarse rápido si el CRM
 * del cliente se cae.
 */
export default function ContactFormSwitch({ initial, available }: { initial: boolean; available: boolean }) {
  const toast = useToast();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function change(next: boolean) {
    setBusy(true);
    setOn(next);
    try {
      const r = await setOwnContactForm(next);
      if (!r.ok) {
        setOn(!next);
        toast.show(r.error, { kind: "error" });
        return;
      }
      toast.show(next ? "Formulario propio prendido" : "Volvió el formulario del CRM", {
        detail: next ? "Las consultas entran a Mensajes del panel" : "Las consultas van al CRM",
      });
    } catch {
      setOn(!next);
      toast.show("No se pudo cambiar. Revisá la conexión y probá de nuevo.", { kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="max-w-form mb-8 bg-[#141416] border border-[#2A2A2E] rounded-sm p-6 space-y-4">
      <div>
        <h2 className="font-display font-bold text-base text-white">Formulario de la sección Contacto</h2>
        <p className="text-[13px] text-[#8A8A8A] mt-1 max-w-prose">
          Normalmente se ve el formulario del CRM y las consultas van ahí. Si el CRM no anda, prendé el formulario propio: las
          consultas pasan a entrar a <span className="text-[#B0B0B0]">Mensajes</span> de este panel hasta que lo apagues.
        </p>
      </div>
      {available ? (
        <div className="flex items-center gap-3">
          <Toggle checked={on} disabled={busy} onChange={change} label="Usar el formulario propio en Contacto" />
          <span className="text-[15px] text-[#B0B0B0]">
            {on ? "Formulario propio: las consultas entran a Mensajes" : "Formulario del CRM (normal)"}
          </span>
        </div>
      ) : (
        <p className="text-[15px] text-[#E8E2CC] bg-[#15150F] border border-[#3A3520] border-l-[3px] border-l-[#C9A227] rounded-sm px-4 py-3">
          Para usar este interruptor falta correr la migración <code className="text-white">024_garantias_revendedores_franja.sql</code>{" "}
          en Supabase. Mientras tanto el sitio muestra el formulario del CRM.
        </p>
      )}
    </section>
  );
}
