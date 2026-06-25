import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ count: totalProducts }, { count: newMessages }, { count: totalMessages }] =
    await Promise.all([
      supabase.from("products").select("*", { count: "exact", head: true }).eq("active", true),
      supabase.from("contact_messages").select("*", { count: "exact", head: true }).eq("status", "nuevo"),
      supabase.from("contact_messages").select("*", { count: "exact", head: true }),
    ]);

  const { data: recentMessages } = await supabase
    .from("contact_messages")
    .select("id, name, company, email, industry, status, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  const statusLabel: Record<string, string> = {
    nuevo: "Nuevo",
    leido: "Leído",
    contactado: "Contactado",
  };
  const statusColor: Record<string, string> = {
    nuevo: "bg-[#E8231A]/10 text-[#E8231A] border-[#E8231A]/20",
    leido: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    contactado: "bg-green-500/10 text-green-400 border-green-500/20",
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display font-extrabold text-3xl text-white">Dashboard</h1>
        <p className="text-[#8A8A8A] mt-1">Resumen del sitio FORCOM</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6">
          <p className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-2">
            Productos activos
          </p>
          <p className="font-display font-extrabold text-4xl text-white">{totalProducts ?? 0}</p>
        </div>
        <div className="bg-[#141416] border border-[#E8231A]/30 rounded-sm p-6 relative overflow-hidden">
          {(newMessages ?? 0) > 0 && (
            <div className="absolute top-3 right-3 w-2 h-2 bg-[#E8231A] rounded-full animate-pulse" />
          )}
          <p className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-2">
            Mensajes nuevos
          </p>
          <p className="font-display font-extrabold text-4xl text-[#E8231A]">{newMessages ?? 0}</p>
        </div>
        <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6">
          <p className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-2">
            Total mensajes
          </p>
          <p className="font-display font-extrabold text-4xl text-white">{totalMessages ?? 0}</p>
        </div>
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2A2A2E]">
                  <th className="text-left px-5 py-3 text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A]">Nombre</th>
                  <th className="text-left px-5 py-3 text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] hidden sm:table-cell">Empresa</th>
                  <th className="text-left px-5 py-3 text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] hidden md:table-cell">Industria</th>
                  <th className="text-left px-5 py-3 text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A]">Estado</th>
                  <th className="text-left px-5 py-3 text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] hidden lg:table-cell">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recentMessages.map((msg, i) => (
                  <tr key={msg.id} className={`border-b border-[#2A2A2E] last:border-0 ${i % 2 === 0 ? "" : "bg-[#1A1A1E]/30"}`}>
                    <td className="px-5 py-3">
                      <p className="text-white font-semibold">{msg.name}</p>
                      <p className="text-[#8A8A8A] text-xs">{msg.email}</p>
                    </td>
                    <td className="px-5 py-3 text-[#B0B0B0] hidden sm:table-cell">{msg.company ?? "—"}</td>
                    <td className="px-5 py-3 text-[#B0B0B0] hidden md:table-cell capitalize">{msg.industry ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 text-[10px] font-display font-bold tracking-[0.1em] uppercase rounded-sm border ${statusColor[msg.status]}`}>
                        {statusLabel[msg.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[#8A8A8A] text-xs hidden lg:table-cell">
                      {new Date(msg.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
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
