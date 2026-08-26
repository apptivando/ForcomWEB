"use client";

import { useState } from "react";
import { formatArPhone } from "@/lib/phone";
import Modal from "@/components/admin/Modal";
import {
  IconWhatsApp,
  IconEmail,
  IconPhone,
  IconGlobe,
  IconRedes,
  IconMapPin,
  IconExternal,
} from "@/components/admin/icons";
import type { CrmContact } from "@/lib/types";

/**
 * Los canales de contacto de un cliente: qué tiene y cómo usarlo.
 *
 * ─── Qué cambió y por qué ─────────────────────────────────────────────────
 * Antes esto solo INFORMABA (tres puntitos WA/@/Tel) y la acción vivía en una
 * columna ENLACES aparte, con siete enlaces de texto. Esa columna era la que
 * empujaba la tabla a ~1200 px dentro de un contenedor de ~740 px y dejaba
 * todo fuera de pantalla. Se fusionaron: **el chip es la acción**.
 *
 * Y las etiquetas ("Tel", "Web", "Redes", "Maps") pasaron a iconos: un chip de
 * texto cuesta entre 34 y 52 px de ancho, uno cuadrado 26. En una tabla que
 * pelea por el ancho, seis chips de texto son ~250 px y seis de icono ~180.
 *
 * Las tres redes van juntas en un solo chip que abre un modal, porque el 57 %
 * de los clientes tiene más de una: tres columnas separadas costaban ancho y
 * casi siempre mostraban lo mismo.
 *
 * ─── Reglas que hay que respetar al tocarlo ───────────────────────────────
 * 1. **El estado apagado tiene que leerse.** Antes usaba #3A3A3E sobre #161618
 *    a 10 px: 1,6:1, cuando el mínimo AA es 4,5:1.
 * 2. **No alcanza con el color.** Presente y ausente se distinguen además por
 *    forma —relleno vs. contorno punteado—, así que también funciona para
 *    quien no separa el verde del gris.
 * 3. **Sin texto, el `title` y el `aria-label` no son opcionales.** Son lo
 *    único que queda para saber qué es cada chip, y llevan el dato adentro
 *    ("Llamar a 351 518-1882"), no solo el nombre del canal.
 * 4. **Lo que no existe no es clickeable.** Un chip apagado es un `<span>`
 *    inerte, no un enlace muerto.
 * 5. **Nada de esto puede abrir la ficha.** La fila entera es clickeable, así
 *    que el contenedor corta la propagación: copiar un mail no puede además
 *    abrir el panel lateral.
 */

/** Caja del chip. Cuadrada: el icono manda el tamaño, no el largo del texto. */
const CHIP = "inline-flex items-center justify-center p-1.5 rounded-sm border transition-colors";

/**
 * Chip de un canal que NO tenemos.
 *
 * Se muestra igual —no se oculta— porque la posición de cada icono tiene que
 * ser fija: en una lista de 50 prospectos, el ojo aprende "el segundo es el
 * correo" y recorre la columna en vertical. Si los ausentes desaparecieran,
 * cada fila tendría los iconos en otro lugar y esa lectura se pierde. Además,
 * "qué falta" es accionable acá: es lo que decide si conviene tocar Re-buscar.
 *
 * El gris es #8A8A8A —el token `--gray` del sistema— y no el #6E6E76 que
 * estaba antes: medido sobre los fondos reales de fila (#141416 y #161618),
 * aquel daba 3,58:1 y no los ~4,5 estimados. Este da 5,23:1.
 *
 * El borde punteado sí se queda en #6E6E76: como elemento de interfaz no
 * textual el mínimo es 3:1, no 4,5:1, y ahí 3,58 alcanza.
 */
const CHIP_OFF = "text-[#8A8A8A] border-dashed border-[#6E6E76] bg-transparent cursor-default";

