/**
 * Marco de las pantallas de acceso que se ven sin sesión: login, aceptar
 * invitación y recuperar contraseña. Logo, tarjeta centrada y fondo, para que
 * las tres se vean como la misma puerta.
 *
 * Sin "use client": lo usan tanto server components como componentes cliente.
 */

export default function AuthShell({
  subtitle,
  children,
}: {
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-2 h-6 bg-[#E8231A]" />
            <span className="font-display font-extrabold text-2xl tracking-tight text-white">
              FORCOM
            </span>
          </div>
          <p className="text-[#8A8A8A] text-[15px]">{subtitle}</p>
        </div>
        <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-8">{children}</div>
      </div>
    </div>
  );
}
