import { getSellerStats, listReviews, getReviewQueue } from "@/app/admin/review-actions";
import { listMembersForAssignment } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/roles";
import SellersView from "@/components/admin/SellersView";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function VendedoresPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.dias) ? sp.dias[0] : sp.dias;
  const days = Math.min(Math.max(Number(raw) || 7, 1), 90);

  const supabase = await createClient();
  const role = await getCurrentRole(supabase);

  // Los hallazgos son sobre cómo trabajó una persona. RLS ya lo impone en la
  // tabla; esto evita que la pantalla explote con un error de permisos.
  if (role !== "owner" && role !== "admin") {
    return (
      <div className="p-8">
        <h1 className="font-display font-extrabold text-3xl text-white">Vendedores</h1>
        <p className="text-[#8A8A8A] mt-2">Solo un owner o un admin puede ver esta pantalla.</p>
      </div>
    );
  }

  const [stats, reviews, queue, memberList] = await Promise.all([
    getSellerStats(days),
    listReviews({ days }),
    getReviewQueue(),
    listMembersForAssignment(),
  ]);

  const members = Object.fromEntries(memberList.map((m) => [m.user_id, m.email]));
  const sinLineas = stats.every((s) => s.conversations === 0);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-display font-extrabold text-3xl text-white">Vendedores</h1>
        <p className="text-[#8A8A8A] mt-1 max-w-3xl">
          Cómo se está atendiendo por las líneas conectadas, y qué conviene revisar.
        </p>
      </div>

      {sinLineas && (
        <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-5 mb-6 max-w-3xl text-sm text-[#B0B0B0]">
          <p>
            Todavía no hay actividad registrada. Conectá la línea de un vendedor en{" "}
            <a href="/admin/lineas" className="text-white underline underline-offset-4">
              Líneas de WhatsApp
            </a>{" "}
            y las conversaciones van a empezar a aparecer acá al día siguiente.
          </p>
        </div>
      )}

      <SellersView
        stats={stats}
        reviews={reviews}
        queue={queue}
        members={members}
        days={days}
      />
    </div>
  );
}
