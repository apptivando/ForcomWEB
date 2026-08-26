import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/roles";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { ToastProvider } from "@/components/admin/Toast";

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

  const role = await getCurrentRole(supabase);
  if (!role) redirect("/admin/login");

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#0D0D0F] flex">
        {/* C9 — Con teclado hay que atravesar 13 ítems de menú antes del
            contenido, en cada página. Este enlace es invisible hasta que
            recibe foco. */}
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70]
                     focus:px-4 focus:py-2 focus:rounded-sm focus:bg-[#C41D16] focus:text-white
                     focus:font-display focus:font-bold focus:text-[15px]"
        >
          Saltar al contenido
        </a>
        <AdminSidebar userEmail={user.email ?? ""} role={role} />
        {/*
          `min-w-0` NO es opcional: sin él, un ítem flex resuelve `min-width:auto`
          al ancho intrínseco de su contenido, así que la tabla de Clientes
          (~1200 px) estira el main, la fila flex se hace más ancha que la
          ventana y el contenido termina pasando por debajo del menú fijo.
          Antes lo tapaba `overflow-auto` —un overflow distinto de `visible`
          hace que ese mínimo valga 0— pero eso era un efecto secundario, no
          una decisión. Esta es la forma explícita.

          `pt-14` deja lugar a la barra superior de mobile, que es fija.
        */}
        <main
          id="contenido"
          tabIndex={-1}
          className="flex-1 min-w-0 flex flex-col min-h-screen pt-14 lg:pt-0 outline-none"
        >
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
