import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentRole, hasMinRole } from "@/lib/auth/roles";
import MembersEditor from "@/components/admin/MembersEditor";
import type { AdminMember, AdminInvitation } from "@/lib/types";

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
        <p className="text-sm text-[#8A8A8A] mt-1">
          Quién puede entrar a /admin y qué puede hacer cada uno.
        </p>
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
