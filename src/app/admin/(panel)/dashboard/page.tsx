import { sectionTitle } from "@/lib/admin/sections";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: sectionTitle("dashboard") };

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: totalProducts },
    { count: newMessages },
    { count: totalMessages },
    { count: totalClients },
    { count: whatsappClients },
    { count: openDeals },
  ] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }).eq("active", true),
    supabase.from("contact_messages").select("*", { count: "exact", head: true }).eq("status", "nuevo"),
    // El spam no cuenta: era justo lo que inflaba este número.
    supabase.from("contact_messages").select("*", { count: "exact", head: true }).neq("status", "spam"),
    supabase.from("crm_contacts").select("id", { count: "exact", head: true }),
    // contact_tier = 1 significa WhatsApp confirmado con evidencia, no
    // "el número parece un celular".
    supabase.from("crm_contacts").select("id", { count: "exact", head: true }).eq("contact_tier", 1),
    supabase.from("pipeline_deals").select("id", { count: "exact", head: true }),
  ]);

  const { data: recentMessages } = await supabase
    .from("contact_messages")
    .select("id, name, company, email, industry, status, created_at")
    .neq("status", "spam")
    .order("created_at", { ascending: false })
    .limit(5);

  const statusLabel: Record<string, string> = {
    nuevo: "Nuevo",
    leido: "Leído",
    contactado: "Contactado",
    spam: "Spam",
  };
  const statusColor: Record<string, string> = {
    nuevo: "bg-[#E8231A]/10 text-[#FF6A5C] border-[#E8231A]/20",
    leido: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    contactado: "bg-green-500/10 text-green-400 border-green-500/20",
    spam: "bg-[#2A2A2E] text-[#8A8A8A] border-[#2A2A2E]",
  };

  // Las cuatro tarjetas son enlaces. Antes solo una lo era: el dashboard
  // informaba pero no dejaba actuar, que es lo contrario de lo que se espera
  // de la pantalla de inicio.
  const cardCls =
    "bg-[#141416] border border-[#2A2A2E] rounded-sm p-6 hover:border-[#3A3A3E] transition-colors";

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display font-extrabold text-4xl text-white">Dashboard</h1>
        <p className="text-[#8A8A8A] mt-1 max-w-prose">Resumen del sitio FORCOM</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <Link href="/admin/clientes?tier=1" className={cardCls}>
          <p className="text-[13px] font-medium text-[#A8A8A8] mb-2">
            Clientes con WhatsApp
          </p>
          <p className="font-display font-extrabold text-4xl text-green-400">{whatsappClients ?? 0}</p>
          <p className="text-[13px] text-[#8A8A8A] mt-1">de {totalClients ?? 0} en total</p>
        </Link>

        <Link href="/admin/productos" className={cardCls}>
          <p className="text-[13px] font-medium text-[#A8A8A8] mb-2">
            Productos activos
          </p>
          <p className="font-display font-extrabold text-4xl text-white">{totalProducts ?? 0}</p>
          <p className="text-[13px] text-[#8A8A8A] mt-1">Ver el catálogo</p>
        </Link>

        <Link
          href="/admin/crm"
          className="bg-[#141416] border border-[#E8231A]/30 rounded-sm p-6 relative overflow-hidden hover:border-[#E8231A]/60 transition-colors"
        >
          {(newMessages ?? 0) > 0 && (
            <div className="absolute top-3 right-3 w-2 h-2 bg-[#E8231A] rounded-full animate-pulse" />
          )}
          <p className="text-[13px] font-medium text-[#A8A8A8] mb-2">
            Mensajes nuevos
          </p>
          <p className="font-display font-extrabold text-4xl text-[#FF6A5C]">{newMessages ?? 0}</p>
          <p className="text-[13px] text-[#8A8A8A] mt-1">de {totalMessages ?? 0} recibidos</p>
        </Link>

        {/* Reemplaza a "Total mensajes", que repetía un número que ya está en la
            tarjeta de al lado. El pipeline es lo que falta saber a la mañana. */}
        <Link href="/admin/pipelines" className={cardCls}>
          <p className="text-[13px] font-medium text-[#A8A8A8] mb-2">
            Oportunidades
          </p>
          <p className="font-display font-extrabold text-4xl text-white">{openDeals ?? 0}</p>
          <p className="text-[13px] text-[#8A8A8A] mt-1">
            {(openDeals ?? 0) === 0 ? "Convertí un mensaje en oportunidad" : "En el pipeline"}
          </p>
        </Link>
      </div>

      {/* Recent messages */}
      <div>
        <h2 className="font-display font-bold text-lg text-white mb-4">Últimos mensajes</h2>
        {!recentMessages || recentMessages.length === 0 ? (
          <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-8 text-center text-[#8A8A8A]">
            Todavía no hay mensajes.
          </div>
        ) : (
          <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm overflow-hidden">
            <table className="w-full text-[15px]">
              <thead>
                <tr className="border-b border-[#2A2A2E]">
                  <th className="text-left px-5 py-3 text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A]">Nombre</th>
                  <th className="text-left px-5 py-3 text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] hidden sm:table-cell">Empresa</th>
                  <th className="text-left px-5 py-3 text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] hidden md:table-cell">Industria</th>
                  <th className="text-left px-5 py-3 text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A]">Estado</th>
                  <th className="text-left px-5 py-3 text-[12px] font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] hidden lg:table-cell">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recentMessages.map((msg, i) => (
                  <tr key={msg.id} className={`border-b border-[#2A2A2E] last:border-0 hover:bg-[#1A1A1E] transition-colors ${i % 2 === 0 ? "" : "bg-[#1A1A1E]/30"}`}>
                    {/* La fila entera lleva al mensaje ya expandido: se veía el
                        lead nuevo acá y había que ir a otra sección a buscarlo.
                        El Link va DENTRO de cada celda porque un ancla no puede
                        envolver una fila de tabla. */}
                    <td className="px-5 py-3">
                      <Link href={`/admin/crm?m=${msg.id}`} className="block">
                        <p className="text-white font-semibold">{msg.name}</p>
                        <p className="text-[#8A8A8A] text-[13px]">{msg.email}</p>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-[#B0B0B0] hidden sm:table-cell">
                      <Link href={`/admin/crm?m=${msg.id}`} className="block">{msg.company ?? "—"}</Link>
                    </td>
                    <td className="px-5 py-3 text-[#B0B0B0] hidden md:table-cell capitalize">
                      <Link href={`/admin/crm?m=${msg.id}`} className="block">{msg.industry ?? "—"}</Link>
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/admin/crm?m=${msg.id}`} className="block">
                        <span className={`px-2 py-0.5 text-[12px] font-bold tracking-[0.1em] uppercase rounded-sm border ${statusColor[msg.status]}`}>
                          {statusLabel[msg.status]}
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-[#8A8A8A] text-[13px] hidden lg:table-cell">
                      <Link href={`/admin/crm?m=${msg.id}`} className="block">
                        {new Date(msg.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
