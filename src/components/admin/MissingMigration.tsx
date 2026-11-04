/** Aviso para cuando una sección necesita una migración que todavía no se corrió. */
export default function MissingMigration({ what, file = "024_garantias_revendedores_franja.sql" }: { what: string; file?: string }) {
  return (
    <p className="max-w-3xl text-[15px] text-[#E8E2CC] bg-[#15150F] border border-[#3A3520] border-l-[3px] border-l-[#C9A227] rounded-sm px-4 py-3">
      Para editar {what} falta correr la migración <code className="text-white">{file}</code> en el SQL Editor de Supabase.
      Mientras tanto el sitio sigue andando sin esa parte.
    </p>
  );
}
