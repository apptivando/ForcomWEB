"use client";

import { useState } from "react";
import { MAX_INVOICE_MB, PROVINCES, WARRANTY_MONTHS } from "@/lib/site-forms";
import { emailOk, errorCls, inputCls, labelCls, post, submitCls, useAntispam } from "./formkit";
import HoneypotField from "./HoneypotField";

/** Un equipo que se puede elegir en el formulario: cualquier producto activo. */
export interface WarrantyModel {
  id: string;
  model: string;
  section: string;
}

const MAX_INVOICE_BYTES = MAX_INVOICE_MB * 1024 * 1024;

const EMPTY = {
  nombre: "", doc: "", email: "", tel: "", prov: "", loc: "",
  comercio: "", modelo: "", cant: "1", fac: "", fecha: "",
};

type Cert = {
  codigo: string;
  pendiente: boolean;
  vence: string;
  titular: string;
  modelo: string;
  cant: string;
  factura: string;
  compra: string;
  comercio: string;
  email: string;
};

/** "2026-10-29" → "29/10/2026", sin pasar por Date (evita corrimientos de huso). */
function fmt(isoDate: string) {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

/** Hoy en Argentina, como "AAAA-MM-DD". */
function todayAR() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

/** 29/02 + 1 año → 01/03, igual que el servidor. */
function addYear(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y + 1, m - 1, d)).toISOString().slice(0, 10);
}

const STEPS = [
  {
    title: "Compra directa",
    text: "Si el equipo se lo compró a FORCOM, la garantía queda activa en el momento.",
  },
  {
    title: "Compra en un comercio",
    text: "Adjunte la factura: la validamos con el comercio y le confirmamos la activación por email.",
  },
  {
    title: "Guarde su código",
    text: "Le llega por email. Es lo que va a necesitar ante cualquier consulta de servicio técnico.",
  },
];

/**
 * Sección "Activar garantía". Portada del formulario de LatinOfficeWEB
 * (`components/site/WarrantyForm.tsx`) con el diseño de FORCOM. Las reglas
 * viven en /api/garantia; acá solo se adelantan los errores más comunes.
 */
