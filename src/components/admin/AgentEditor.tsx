"use client";

import { useState, useTransition } from "react";
import {
  updateAiConfig,
  upsertKnowledgeDocument,
  deleteKnowledgeDocument,
  testAiReply,
  reindexKnowledgeEmbeddings,
} from "@/app/admin/actions";
import type { AiConfig, AiKnowledgeDocument } from "@/lib/types";
import type { ChatMessage } from "@/lib/ai/generate";
import { useFormGuard } from "@/lib/hooks/useUnsavedChanges";
import Toggle from "@/components/admin/Toggle";

const inputCls =
  "w-full bg-[#0D0D0F] border border-[#6A6A70] rounded-sm px-4 py-3 text-white placeholder:text-[#8A8A8A]/50 focus:border-[#4A4A52] focus:ring-2 focus:ring-[#FF6A5C]/60 focus:ring-offset-1 focus:ring-offset-[#0D0D0F] focus:outline-none transition-colors";
const labelCls =
  "block text-xs font-display font-semibold tracking-[0.15em] uppercase text-[#8A8A8A] mb-1.5";

export default function AgentEditor({
  initialConfig,
  initialDocuments,
}: {
  initialConfig: AiConfig;
  initialDocuments: AiKnowledgeDocument[];
}) {
  return (
    <div className="max-w-form space-y-8">
      <ConfigSection initialConfig={initialConfig} documents={initialDocuments} />
      <TestSection />
      <KnowledgeSection initialDocuments={initialDocuments} />
    </div>
  );
}

