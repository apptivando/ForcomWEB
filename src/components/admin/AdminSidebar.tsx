"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AdminRole } from "@/lib/auth/roles";
import { sectionLabel } from "@/lib/admin/sections";

// Sin `label`: el nombre de cada sección sale de SECTION_LABEL al renderizar.
// Antes vivía acá y divergía del encabezado de la página ("Mensajes del
// formulario" vs. "Mensajes / CRM", "Sección Hero" vs. "Carrusel Hero"), y
// había que confirmar que uno había llegado a donde quería.
const navItems = [
  {
    href: "/admin/dashboard",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    href: "/admin/hero",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
  },
  {
    href: "/admin/productos",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
  {
    href: "/admin/clientes",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  {
    href: "/admin/inbox",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
  },
  {
    href: "/admin/lineas",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    ),
  },
  {
    href: "/admin/plantillas",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
  },
  {
    href: "/admin/agente",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
      </svg>
    ),
  },
  {
    href: "/admin/pipelines",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    href: "/admin/automatizaciones",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.13l1.41-.513M5.106 17.785l1.15-.964m11.49-9.642l1.149-.964M7.501 19.795l.75-1.3m7.5-12.99l.75-1.3m-6.063 16.658l.26-1.477m2.605-14.772l.26-1.477m0 17.726l-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.795l-.75-1.3M7.5 4.205L8.25 5.5m9.792 8.892l1.15.964m-11.49-9.642l-1.15-.964" />
      </svg>
    ),
  },
  {
    href: "/admin/crm",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
  },
  {
    href: "/admin/empresa",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
];

const membersNavItem = {
  href: "/admin/miembros",
  icon: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
};


/**
 * El menú, agrupado.
 *
 * Trece ítems seguidos son una lista que hay que leer entera; tres grupos de
 * tres a cinco son un mapa que se recorre por zona. Los nombres siguen saliendo
 * de SECTION_LABEL — acá solo se define el orden y a qué bloque pertenece cada
 * uno.
 *
 * El Dashboard va suelto arriba, sin rótulo: es el punto de entrada, no una
 * categoría. Miembros va al final y solo lo ven owner y admin.
 */
const GRUPOS: Array<{ label: string | null; hrefs: string[]; soloAdmin?: boolean }> = [
  { label: null, hrefs: ["/admin/dashboard"] },
  { label: "Sitio", hrefs: ["/admin/hero", "/admin/productos", "/admin/empresa"] },
  { label: "Ventas", hrefs: ["/admin/clientes", "/admin/pipelines", "/admin/crm"] },
  {
    label: "WhatsApp",
    hrefs: [
      "/admin/inbox",
      "/admin/lineas",
      "/admin/plantillas",
      "/admin/agente",
      "/admin/automatizaciones",
    ],
  },
  { label: "Cuenta", hrefs: ["/admin/miembros"], soloAdmin: true },
];

/** Dibujo de cada ítem, por ruta. Se arma una sola vez. */
const ICONO_POR_RUTA: Record<string, React.ReactNode> = Object.fromEntries(
  [...navItems, membersNavItem].map((item) => [item.href, item.icon])
);