export default function Warranty({ models }: { models: WarrantyModel[] }) {
  const [v, setV] = useState(EMPTY);
  const [donde, setDonde] = useState<"directo" | "comercio">("directo");
  const [file, setFile] = useState<File | null>(null);
  const [acepta, setAcepta] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [cert, setCert] = useState<Cert | null>(null);
  const { honeypotName, elapsedMs } = useAntispam();

  const comercio = donde === "comercio";
  const sections = [...new Set(models.map((m) => m.section))];

  function set<K extends keyof typeof EMPTY>(k: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((cur) => ({ ...cur, [k]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const req: (keyof typeof EMPTY)[] = ["nombre", "doc", "email", "tel", "prov", "loc", "modelo", "cant", "fac", "fecha"];
    if (comercio) req.push("comercio");

    const hoy = todayAR();
    let msg = "";
    if (req.some((k) => !v[k].trim())) msg = "Completá los campos marcados con *.";
    else if (!emailOk(v.email.trim())) msg = "Revisá el email: el formato no es válido.";
    else if (comercio && !file) msg = "Si compraste en un comercio, adjuntá la foto o PDF de la factura para poder validarla.";
    else if (file && file.size > MAX_INVOICE_BYTES) msg = `La factura supera los ${MAX_INVOICE_MB} MB. Subí una foto más liviana (una captura o una foto con menos resolución alcanza).`;
    else if (!acepta) msg = "Para activar la garantía tenés que aceptar las condiciones.";
    else if (v.fecha > hoy) msg = "La fecha de la factura no puede ser posterior a hoy.";
    else if (addYear(v.fecha) < hoy) msg = `Según la fecha de la factura, la garantía de ${WARRANTY_MONTHS} meses ya venció. Escribinos desde Contacto y lo revisamos.`;
    if (msg) return setErr(msg);

    setErr(null);
    setSending(true);
    const fd = new FormData();
    fd.append("donde", donde);
    for (const [k, val] of Object.entries(v)) fd.append(k, val.trim());
    if (file) fd.append("factura", file);
    fd.append(honeypotName, String(new FormData(e.currentTarget).get(honeypotName) ?? ""));
    fd.append("elapsedMs", String(elapsedMs()));

    const r = await post("/api/garantia", fd);
    setSending(false);
    if (!r.ok) return setErr(r.error);

    const model = models.find((m) => m.id === v.modelo);
    setCert({
      codigo: String(r.codigo),
      pendiente: r.estado === "pendiente",
      vence: String(r.vence),
      titular: v.nombre.trim(),
      modelo: model?.model ?? "",
      cant: v.cant,
      factura: v.fac.trim(),
      compra: v.fecha,
      comercio: v.comercio.trim(),
      email: v.email.trim(),
    });
  }

  return (
    <section id="garantia" className="relative py-24 lg:py-32 bg-forcom-dark overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-forcom-red/20 to-transparent" />
      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative">
        <div className="grid lg:grid-cols-[1fr_1.5fr] gap-12 lg:gap-16">
          {/* Izquierda: explicación */}
          <div className="reveal">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-[2px] bg-forcom-red" />
              <span className="font-display font-semibold text-xs tracking-[0.3em] uppercase text-forcom-red-text">
                Garantía
              </span>
            </div>
            <h2 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tight text-white mb-6 red-line">
              Active su garantía
              <br />
              de fábrica
            </h2>
            <p className="text-forcom-gray-light text-lg leading-relaxed mb-10 max-w-md">
              Todos los equipos FORCOM tienen {WARRANTY_MONTHS} meses de garantía directa de fábrica, desde la fecha de la
              factura. Regístrela acá y reciba su código por email.
            </p>
            <ol className="space-y-6">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="w-10 h-10 bg-forcom-card border border-forcom-border rounded-sm flex items-center justify-center font-display font-bold text-forcom-red-text shrink-0">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-display font-bold text-white">{s.title}</p>
                    <p className="text-sm text-forcom-gray leading-relaxed">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Derecha: formulario o comprobante */}
          <div className="reveal">
            <div className="bg-forcom-card border border-forcom-border rounded-sm p-6 sm:p-8 lg:p-10">
              {cert ? (
                <div role="status" className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-display font-bold text-2xl text-white">
                      {cert.pendiente ? "Garantía registrada" : "Garantía activada"}
                    </h3>
                    <span
                      className={`px-2.5 py-1 text-xs font-display font-bold tracking-[0.1em] uppercase rounded-sm border ${
                        cert.pendiente
                          ? "bg-yellow-500/10 text-yellow-300 border-yellow-500/30"
                          : "bg-green-500/10 text-green-400 border-green-500/30"
                      }`}
                    >
                      {cert.pendiente ? "Pendiente de validación" : "Activa"}
                    </span>
                  </div>
                  <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
                    {[
                      ["Código de garantía", cert.codigo, true],
                      ["Vigente hasta", fmt(cert.vence), true],
                      ["Titular", cert.titular, false],
                      ["Equipo", `${cert.modelo} × ${cert.cant}`, false],
                      ["Factura", cert.factura, false],
                      ["Fecha de compra", fmt(cert.compra), false],
                      ...(cert.pendiente ? [["Comercio", cert.comercio, false] as const] : []),
                    ].map(([k, val, hl]) => (
                      <div key={String(k)} className={hl ? "bg-forcom-black border border-forcom-border rounded-sm px-4 py-3" : ""}>
                        <dt className={labelCls + " !mb-1"}>{k}</dt>
                        <dd className={hl ? "font-display font-bold text-xl text-forcom-red-text" : "text-white"}>{val}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-sm text-forcom-gray leading-relaxed">
                    {cert.pendiente
                      ? "Validamos la factura con el comercio y te confirmamos la activación por email. La vigencia corre desde la fecha de la factura."
                      : `Te enviamos este comprobante a ${cert.email}. Guardá tu código para cualquier consulta.`}
                  </p>
                </div>
              ) : (
                <form noValidate onSubmit={onSubmit} className="relative">
                  <HoneypotField name={honeypotName} id="garantia-fc-ref" />
                  <fieldset disabled={sending} className="grid sm:grid-cols-2 gap-5">
                    <p className="sm:col-span-2 font-display font-bold text-sm tracking-[0.2em] uppercase text-white">Tus datos</p>
                    <div>
                      <label htmlFor="g-nombre" className={labelCls}>Nombre y apellido *</label>
                      <input id="g-nombre" autoComplete="name" value={v.nombre} onChange={set("nombre")} className={inputCls} />
                    </div>
                    <div>
                      <label htmlFor="g-doc" className={labelCls}>DNI o CUIT *</label>
                      <input id="g-doc" inputMode="numeric" value={v.doc} onChange={set("doc")} className={inputCls} />
                    </div>
                    <div>
                      <label htmlFor="g-email" className={labelCls}>Email *</label>
                      <input id="g-email" type="email" autoComplete="email" value={v.email} onChange={set("email")} className={inputCls} />
                    </div>
                    <div>
                      <label htmlFor="g-tel" className={labelCls}>Teléfono / WhatsApp *</label>
                      <input id="g-tel" type="tel" autoComplete="tel" value={v.tel} onChange={set("tel")} className={inputCls} placeholder="11 41234567" />
                    </div>
                    <div>
                      <label htmlFor="g-prov" className={labelCls}>Provincia *</label>
                      <select id="g-prov" value={v.prov} onChange={set("prov")} className={inputCls + " appearance-none"}>
                        <option value="">Elegí una</option>
                        {PROVINCES.map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="g-loc" className={labelCls}>Localidad *</label>
                      <input id="g-loc" autoComplete="address-level2" value={v.loc} onChange={set("loc")} className={inputCls} />
                    </div>

                    <p className="sm:col-span-2 mt-2 font-display font-bold text-sm tracking-[0.2em] uppercase text-white">Datos de la compra</p>
                    <fieldset className="sm:col-span-2">
                      <legend className={labelCls}>¿Dónde lo compraste? *</legend>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {(
                          [
                            ["directo", "Directo a FORCOM", "Venta directa de fábrica o un vendedor de FORCOM."],
                            ["comercio", "En un comercio o revendedor", "Una casa de computación, un integrador u otra tienda."],
                          ] as const
                        ).map(([val, title, sub]) => (
                          <label
                            key={val}
                            htmlFor={`g-d-${val}`}
                            className={`flex gap-3 items-start cursor-pointer bg-forcom-black border rounded-sm px-4 py-3 transition-colors ${
                              donde === val ? "border-forcom-red" : "border-forcom-border hover:border-forcom-gray"
                            }`}
                          >
                            <input
                              id={`g-d-${val}`}
                              type="radio"
                              name="g-donde"
                              checked={donde === val}
                              onChange={() => setDonde(val)}
                              className="mt-1 accent-[#E8231A]"
                            />
                            <span>
                              <span className="block font-display font-bold text-white">{title}</span>
                              <span className="block text-xs text-forcom-gray mt-0.5">{sub}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    {comercio && (
                      <div className="sm:col-span-2">
                        <label htmlFor="g-comercio" className={labelCls}>Nombre del comercio y localidad *</label>
                        <input id="g-comercio" placeholder="Ej.: Computación del Centro, Rosario" value={v.comercio} onChange={set("comercio")} className={inputCls} />
                      </div>
                    )}
                    <div>
                      <label htmlFor="g-modelo" className={labelCls}>Equipo *</label>
                      <select id="g-modelo" value={v.modelo} onChange={set("modelo")} className={inputCls + " appearance-none"}>
                        <option value="">Elegí el equipo</option>
                        {sections.map((s) => (
                          <optgroup key={s} label={s}>
                            {models
                              .filter((m) => m.section === s)
                              .map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.model}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="g-cant" className={labelCls}>Cantidad de unidades *</label>
                      <input id="g-cant" type="number" min={1} inputMode="numeric" value={v.cant} onChange={set("cant")} className={inputCls} />
                    </div>
                    <div>
                      <label htmlFor="g-fac" className={labelCls}>N.º de factura *</label>
                      <input id="g-fac" placeholder="Ej.: 0003-00012345" value={v.fac} onChange={set("fac")} className={inputCls} />
                    </div>
                    <div>
                      <label htmlFor="g-fecha" className={labelCls}>Fecha de la factura *</label>
                      <input id="g-fecha" type="date" max={todayAR()} value={v.fecha} onChange={set("fecha")} className={inputCls + " [color-scheme:dark]"} />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="g-foto" className={labelCls}>
                        {comercio ? `Foto o PDF de la factura * (hasta ${MAX_INVOICE_MB} MB)` : `Foto o PDF de la factura (opcional, hasta ${MAX_INVOICE_MB} MB)`}
                      </label>
                      <input
                        id="g-foto"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        className="block w-full text-sm text-forcom-gray-light file:mr-4 file:px-4 file:py-2.5 file:rounded-sm file:border file:border-forcom-border file:bg-forcom-black file:text-white file:font-display file:font-semibold file:text-xs file:tracking-[0.15em] file:uppercase hover:file:border-forcom-red"
                      />
                    </div>
                    <label htmlFor="g-ok" className="sm:col-span-2 flex gap-3 items-start text-sm text-forcom-gray-light cursor-pointer">
                      <input id="g-ok" type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-0.5 accent-[#E8231A]" />
                      <span>Acepto las condiciones de garantía y el uso de mis datos para gestionarla.</span>
                    </label>

                    {err && (
                      <p role="alert" className={errorCls + " sm:col-span-2"}>
                        {err}
                      </p>
                    )}

                    <div className="sm:col-span-2">
                      <button type="submit" className={submitCls}>
                        {sending ? "Enviando..." : "Activar garantía"}
                      </button>
                    </div>
                  </fieldset>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
