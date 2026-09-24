import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 renombró "Middleware" a "Proxy" — el archivo tiene que estar
// acá (raíz de src/, nombre exacto proxy.ts) para que el framework lo
// reconozca. Antes vivía en lib/supabase/middleware-proxy.ts, que nunca
// se ejecutaba (era código muerto): /admin/* solo estaba protegido por
// el chequeo de sesión en admin/(panel)/layout.tsx, que no corre para
// rutas reescritas con rewrites() en next.config.ts (como /admin/crm,
// proxeada al CRM de WhatsApp) — con eso quedaban sin gate de login.
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLoginPage = path === "/admin/login";
  const isJoinPage = path.startsWith("/admin/join");
  // Recuperar contraseña es, por definición, para quien no puede entrar.
  const isRecoveryPage = path.startsWith("/admin/recuperar");
  const isAdminRoute = path.startsWith("/admin");
  const isPublicAdminRoute = isLoginPage || isJoinPage || isRecoveryPage;

  if (isAdminRoute && !isPublicAdminRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  // Sesión válida no alcanza — tiene que estar en admin_members (fase 1
  // del Track E, 01/08/2026). Un usuario de Supabase Auth sin fila acá
  // (ej. alguien que se registró por su cuenta, no invitado) no entra.
  if (isAdminRoute && !isPublicAdminRoute && user) {
    const { data: member } = await supabase
      .from("admin_members")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("error", "no-autorizado");
      return NextResponse.redirect(url);
    }
  }

  if (isLoginPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/admin/:path*"],
};
