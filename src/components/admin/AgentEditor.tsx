"use client";

import { useState, useTransition } from "react";
import {
  updateAiConfig,
  upsertKnowledgeDocument,
  deleteKnowledgeDocument,
  testAiReply,
} from "@/app/admin/actions";
import type { AiConfig, AiKnowledgeDocument } from "@/lib/types";
import type { ChatMessage } from "@/lib/ai/generate";

const inputCls =
  "w-full bg-[#0D0D0F] border border-[#2A2A2E] rounded-sm px-4 py-3 text-white placeholder:text-[#8A8A8A]/50 focus:border-[#E8231A] focus:outline-none transition-colors";
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
    <div className="max-w-2xl space-y-8">
      <ConfigSection initialConfig={initialConfig} />
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
          <button onClick={reset} className="text-xs text-[#8A8A8A] hover:text-white">
            Reiniciar conversación
          </button>
        )}
      </div>
      <p className="text-xs text-[#8A8A8A] mb-4">
        Simulá una conversación como si fueras cliente — sigue el hilo (podés contestar sus preguntas), no manda nada por WhatsApp.
      </p>
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6 space-y-4">
        {history.length > 0 && (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {history.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-sm px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-[#E8231A] text-white"
                      : "bg-[#0D0D0F] border border-[#2A2A2E] text-white"
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
            className="px-6 py-3 bg-[#E8231A] text-white text-sm font-display font-bold tracking-widest uppercase rounded-sm hover:bg-[#C41D16] transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? "..." : "Enviar"}
          </button>
        </form>

        {error && (
          <p className="text-sm text-[#E8231A] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-4 py-3">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function ConfigSection({ initialConfig }: { initialConfig: AiConfig }) {
  const [, startTransition] = useTransition();
  const [form, setForm] = useState({
    provider: initialConfig.provider,
    model: initialConfig.model,
    apiKey: "",
    system_prompt: initialConfig.system_prompt,
    auto_reply_enabled: initialConfig.auto_reply_enabled,
    max_replies_per_conversation: initialConfig.max_replies_per_conversation,
  });
  const [hasApiKey] = useState(initialConfig.hasApiKey);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    startTransition(async () => {
      try {
        await updateAiConfig(form);
        setForm((f) => ({ ...f, apiKey: "" }));
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar.");
      } finally {
        setSaving(false);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display font-semibold text-white">Respuesta automática</p>
            <p className="text-xs text-[#8A8A8A]">Contestar solo, usando la IA, mensajes nuevos.</p>
          </div>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, auto_reply_enabled: !f.auto_reply_enabled }))}
            className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
              form.auto_reply_enabled ? "bg-[#E8231A]" : "bg-[#2A2A2E]"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                form.auto_reply_enabled ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Proveedor</label>
            <select
              value={form.provider}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value as "anthropic" | "openai" }))}
              className={inputCls}
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Modelo</label>
            <input
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              className={inputCls}
              placeholder="claude-haiku-4-5-20251001"
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Clave de API</label>
          <input
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            className={inputCls}
            placeholder={hasApiKey ? "•••••••••••• (dejar vacío para no cambiarla)" : "sk-..."}
          />
        </div>

        <div>
          <label className={labelCls}>Instrucciones del asistente</label>
          <textarea
            value={form.system_prompt}
            onChange={(e) => setForm((f) => ({ ...f, system_prompt: e.target.value }))}
            rows={5}
            className={`${inputCls} resize-none`}
            placeholder="Somos FORCOM, fabricante de hardware POS en Argentina. Respondé de forma clara y profesional. No inventes precios ni plazos — si preguntan eso, derivá a un vendedor."
          />
        </div>

        <div>
          <label className={labelCls}>Máximo de respuestas seguidas por conversación</label>
          <input
            type="number"
            min={1}
            max={20}
            value={form.max_replies_per_conversation}
            onChange={(e) =>
              setForm((f) => ({ ...f, max_replies_per_conversation: Number(e.target.value) }))
            }
            className={`${inputCls} max-w-[120px]`}
          />
          <p className="text-[11px] text-[#8A8A8A] mt-1.5">
            Después de este número, la conversación queda esperando a un humano.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-[#E8231A] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-4 py-3">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="px-8 py-3 bg-[#E8231A] text-white font-display font-bold text-sm tracking-widest uppercase rounded-sm hover:bg-[#C41D16] transition-colors disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        {saved && <span className="text-sm text-green-400 font-display font-semibold">✓ Guardado</span>}
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
            className="px-4 py-2 bg-[#E8231A] text-white text-xs font-display font-bold tracking-widest uppercase rounded-sm hover:bg-[#C41D16] transition-colors"
          >
            + Agregar documento
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-[#E8231A] bg-[#E8231A]/10 border border-[#E8231A]/20 rounded-sm px-4 py-3 mb-4">
          {error}
        </p>
      )}

      {(showNew || editingId) && (
        <form onSubmit={save} className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-6 space-y-4 mb-4">
          <div>
            <label className={labelCls}>Título</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Garantía" />
          </div>
          <div>
            <label className={labelCls}>Contenido</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className={`${inputCls} resize-none`}
              placeholder="Todos los equipos tienen 12 meses de garantía por defectos de fabricación..."
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="px-6 py-2.5 bg-[#E8231A] text-white text-sm font-display font-bold rounded-sm hover:bg-[#C41D16]">
              Guardar
            </button>
            <button type="button" onClick={cancel} className="px-6 py-2.5 text-sm text-[#8A8A8A] hover:text-white">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {documents.length === 0 && !showNew && (
          <p className="text-sm text-[#8A8A8A]">Todavía no hay documentos cargados.</p>
        )}
        {documents.map((doc) => (
          <div key={doc.id} className="bg-[#141416] border border-[#2A2A2E] rounded-sm p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-display font-semibold text-white text-sm">{doc.title}</p>
              <p className="text-xs text-[#8A8A8A] mt-1 line-clamp-2">{doc.content}</p>
            </div>
            <div className="flex gap-3 shrink-0 text-xs">
              <button onClick={() => startEdit(doc)} className="text-[#8A8A8A] hover:text-white">
                Editar
              </button>
              <button onClick={() => remove(doc.id)} className="text-[#8A8A8A] hover:text-[#E8231A]">
                Borrar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
