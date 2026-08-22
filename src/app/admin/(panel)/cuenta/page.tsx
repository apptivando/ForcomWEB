/**
 * Mi cuenta: cambiar la propia contraseña.
 *
 * Es la misma pantalla que la de la invitación (`PasswordForm`), en modo
 * "change": muestra la casilla asociada y acá además pide la contraseña
 * actual.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole, ROLE_LABEL } from "@/lib/auth/roles";
import PasswordForm from "@/components/admin/PasswordForm";

export default async function CuentaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/admin/login");

  const role = await getCurrentRole(supabase);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display font-extrabold text-2xl text-white tracking-tight">
          Mi cuenta
        </h1>
        <p className="text-sm text-[#8A8A8A] mt-1">
          Tu acceso al panel{role ? ` — entrás como ${ROLE_LABEL[role]}` : ""}.
        </p>
      </div>

      <div className="max-w-sm bg-[#141416] border border-[#2A2A2E] rounded-sm p-6">
        <h3 className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-4">
          Cambiar contraseña
        </h3>
        <PasswordForm mode="change" email={user.email} />
      </div>
    </div>
  );
}