export default function AdminSidebar({
  userEmail,
  role,
}: {
  userEmail: string;
  role: AdminRole;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const esAdmin = role === "owner" || role === "admin";
  // Cajón de navegación en pantallas chicas. En `lg` para arriba el menú es
  // fijo al costado y este estado no se usa.
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Navegar cierra el cajón: si no, se elige una sección y el menú queda
  // tapando la pantalla que se acaba de abrir.
  //
  // Ajuste durante el render y no en un efecto — mismo patrón que Drawer.tsx:
  // es lo que recomienda React para reaccionar a un cambio de prop, y evita el
  // commit desperdiciado de llamar a setState dentro de un efecto.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setDrawerOpen(false);
  }

  // Con el cajón abierto, el fondo no scrollea y Escape cierra — mismas dos
  // reglas que el resto de los overlays del panel (ver Modal.tsx).
  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !e.defaultPrevented) setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <>
      {/* ── Barra superior, solo en pantallas chicas ─────────────────────────
          El panel no se podía usar en el teléfono: el menú se llevaba 224 px
          de los 375 y quedaban ~150 para el contenido, sin ningún botón para
          plegarlo. Y una bandeja de WhatsApp es, por definición, algo que se
          quiere mirar desde el teléfono. */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center gap-3 px-4 bg-[#141416] border-b border-[#2A2A2E]">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={drawerOpen}
          className="p-2 -ml-2 text-[#B0B0B0] hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <div className="min-w-0">
          <p className="font-display font-extrabold text-[15px] tracking-tight text-white truncate">
            {sectionLabel(pathname)}
          </p>
        </div>
      </header>

      {/* Velo del cajón. Solo existe en mobile, donde el menú tapa todo. */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
        />
      )}

      <aside
        className={`bg-[#141416] border-r border-[#2A2A2E] flex flex-col overflow-y-auto
                    fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-200 ease-out
                    motion-reduce:transition-none
                    ${drawerOpen ? "translate-x-0" : "-translate-x-full"}
                    lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:z-auto lg:w-56 lg:shrink-0`}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-[#2A2A2E] flex items-center justify-between">
          <div>
            <Link href="/" target="_blank" className="flex items-center gap-2 group">
              <div className="w-1.5 h-5 bg-[#E8231A]" />
              <span className="font-display font-extrabold text-lg tracking-tight text-white group-hover:text-[#FF6A5C] transition-colors">
                FORCOM
              </span>
            </Link>
            <p className="text-[12px] text-[#8A8A8A] tracking-[0.15em] uppercase mt-0.5 pl-3.5">
              Panel Admin
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Cerrar menú"
            className="lg:hidden p-1 -mr-1 text-[#8A8A8A] hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4">
        {GRUPOS.filter((g) => !g.soloAdmin || esAdmin).map((grupo, gi) => (
          <div key={grupo.label ?? "inicio"} className={gi > 0 ? "mt-5" : ""}>
            {grupo.label && (
              <p className="px-4 mb-1.5 text-[12px] font-semibold tracking-[0.12em] uppercase text-[#6A6A70]">
                {grupo.label}
              </p>
            )}
            <div className="space-y-0.5">
              {grupo.hrefs.map((href) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    // "Dónde estoy parado" no puede depender solo del matiz: la
                    // barra roja de 3 px a la izquierda lo dice también por forma.
                    // `min-h-11` = 44 px, el objetivo táctil de WCAG.
                    className={`relative flex items-center gap-3 pl-4 pr-3 py-2.5 min-h-11 rounded-sm text-[15px] font-display font-semibold transition-colors ${
                      active
                        ? "bg-[#E8231A]/10 text-[#FF6A5C] border border-[#E8231A]/25 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:bg-[#E8231A] before:rounded-sm"
                        : "text-[#B0B0B0] hover:bg-[#1A1A1E] hover:text-white border border-transparent"
                    }`}
                  >
                    {ICONO_POR_RUTA[href]}
                    {sectionLabel(href)}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      {/* User + logout */}
      <div className="px-3 py-4 border-t border-[#2A2A2E]">
        <div className="px-3 py-2 mb-1">
          <p className="text-[12px] text-[#8A8A8A] tracking-[0.1em] uppercase truncate">
            {userEmail}
          </p>
        </div>
        <Link
          href="/admin/cuenta"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-[15px] font-display font-semibold transition-colors ${
            pathname.startsWith("/admin/cuenta")
              ? "bg-[#E8231A]/10 text-[#FF6A5C]"
              : "text-[#8A8A8A] hover:text-white hover:bg-[#1A1A1E]"
          }`}
        >
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
          </svg>
          Mi cuenta
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-[15px] font-display font-semibold text-[#8A8A8A] hover:text-[#FF6A5C] hover:bg-[#E8231A]/5 transition-colors"
        >
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          Cerrar sesión
        </button>
        <Link
          href="/"
          target="_blank"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-[15px] font-display font-semibold text-[#8A8A8A] hover:text-white hover:bg-[#1A1A1E] transition-colors"
        >
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          Ver sitio
        </Link>
      </div>
    </aside>
    </>
  );
}
