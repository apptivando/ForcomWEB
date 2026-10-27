import { sectionTitle } from "@/lib/admin/sections";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentRole, hasMinRole } from "@/lib/auth/roles";
import MembersEditor from "@/components/admin/MembersEditor";
import type { AdminMember, AdminInvitation } from "@/lib/types";

export const metadata = { title: sectionTitle("miembros") };

export default async function MiembrosPage() {
  const supabase = await createClient();
  const role = await getCurrentRole(supabase);
  if (!hasMinRole(role, "admin")) redirect("/admin/dashboard");

  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase
      .from("admin_members")
      .select("*")
      .order("created_at", { ascending: true }),
    // Columnas explícitas, no `*`: `token_hash` no tiene por qué viajar al
    // navegador aunque sea un hash.
    supabase
      .from("admin_invitations")
      .select("id, email, role, invited_by, accepted_at, expires_at, created_at")
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  // admin_members solo guarda user_id — el email vive en auth.users,
  // que el cliente anon no puede leer. Se cruza acá con la service role
  // (cantidad de miembros esperada: unos pocos, sin paginar).
  const admin = createAdminClient();
  const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 200 });
  const emailByUserId = new Map(usersPage?.users.map((u) => [u.id, u.email ?? ""]));

  const { data: { user: currentUser } } = await supabase.auth.getUser();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">
          Miembros del panel
        </h1>
        <p className="text-[15px] text-[#8A8A8A] mt-1 max-w-prose">
          Quién puede entrar a /admin y qué puede hacer cada uno.
        </p>
      </div>

      {/* Esta tabla sale de lo que efectivamente exige el código
          (`requireRole`) sobre las secciones que existen en ESTE panel, no de
          una descripción aspiracional.

          En `develop` el mismo texto enumera bandeja de WhatsApp, clientes,
          pipeline, asistente de IA y plantillas de contacto en frío. Nada de
          eso vive acá: el CRM se mudó a Apptivando CRM (24/09/2026) y esas
          secciones quedaron congeladas en `develop`. Si alguna vuelve —o si se
          embebe el CRM nuevo—, este bloque se actualiza con ella; mientras
          tanto describir permisos sobre pantallas que no se ven es peor que no
          explicar nada. */}
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-5 mb-8 max-w-3xl">
        <p className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-3">
          Qué puede hacer cada rol
        </p>
        <dl className="space-y-3 text-[15px]">
          <div className="grid grid-cols-[88px_1fr] gap-3">
            <dt className="font-display font-bold text-white">Agente</dt>
            <dd className="text-[#B0B0B0]">
              Todo el contenido del sitio: productos, Sección Hero e Info
              empresa, más los mensajes que llegan por el formulario.
            </dd>
          </div>
          <div className="grid grid-cols-[88px_1fr] gap-3">
            <dt className="font-display font-bold text-white">Admin</dt>
            <dd className="text-[#B0B0B0]">
              Lo del agente, más esta pantalla: invitar gente, cambiarle el rol
              y quitarla. Es lo único que un agente no puede hacer.
            </dd>
          </div>
          <div className="grid grid-cols-[88px_1fr] gap-3">
            <dt className="font-display font-bold text-white">Dueño</dt>
            <dd className="text-[#B0B0B0]">
              Hoy los mismos permisos que Admin. La diferencia es que{" "}
              <span className="text-white">la cuenta no se puede quedar sin dueño</span>:
              al último no se le puede bajar el rol ni quitarlo.
            </dd>
          </div>
        </dl>
      </div>
      <MembersEditor
        members={(members ?? []) as AdminMember[]}
        invitations={(invitations ?? []) as AdminInvitation[]}
        emailByUserId={Object.fromEntries(emailByUserId)}
        currentUserId={currentUser?.id ?? ""}
      />
    </div>
  );
}
