"use client";

import { useState, type FormEvent } from "react";

interface ContactInfo {
  email: string;
  phone: string;
  schedule: string;
}

export default function Contact({ info }: { info?: ContactInfo }) {
  const email = info?.email ?? "ventas@forcom.com.ar";
  const phone = info?.phone ?? "+54 11 xxxx-xxxx";
  const schedule = info?.schedule ?? "Lun — Vie, 9:00 a 18:00";
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      company: (form.elements.namedItem("company") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      industry: (form.elements.namedItem("industry") as HTMLSelectElement).value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement).value,
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section id="contacto" className="relative py-24 lg:py-32 bg-forcom-black overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-forcom-red/20 to-transparent" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-forcom-red/[0.02] rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          {/* Left: Copy */}
          <div className="reveal">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-[2px] bg-forcom-red" />
              <span className="font-display font-semibold text-xs tracking-[0.3em] uppercase text-forcom-red">
                Contacto
              </span>
            </div>
            <h2 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight text-white mb-6 red-line">
              Consultá por
              <br />
              su solución
            </h2>
            <p className="text-forcom-gray-light text-lg leading-relaxed mb-10 max-w-md">
              Nuestro equipo comercial lo asesora para armar la solución ideal
              para su negocio. Sin compromiso.
            </p>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-forcom-card border border-forcom-border rounded-sm flex items-center justify-center text-forcom-red shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <div>
                  <p className="font-display font-semibold text-xs tracking-[0.15em] uppercase text-forcom-gray mb-0.5">Email</p>
                  <p className="text-white">{email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-forcom-card border border-forcom-border rounded-sm flex items-center justify-center text-forcom-red shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                </div>
                <div>
                  <p className="font-display font-semibold text-xs tracking-[0.15em] uppercase text-forcom-gray mb-0.5">Teléfono</p>
                  <p className="text-white">{phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-forcom-card border border-forcom-border rounded-sm flex items-center justify-center text-forcom-red shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-display font-semibold text-xs tracking-[0.15em] uppercase text-forcom-gray mb-0.5">Horario</p>
                  <p className="text-white">{schedule}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Form */}
          <div className="reveal">
            <div className="bg-forcom-card border border-forcom-border rounded-sm p-8 lg:p-10">
              {status === "success" ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-forcom-red/10 border border-forcom-red/30 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-forcom-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <h3 className="font-display font-bold text-2xl text-white mb-2">Mensaje enviado</h3>
                  <p className="text-forcom-gray">Nos pondremos en contacto a la brevedad.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="contact-name" className="block font-display font-semibold text-xs tracking-[0.15em] uppercase text-forcom-gray mb-2">
                      Nombre completo
                    </label>
                    <input id="contact-name" name="name" type="text" required className="w-full bg-forcom-black border border-forcom-border rounded-sm px-4 py-3 text-white placeholder:text-forcom-gray/50 focus:border-forcom-red focus:outline-none transition-colors" placeholder="Ej: Juan Pérez" />
                  </div>

                  <div>
                    <label htmlFor="contact-company" className="block font-display font-semibold text-xs tracking-[0.15em] uppercase text-forcom-gray mb-2">
                      Empresa
                    </label>
                    <input id="contact-company" name="company" type="text" className="w-full bg-forcom-black border border-forcom-border rounded-sm px-4 py-3 text-white placeholder:text-forcom-gray/50 focus:border-forcom-red focus:outline-none transition-colors" placeholder="Nombre de su empresa" />
                  </div>

                  <div>
                    <label htmlFor="contact-email" className="block font-display font-semibold text-xs tracking-[0.15em] uppercase text-forcom-gray mb-2">
                      Email
                    </label>
                    <input id="contact-email" name="email" type="email" required className="w-full bg-forcom-black border border-forcom-border rounded-sm px-4 py-3 text-white placeholder:text-forcom-gray/50 focus:border-forcom-red focus:outline-none transition-colors" placeholder="nombre@empresa.com" />
                  </div>

                  <div>
                    <label htmlFor="contact-industry" className="block font-display font-semibold text-xs tracking-[0.15em] uppercase text-forcom-gray mb-2">
                      Industria
                    </label>
                    <select id="contact-industry" name="industry" className="w-full bg-forcom-black border border-forcom-border rounded-sm px-4 py-3 text-white focus:border-forcom-red focus:outline-none transition-colors appearance-none">
                      <option value="">Seleccione su industria</option>
                      <option value="supermercado">Supermercado</option>
                      <option value="restaurante">Restaurante</option>
                      <option value="farmacia">Farmacia</option>
                      <option value="logistica">Logística</option>
                      <option value="estacion">Estación de Servicio</option>
                      <option value="hoteleria">Hotelería</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="contact-message" className="block font-display font-semibold text-xs tracking-[0.15em] uppercase text-forcom-gray mb-2">
                      Mensaje
                    </label>
                    <textarea id="contact-message" name="message" rows={4} required className="w-full bg-forcom-black border border-forcom-border rounded-sm px-4 py-3 text-white placeholder:text-forcom-gray/50 focus:border-forcom-red focus:outline-none transition-colors resize-none" placeholder="Cuéntenos qué necesita..." />
                  </div>

                  {status === "error" && (
                    <p className="text-sm text-forcom-red bg-forcom-red/10 border border-forcom-red/20 rounded-sm px-3 py-2">
                      Hubo un error al enviar. Por favor intentá de nuevo.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="w-full px-8 py-4 bg-forcom-red text-white font-display font-bold text-sm tracking-widest uppercase rounded-sm hover:bg-forcom-red-dark transition-colors disabled:opacity-60"
                  >
                    {status === "sending" ? "Enviando..." : "Enviar consulta"}
                  </button>

                  <p className="text-xs text-forcom-gray text-center">
                    Respuesta en menos de 24 horas hábiles
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