/**
 * Un color por canal, en vez de "gris para todo lo que no es WhatsApp o mail".
 *
 * El problema que resuelve: Tel, Web y Maps presentes eran gris claro y el
 * ausente gris oscuro — dos grises que casi no se distinguían, así que la
 * columna no respondía su única pregunta ("¿por dónde lo contacto?").
 *
 * Ahora el ICONO dice qué canal es y el COLOR dice que lo tenemos. Cada uno
 * sigue la convención de su medio, evitando el rojo de marca —que además se
 * lee como error—. Ámbar y naranja son los dos más parecidos entre sí, pero un
 * globo y una chincheta no se confunden: la forma desambigua, el color solo
 * dice "lo hay". Los seis pasan AA sobre los dos fondos de fila (7,1:1 a
 * 12,2:1); el detalle de cada medición está en el comentario de cada canal.
 *
 * Van como strings LITERALES y no armados con una función: Tailwind escanea el
 * código fuente buscando nombres de clase completos, así que un
 * `text-[${variable}]` nunca llegaría a generarse.
 */
const TONO = {
  /** Verde: es la marca de WhatsApp. 10,4:1 */
  whatsapp: "text-[#4ADE80] border-[#4ADE80]/40 bg-[#4ADE80]/10 hover:bg-[#4ADE80]/25",
  /** Azul: convención universal de correo y de enlace. 7,1:1 */
  email: "text-[#60A5FA] border-[#60A5FA]/40 bg-[#60A5FA]/10 hover:bg-[#60A5FA]/25",
  /** Turquesa: llamar es verde en iOS y Android, pero el verde ya es de
   *  WhatsApp; turquesa conserva la asociación sin chocar. 12,2:1 */
  telefono: "text-[#5EEAD4] border-[#5EEAD4]/40 bg-[#5EEAD4]/10 hover:bg-[#5EEAD4]/25",
  /** Ámbar: el globo no tiene color propio fuerte; se separa de todos los
   *  demás y se lee como "afuera". 10,8:1 */
  web: "text-[#FBBF24] border-[#FBBF24]/40 bg-[#FBBF24]/10 hover:bg-[#FBBF24]/25",
  /** Fucsia: las plataformas sociales tiran a violeta-rosa. 7,3:1 */
  redes: "text-[#E879F9] border-[#E879F9]/40 bg-[#E879F9]/10 hover:bg-[#E879F9]/25",
  /** Naranja: el pin de Google Maps es rojo, descartado por marca; naranja es
   *  lo más cercano que no lo es. 8,0:1 */
  maps: "text-[#FB923C] border-[#FB923C]/40 bg-[#FB923C]/10 hover:bg-[#FB923C]/25",
} as const;

interface Canal {
  key: string;
  icon: React.ReactNode;
  /** Se anuncia al lector de pantalla y es el tooltip. Lleva el dato adentro. */
  label: string;
  href?: string;
  external?: boolean;
  /** El de redes no navega: abre el modal. */
  onClick?: () => void;
  on: boolean;
  color: string;
}

