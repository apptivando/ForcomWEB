import type { Fact } from "@/lib/types";

/**
 * Franja de datos debajo del carrusel ("12 meses de garantía", "Todo el
 * país"…). Se edita en el panel, sección "Franja de datos".
 *
 * Arranca apagada: la tabla `facts` nace vacía (migración 024) y, mientras no
 * tenga datos, esto no dibuja nada. En cuanto alguien carga uno, aparece.
 */
export default function FactsStrip({ facts }: { facts: Pick<Fact, "title" | "text">[] }) {
  const items = facts.filter((f) => f.title.trim());
  if (items.length === 0) return null;

  return (
    <div className="bg-forcom-dark border-y border-forcom-border">
      <div
        className={`max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-2 ${
          items.length >= 3 ? "lg:grid-cols-[repeat(var(--n),minmax(0,1fr))]" : "sm:grid-cols-[repeat(var(--n),minmax(0,1fr))]"
        }`}
        style={{ "--n": items.length } as React.CSSProperties}
      >
        {items.map((f, i) => (
          <div
            key={`${i}-${f.title}`}
            className="py-6 px-4 text-center border-forcom-border lg:[&:not(:first-child)]:border-l"
          >
            <p className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-white uppercase">{f.title}</p>
            {f.text && <p className="text-sm text-forcom-gray mt-1 leading-snug">{f.text}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