function TestSection() {
  const [, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleTest(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setError("");
    setLoading(true);
    const nextHistory: ChatMessage[] = [...history, { role: "user", content: message.trim() }];
    setHistory(nextHistory);
    setMessage("");
    startTransition(async () => {
      try {
        const reply = await testAiReply(nextHistory);
        setHistory((prev) => [...prev, { role: "assistant", content: reply }]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al probar.");
      } finally {
        setLoading(false);
      }
    });
  }

  function reset() {
    setHistory([]);
    setError("");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display font-bold text-lg text-white">Probar el asistente</h2>
        {history.length > 0 && (
          <button onClick={reset} className="text-[13px] text-[#8A8A8A] hover:text-white">
            Reiniciar conversación
          </button>
        )}
      </div>
      <p className="text-[13px] text-[#8A8A8A] mb-4">
        Simulá una conversación como si fueras cliente — sigue el hilo (podés contestar sus preguntas), no manda nada por WhatsApp.
      </p>
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6 space-y-4">
        {history.length > 0 && (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {history.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-sm px-4 py-2.5 text-[15px] whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-[#C41D16] text-white"
                      : "bg-[#0D0D0F] border border-[#6A6A70] text-white"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleTest} className="flex gap-3">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={history.length === 0 ? "¿Tenés impresora térmica?" : "Tu respuesta..."}
            className={inputCls}
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-[#C41D16] text-white text-[15px] font-display font-bold tracking-widest uppercase rounded-sm hover:bg-[#E8231A] transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? "..." : "Enviar"}
          </button>
        </form>

        {error && (
          <p className="text-[15px] text-[#FF6A5C] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-4 py-3">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/** Documento que quedó marcado como prueba y no debería contestarle a nadie. */
const MARCA_DE_PRUEBA = /\b(prueba|test|demo|borrador)\b/i;

function ConfigSection({
  initialConfig,
  documents,
}: {
  initialConfig: AiConfig;
  documents: AiKnowledgeDocument[];
}) {
  const [, startTransition] = useTransition();
  const [form, setForm] = useState({
    provider: initialConfig.provider,
    model: initialConfig.model,
    apiKey: "",
    embeddingsApiKey: "",
    system_prompt: initialConfig.system_prompt,
    auto_reply_enabled: initialConfig.auto_reply_enabled,
    max_replies_per_conversation: initialConfig.max_replies_per_conversation,
  });
  const [hasApiKey] = useState(initialConfig.hasApiKey);
  const [hasEmbeddingsKey, setHasEmbeddingsKey] = useState(initialConfig.hasEmbeddingsKey);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [reindexing, setReindexing] = useState(false);
  const [reindexMsg, setReindexMsg] = useState("");

  // Las instrucciones del asistente son texto largo escrito a mano: perderlo
  // por un clic en el menú es exactamente el caso que motivó el guard.
  const { markSaved } = useFormGuard(form, "La configuración del asistente tiene cambios sin guardar.");

  const docsDePrueba = documents.filter((d) => MARCA_DE_PRUEBA.test(d.title));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    startTransition(async () => {
      try {
        await updateAiConfig(form);
        if (form.embeddingsApiKey.trim()) setHasEmbeddingsKey(true);
        setForm((f) => ({ ...f, apiKey: "", embeddingsApiKey: "" }));
        markSaved({ ...form, apiKey: "", embeddingsApiKey: "" });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar.");
      } finally {
        setSaving(false);
      }
    });
  }

  function handleReindex() {
    setReindexMsg("");
    setReindexing(true);
    startTransition(async () => {
      try {
        const count = await reindexKnowledgeEmbeddings();
        setReindexMsg(`✓ ${count} fragmentos reindexados`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al reindexar.");
      } finally {
        setReindexing(false);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display font-semibold text-white">Respuesta automática</p>
            <p className="text-[13px] text-[#8A8A8A]">Contestar solo, usando la IA, mensajes nuevos.</p>
          </div>
          <Toggle
            checked={form.auto_reply_enabled}
            onChange={(next) => setForm((f) => ({ ...f, auto_reply_enabled: next }))}
            label="Respuesta automática"
          />
        </div>

        {/* Si la respuesta automática se enciende con documentos marcados como
            prueba, el asistente le contesta a clientes reales con plazos,
            garantías y formas de pago inventadas para probar. El aviso aparece
            solo cuando las dos condiciones se dan a la vez. */}
        {form.auto_reply_enabled && docsDePrueba.length > 0 && (
          <div className="bg-[#15150F] border border-[#3A3520] border-l-[3px] border-l-[#C9A227] rounded-sm px-4 py-3 text-[15px] text-[#E8E2CC]">
            <p className="font-semibold text-white mb-1">
              Hay {docsDePrueba.length === 1 ? "un documento marcado" : `${docsDePrueba.length} documentos marcados`} como prueba en la base de conocimiento
            </p>
            <p className="text-[13px] mb-2">
              Con la respuesta automática encendida, el asistente va a usar{" "}
              ese contenido para contestarle a clientes reales. Revisalo antes de
              guardar.
            </p>
            <ul className="text-[13px] list-disc pl-4 space-y-0.5">
              {docsDePrueba.map((d) => (
                <li key={d.id}>{d.title}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="proveedor" className={labelCls}>Proveedor</label>
            <select id="proveedor"
              value={form.provider}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value as "anthropic" | "openai" }))}
              className={inputCls}
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div>
            <label htmlFor="modelo" className={labelCls}>Modelo</label>
            <input id="modelo"
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              className={inputCls}
              placeholder="claude-haiku-4-5-20251001"
            />
          </div>
        </div>

        <div>
          <label htmlFor="clave-de-api" className={labelCls}>Clave de API</label>
          <input id="clave-de-api"
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            className={inputCls}
            placeholder={hasApiKey ? "•••••••••••• (dejar vacío para no cambiarla)" : "sk-..."}
          />
        </div>

        <div className="pt-2 border-t border-[#2A2A2E]">
          <label className={labelCls}>Clave de embeddings (OpenAI) — opcional, recomendada</label>
          <p className="text-[13px] text-[#8A8A8A] mb-2">
            Sin esto, el asistente solo encuentra respuestas si la pregunta usa palabras parecidas a las del documento
            (ej. no relaciona &quot;a qué hora atienden&quot; con &quot;horario de atención&quot;). Con esta clave busca
            por significado — es una clave distinta a la de arriba, siempre de OpenAI aunque el modelo de chat sea Claude
            (Anthropic no tiene API de embeddings).
          </p>
          <input
            type="password"
            value={form.embeddingsApiKey}
            onChange={(e) => setForm((f) => ({ ...f, embeddingsApiKey: e.target.value }))}
            className={inputCls}
            placeholder={hasEmbeddingsKey ? "•••••••••••• (dejar vacío para no cambiarla)" : "sk-..."}
          />
          {hasEmbeddingsKey && (
            // D1 — Estaba en rojo y parecía destructivo, cuando es una acción
            // de mantenimiento. Botón secundario, y una línea que dice qué hace
            // y qué pasa mientras corre.
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleReindex}
                  disabled={reindexing}
                  className="px-3 py-1.5 text-[13px] font-semibold rounded-sm border border-[#6A6A70] bg-[#1A1A1E] text-[#B0B0B0] hover:text-white hover:border-[#3A3A3E] disabled:opacity-50 transition-colors"
                >
                  {reindexing ? "Reindexando…" : "Reindexar toda la base de conocimiento"}
                </button>
                {reindexMsg && <span className="text-[13px] text-green-400">{reindexMsg}</span>}
              </div>
              <p className="text-[13px] text-[#8A8A8A]">
                Vuelve a calcular los embeddings de todos los documentos. No borra
                nada. Tarda más cuantos más documentos haya; mientras corre, el
                asistente sigue respondiendo con el índice viejo.
              </p>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="instrucciones-del-asistente" className={labelCls}>Instrucciones del asistente</label>
          <textarea id="instrucciones-del-asistente"
            value={form.system_prompt}
            onChange={(e) => setForm((f) => ({ ...f, system_prompt: e.target.value }))}
            rows={5}
            className={`${inputCls} resize-none`}
            placeholder="Somos FORCOM, fabricante de hardware POS en Argentina. Respondé de forma clara y profesional. No inventes precios ni plazos — si preguntan eso, derivá a un vendedor."
          />
        </div>

        <div>
          <label htmlFor="maximo-de-respuestas-seguida" className={labelCls}>Máximo de respuestas seguidas por conversación</label>
          <input id="maximo-de-respuestas-seguida"
            type="number"
            min={1}
            max={20}
            value={form.max_replies_per_conversation}
            onChange={(e) =>
              setForm((f) => ({ ...f, max_replies_per_conversation: Number(e.target.value) }))
            }
            className={`${inputCls} max-w-[120px]`}
          />
          <p className="text-[13px] text-[#8A8A8A] mt-1.5">
            Después de este número, la conversación queda esperando a un humano.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-[15px] text-[#FF6A5C] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-4 py-3">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="px-8 py-3 bg-[#C41D16] text-white font-display font-bold text-[15px] tracking-widest uppercase rounded-sm hover:bg-[#E8231A] transition-colors disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        {saved && <span className="text-[15px] text-green-400 font-display font-semibold">✓ Guardado</span>}
      </div>
    </form>
  );
}

function KnowledgeSection({ initialDocuments }: { initialDocuments: AiKnowledgeDocument[] }) {
  const [, startTransition] = useTransition();
  const [documents, setDocuments] = useState(initialDocuments);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");

  function startEdit(doc: AiKnowledgeDocument) {
    setEditingId(doc.id);
    setTitle(doc.title);
    setContent(doc.content);
    setShowNew(false);
  }

  function startNew() {
    setShowNew(true);
    setEditingId(null);
    setTitle("");
    setContent("");
  }

  function cancel() {
    setShowNew(false);
    setEditingId(null);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setError("");
    startTransition(async () => {
      try {
        await upsertKnowledgeDocument(editingId, title, content);
        if (editingId) {
          setDocuments((prev) =>
            prev.map((d) => (d.id === editingId ? { ...d, title: title.trim(), content: content.trim() } : d))
          );
        } else {
          setDocuments((prev) => [
            ...prev,
            { id: crypto.randomUUID(), title: title.trim(), content: content.trim(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          ]);
        }
        cancel();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar.");
      }
    });
  }

  function remove(id: string) {
    if (!confirm("¿Borrar este documento de la base de conocimiento?")) return;
    startTransition(async () => {
      try {
        await deleteKnowledgeDocument(id);
        setDocuments((prev) => prev.filter((d) => d.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al borrar.");
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg text-white">Base de conocimiento</h2>
        {!showNew && (
          <button
            onClick={startNew}
            className="px-4 py-2 bg-[#C41D16] text-white text-xs font-display font-bold tracking-widest uppercase rounded-sm hover:bg-[#E8231A] transition-colors"
          >
            + Agregar documento
          </button>
        )}
      </div>

      {error && (
        <p className="text-[15px] text-[#FF6A5C] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-4 py-3 mb-4">
          {error}
        </p>
      )}

      {(showNew || editingId) && (
        <form onSubmit={save} className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6 space-y-4 mb-4">
          <div>
            <label htmlFor="titulo" className={labelCls}>Título</label>
            <input id="titulo" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Garantía" />
          </div>
          <div>
            <label htmlFor="contenido" className={labelCls}>Contenido</label>
            <textarea id="contenido"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className={`${inputCls} resize-none`}
              placeholder="Todos los equipos tienen 12 meses de garantía por defectos de fabricación..."
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="px-6 py-2.5 bg-[#C41D16] text-white text-[15px] font-display font-bold rounded-sm hover:bg-[#E8231A]">
              Guardar
            </button>
            <button type="button" onClick={cancel} className="px-6 py-2.5 text-[15px] text-[#8A8A8A] hover:text-white">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {documents.length === 0 && !showNew && (
          <p className="text-[15px] text-[#8A8A8A]">Todavía no hay documentos cargados.</p>
        )}
        {documents.map((doc) => (
          <div key={doc.id} className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-display font-semibold text-white text-[15px]">{doc.title}</p>
              <p className="text-[13px] text-[#8A8A8A] mt-1 line-clamp-2">{doc.content}</p>
            </div>
            <div className="flex gap-3 shrink-0 text-[13px]">
              <button onClick={() => startEdit(doc)} className="text-[#8A8A8A] hover:text-white">
                Editar
              </button>
              <button onClick={() => remove(doc.id)} className="text-[#8A8A8A] hover:text-[#FF6A5C]">
                Borrar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
