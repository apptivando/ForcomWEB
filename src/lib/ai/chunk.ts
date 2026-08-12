// Chunking simple por párrafos, agrupando hasta un tamaño máximo.
// Los documentos de esta base de conocimiento son cortos (FAQs,
// políticas) — no hace falta nada más sofisticado que wacrm.

const MAX_CHUNK_CHARS = 800;

export function chunkText(content: string): string[] {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return [];

  const chunks: string[] = [];
  let current = "";

  for (const p of paragraphs) {
    if (current && (current.length + p.length + 2) > MAX_CHUNK_CHARS) {
      chunks.push(current);
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }
  if (current) chunks.push(current);

  return chunks;
}