export default function ContactDots({ c }: { c: CrmContact }) {
  const [redesAbiertas, setRedesAbiertas] = useState(false);

  const redes = [
    { nombre: "Instagram", url: c.instagram_url },
    { nombre: "Facebook", url: c.facebook_url },
    { nombre: "LinkedIn", url: c.linkedin_url },
  ].filter((r): r is { nombre: string; url: string } => !!r.url);

  const canales: Canal[] = [
    {
      key: "wa",
      icon: <IconWhatsApp />,
      label: c.whatsapp_phone ? `WhatsApp — ${formatArPhone(c.whatsapp_phone)}` : "Sin WhatsApp",
      href: c.whatsapp_phone ? `https://wa.me/${c.whatsapp_phone}` : undefined,
      external: true,
      on: !!c.whatsapp_phone,
      color: TONO.whatsapp,
    },
    {
      key: "email",
      icon: <IconEmail />,
      label: c.email ? `Escribir a ${c.email}` : "Sin email",
      href: c.email ? `mailto:${c.email}` : undefined,
      on: !!c.email,
      color: TONO.email,
    },
    {
      key: "tel",
      icon: <IconPhone />,
      label: c.phone ? `Llamar a ${formatArPhone(c.phone)}` : "Sin teléfono",
      href: c.phone ? `tel:+${c.phone}` : undefined,
      on: !!c.phone,
      color: TONO.telefono,
    },
    {
      key: "web",
      icon: <IconGlobe />,
      label: c.website ? `Abrir ${c.website}` : "Sin sitio web",
      href: c.website ?? undefined,
      external: true,
      on: !!c.website,
      color: TONO.web,
    },
    {
      key: "redes",
      icon: <IconRedes />,
      label: redes.length
        ? `Redes sociales: ${redes.map((r) => r.nombre).join(", ")}`
        : "Sin redes sociales",
      onClick: redes.length ? () => setRedesAbiertas(true) : undefined,
      on: redes.length > 0,
      color: TONO.redes,
    },
    {
      key: "maps",
      icon: <IconMapPin />,
      label: c.google_maps_url ? "Ver en Google Maps" : "Sin ficha de Google Maps",
      href: c.google_maps_url ?? undefined,
      external: true,
      on: !!c.google_maps_url,
      color: TONO.maps,
    },
  ];

  return (
    <div
      // `flex-nowrap`: con `flex-wrap` la fila de seis chips se partía en dos
      // líneas y la altura de cada fila de la tabla crecía. La tabla ya tiene
      // scroll horizontal con la primera columna fija, así que es preferible
      // que estos seis se mantengan en una línea y se llegue a ellos
      // desplazando, antes que engordar las 50 filas.
      className="flex flex-nowrap items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {canales.map((canal) => {
        if (!canal.on) {
          return (
            <span key={canal.key} title={canal.label} className={`${CHIP} ${CHIP_OFF}`}>
              {canal.icon}
            </span>
          );
        }
        if (canal.onClick) {
          return (
            <button
              key={canal.key}
              type="button"
              onClick={canal.onClick}
              title={canal.label}
              aria-label={canal.label}
              className={`${CHIP} ${canal.color} cursor-pointer`}
            >
              {canal.icon}
            </button>
          );
        }
        return (
          <a
            key={canal.key}
            href={canal.href}
            title={canal.label}
            aria-label={canal.label}
            {...(canal.external
              ? { target: "_blank", rel: "noopener noreferrer nofollow" }
              : {})}
            className={`${CHIP} ${canal.color}`}
          >
            {canal.icon}
          </a>
        );
      })}

      {/* Solo informativo: el teléfono que dio Google venía marcado como
          celular. No cuenta como WhatsApp confirmado y por eso no cambia la
          prioridad — para eso hace falta evidencia. Va como signo de pregunta
          y no como icono: lo que comunica es la duda, no un canal. */}
      {!c.whatsapp_phone && c.whatsapp_likely && (
        <span
          title="El teléfono parece un celular — puede tener WhatsApp, pero no está confirmado"
          className={`${CHIP} border-dashed border-[#4ADE80]/50 text-[#4ADE80]/90 bg-transparent cursor-default text-[13px] font-bold leading-none w-7 h-7`}
        >
          ?
        </span>
      )}

      <Modal
        open={redesAbiertas}
        onClose={() => setRedesAbiertas(false)}
        title="Redes sociales"
        subtitle={c.business_name ?? c.contact_name ?? undefined}
        width="max-w-md"
      >
        <div className="px-6 py-5 space-y-2">
          {redes.map((r) => (
            <a
              key={r.nombre}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="flex items-center justify-between gap-3 px-4 py-3 bg-[#0D0D0F] border border-[#6A6A70] rounded-sm hover:border-[#4A4A52] transition-colors group"
            >
              <div className="min-w-0">
                <p className="text-[15px] font-display font-semibold text-white">{r.nombre}</p>
                <p className="text-[13px] text-[#8A8A8A] truncate">{r.url}</p>
              </div>
              <IconExternal className="w-4 h-4 shrink-0 text-[#6E6E76] group-hover:text-white transition-colors" />
            </a>
          ))}
        </div>
      </Modal>
    </div>
  );
}
