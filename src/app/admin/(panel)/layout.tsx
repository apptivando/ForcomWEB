import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/roles";
import AdminSidebar from "@/components/admin/AdminSidebar";

export const metadata = { title: "Panel FORCOM" };

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  // Tener sesión de Supabase no alcanza: hay que estar en admin_members. Un
  // usuario de Auth sin fila acá no es miembro del panel. `proxy.ts` ya lo
  // frena antes, pero esto también resuelve el rol, que el menú necesita para
  // saber si mostrar Miembros.
  const role = await getCurrentRole(supabase);
  if (!role) redirect("/admin/login?error=no-autorizado");

  return (
    <div className="min-h-screen bg-[#0D0D0F] flex">
      <AdminSidebar userEmail={user.email ?? ""} role={role} />
      <main className="flex-1 flex flex-col min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  );
}
