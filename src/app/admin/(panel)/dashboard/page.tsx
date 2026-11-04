import { sectionTitle } from "@/lib/admin/sections";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: sectionTitle("dashboard") };

type Recent = { id: string; title: string; detail: string; created_at: string; href: string; kind: string };

/**
 * Inicio del panel. Mismo armado que el de LatinOfficeWEB (04/11/2026): una
 * tarjeta por bandeja (garantías, mensajes, revendedores) y los últimos
 * ingresos de los tres formularios juntos. Las tarjetas son enlaces: el
 * dashboard tiene que dejar actuar, no solo informar.
 *
 * Sin la migración 024 las consultas de garantías y revendedores fallan y
 * cuentan 0; el resto anda igual.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };

  const [
    { count: activeProducts },
    { count: pendingWarranties },
    { count: activeWarranties },
    { count: newMessages },
    { count: newResellers },
    { data: warranties },
    { data: messages },
    { data: resellers },
  ] = await Promise.all([
    supabase.from("products").select("*", head).eq("active", true),
    supabase.from("warranties").select("*", head).eq("status", "pendiente"),
    supabase.from("warranties").select("*", head).eq("status", "activa"),
    supabase.from("contact_messages").select("*", head).eq("status", "nuevo"),
    supabase.from("reseller_requests").select("*", head).eq("status", "nuevo"),
    supabase
      .from("warranties")
      .select("id, code, customer_name, product_name, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    // El spam no cuenta: era justo lo que inflaba este número.
    supabase
      .from("contact_messages")
      .select("id, name, company, created_at")
      .neq("status", "spam")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("reseller_requests")
      .select("id, company, province, created_at")
      .neq("status", "spam")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const recent: Recent[] = [
    ...(warranties ?? []).map((w) => ({
      id: `w-${w.id}`,
      kind: w.status === "pendiente" ? "Garantía para validar" : "Garantía",
      title: `${w.code} · ${w.customer_name}`,
      detail: w.product_name,
      created_at: w.created_at,
      href: "/admin/garantias",
    })),
    ...(messages ?? []).map((m) => ({
      id: `m-${m.id}`,
      kind: "Contacto",
      title: m.name,
      detail: m.company ?? "",
      created_at: m.created_at,
      // Lleva al mensaje ya expandido.
      href: `/admin/mensajes?m=${m.id}`,
    })),
    ...(resellers ?? []).map((r) => ({
      id: `r-${r.id}`,
      kind: "Revendedor",
      title: r.company,
      detail: r.province,
      created_at: r.created_at,
      href: "/admin/revendedores",
    })),
  ]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8);

  const cardCls = "bg-[#141416] border border-[#2A2A2E] rounded-sm p-6 hover:border-[#3A3A3E] transition-colors";
  const hotCls = "bg-[#141416] border border-[#E8231A]/30 rounded-sm p-6 hover:border-[#E8231A]/60 transition-colors";

  const cards = [
    {
      href: "/admin/garantias",
      label: "Garantías para validar",
      value: pendingWarranties ?? 0,
      note: `${activeWarranties ?? 0} activas`,
      hot: (pendingWarranties ?? 0) > 0,
    },
    {
      href: "/admin/mensajes",
      label: "Mensajes nuevos",
      value: newMessages ?? 0,
      note: "Formulario de contacto propio",
      hot: (newMessages ?? 0) > 0,
    },
    {
      href: "/admin/revendedores",
      label: "Revendedores nuevos",
      value: newResellers ?? 0,
      note: "Esperan la lista mayorista",
      hot: (newResellers ?? 0) > 0,
    },
    { href: "/admin/productos", label: "Productos activos", value: activeProducts ?? 0, note: "Ver el catálogo", hot: false },
  ];

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="font-display font-extrabold text-4xl text-white">Dashboard</h1>
        <p className="text-[#8A8A8A] mt-1 max-w-prose">Resumen del sitio FORCOM</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className={c.hot ? hotCls : cardCls}>
            <p className="text-[13px] font-medium text-[#B0B0B0] mb-2">{c.label}</p>
            <p className={`font-display font-extrabold text-4xl ${c.hot ? "text-[#FF6A5C]" : "text-white"}`}>{c.value}</p>
            <p className="text-[13px] text-[#8A8A8A] mt-1">{c.note}</p>
          </Link>
        ))}
      </div>

      <h2 className="font-display font-bold text-lg text-white mb-4">Últimos ingresos</h2>
      {recent.length === 0 ? (
        <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-8 text-center text-[#8A8A8A]">
          Todavía no entró nada por los formularios del sitio.
        </div>
      ) : (
        <ul className="bg-[#141416] border border-[#2A2A2E] rounded-sm divide-y divide-[#2A2A2E]">
          {recent.map((r) => (
            <li key={r.id}>
              <Link href={r.href} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-[#1A1A1E] transition-colors">
                <span className="text-[12px] font-semibold tracking-[0.1em] uppercase text-[#8A8A8A] w-44 shrink-0">{r.kind}</span>
                <span className="text-white font-semibold min-w-0 flex-1">{r.title}</span>
                <span className="text-[13px] text-[#B0B0B0]">{r.detail}</span>
                <span className="text-[13px] text-[#8A8A8A]">
                  {new Date(r.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
