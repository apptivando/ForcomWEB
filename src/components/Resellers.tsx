"use client";

import { useState } from "react";
import { PROVINCES, RESELLER_TYPES } from "@/lib/site-forms";
import { errorCls, inputCls, labelCls, post, submitCls, useAntispam } from "./formkit";
import HoneypotField from "./HoneypotField";

const EMPTY = { nombre: "", empresa: "", prov: "", tel: "", rubro: "", msg: "" };

/**
 * Lo que se le ofrece al revendedor: lo mismo que Latin Office (lista
 * mayorista y catálogos), contado desde lo que habilita ser fábrica (ver
 * CLAUDE.md, "Posicionamiento"): FORCOM fabrica y arma su red; no es ella la
 * revendedora.
 */
const BENEFITS = [
  {
    title: "Precio de fábrica",
    text: "Lista mayorista directa de FORCOM, sin intermediarios entre la fábrica y su comercio.",
  },
  {
    title: "Garantía que respalda",
    text: "Sus clientes tienen 12 meses de garantía directa de fábrica. La respaldamos nosotros.",
  },
  {
    title: "Listo para publicar",
    text: "Fotos, fichas técnicas y catálogos de cada equipo para su tienda o sus redes.",
  },
];

/** Sección "Sumate como revendedor". Formulario portado de LatinOfficeWEB. */
export default function Resellers() {
  const [v, setV] = useState(EMPTY);
  const [out, setOut] = useState<{ text: string; good: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const { honeypotName, elapsedMs } = useAntispam();

  function set<K extends keyof typeof EMPTY>(k: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setV((cur) => ({ ...cur, [k]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!v.nombre.trim() || !v.empresa.trim() || !v.prov || !v.tel.trim()) {
      return setOut({ text: "Completá nombre, empresa, provincia y WhatsApp.", good: false });
    }
    setSending(true);
    const hp = new FormData(e.currentTarget).get(honeypotName);
    const r = await post("/api/revendedores", { ...v, [honeypotName]: hp ?? "", elapsedMs: elapsedMs() });
    setSending(false);
    if (!r.ok) return setOut({ text: r.error, good: false });
    setOut({ text: "¡Gracias! Te enviamos la lista mayorista y los catálogos a la brevedad.", good: true });
    setV(EMPTY);
  }

  return (
    <section id="revendedores" className="relative py-24 lg:py-32 bg-forcom-black overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-forcom-red/20 to-transparent" />
      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          <div className="reveal">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-[2px] bg-forcom-red" />
              <span className="font-display font-semibold text-xs tracking-[0.3em] uppercase text-forcom-red-text">
                Revendedores
              </span>
            </div>
            <h2 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tight text-white mb-6 red-line">
              Sume FORCOM
              <br />
              a su comercio
            </h2>
            <p className="text-forcom-gray-light text-lg leading-relaxed mb-10 max-w-md">
              Armamos una red de revendedores en todo el país. Si vende tecnología a comercios, complete el formulario y le
              enviamos la lista mayorista y los catálogos.
            </p>
            <ul className="space-y-6">
              {BENEFITS.map((b) => (
                <li key={b.title} className="flex gap-4">
                  <span className="w-10 h-10 bg-forcom-card border border-forcom-border rounded-sm flex items-center justify-center text-forcom-red shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-display font-bold text-white">{b.title}</p>
                    <p className="text-sm text-forcom-gray leading-relaxed">{b.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="reveal">
            <div className="bg-forcom-card border border-forcom-border rounded-sm p-6 sm:p-8 lg:p-10">
              <form noValidate onSubmit={onSubmit} className="relative">
                <HoneypotField name={honeypotName} id="revendedor-fc-ref" />
                <fieldset disabled={sending} className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="r-nombre" className={labelCls}>Nombre y apellido *</label>
                    <input id="r-nombre" autoComplete="name" value={v.nombre} onChange={set("nombre")} className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="r-empresa" className={labelCls}>Comercio o empresa *</label>
                    <input id="r-empresa" autoComplete="organization" value={v.empresa} onChange={set("empresa")} className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="r-prov" className={labelCls}>Provincia *</label>
                    <select id="r-prov" value={v.prov} onChange={set("prov")} className={inputCls + " appearance-none"}>
                      <option value="">Elegí una</option>
                      {PROVINCES.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="r-tel" className={labelCls}>WhatsApp *</label>
                    <input id="r-tel" type="tel" autoComplete="tel" value={v.tel} onChange={set("tel")} className={inputCls} placeholder="11 41234567" />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="r-rubro" className={labelCls}>¿A qué rubro le vende?</label>
                    <select id="r-rubro" value={v.rubro} onChange={set("rubro")} className={inputCls + " appearance-none"}>
                      <option value="">Elegí uno</option>
                      {RESELLER_TYPES.map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="r-msg" className={labelCls}>Comentarios</label>
                    <textarea
                      id="r-msg"
                      rows={3}
                      placeholder="Volumen estimado, equipos de interés…"
                      value={v.msg}
                      onChange={set("msg")}
                      className={inputCls + " resize-none"}
                    />
                  </div>
                  {out && (
                    <p
                      role={out.good ? "status" : "alert"}
                      className={
                        "sm:col-span-2 " +
                        (out.good
                          ? "text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-sm px-3 py-2"
                          : errorCls)
                      }
                    >
                      {out.text}
                    </p>
                  )}
                  <div className="sm:col-span-2">
                    <button type="submit" className={submitCls}>
                      {sending ? "Enviando..." : "Pedir lista mayorista"}
                    </button>
                  </div>
                </fieldset>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
