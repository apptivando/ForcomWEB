-- ============================================================
-- 022 — Baja del CRM en la base de FORCOM (26/10/2026)
-- ============================================================
--
-- El CRM se mudó a Apptivando CRM el 24/09/2026, que tiene su propia base.
-- Sus tablas quedaron acá sin uso: las creó el Track E de `develop`
-- (migraciones 002 a 014, 019 y 020) y producción nunca las leyó.
--
-- Lo que se borra: las 21 tablas del CRM, sus funciones, sus triggers, la
-- configuración de búsqueda `spanish_unaccent` y el enlace
-- `contact_messages.contact_id` hacia las fichas de clientes.
--
-- Lo que NO se toca, porque producción lo usa:
--   · contact_messages (los leads del formulario), con su columna `phone`,
--     el estado `spam` (017) y sus policies, incluido el borrado (010) y el
--     insert público (018).
--   · products, hero_content, hero_slides, company_info.
--   · admin_members, admin_invitations, admin_password_resets y la función
--     current_admin_role (001, 015, 016): las cuentas del panel.
--   · Las extensiones `unaccent` y `vector`: no molestan y sacarlas no gana nada.
--
-- Antes de correr esto se guardó una copia de las 21 tablas (758 filas) en
-- C:\Apptivando\ForcomWEB\respaldo_crm_2026-10-26, y los 5 leads reales del
-- formulario en leads_formulario_reales_2026-10-26.csv.
--
-- El DROP TABLE va SIN CASCADE a propósito: si algo fuera de esta lista
-- dependiera de una tabla del CRM, Postgres corta con error y la transacción
-- entera vuelve atrás, en vez de borrar de arrastre algo de producción.
--
-- Todo va en una transacción: o se aplica completo o no se aplica nada.
-- Correr en el SQL Editor de Supabase.

BEGIN;

-- 1. Las funciones del CRM, con todas sus variantes (contact_timeline, por
--    ejemplo, se redefinió en 012 y en 013). Se borran por nombre y solo en el
--    esquema public; current_admin_role no está en la lista.
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS firma
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'bump_cse_usage',
        'claim_conversation_reviews',
        'claim_prospects_for_enrichment',
        'contact_timeline',
        'conversation_transcript',
        'enqueue_conversation_reviews',
        'exclude_and_purge_number',
        'match_ai_knowledge_fts',
        'match_ai_knowledge_semantic',
        'match_products_fts',
        'release_cold_message',
        'requeue_stale_enrichments',
        'requeue_stale_reviews',
        'reserve_cold_message',
        'seller_stats',
        'upsert_prospect',
        'upsert_prospects',
        -- Las de los triggers (los triggers se van con sus tablas en el paso 3)
        'touch_crm_conversation_updated_at',
        'touch_pipeline_deal_updated_at',
        'touch_outreach_template_updated_at',
        'touch_wa_line_updated_at',
        'freeze_crm_event_identity',
        'log_pipeline_deal_event'
      )
  LOOP
    EXECUTE 'DROP FUNCTION ' || f.firma;
  END LOOP;
END $$;

-- 2. El enlace de los mensajes del formulario con las fichas del CRM.
--    Producción no lo usa. Los mensajes quedan intactos.
DROP INDEX IF EXISTS public.contact_messages_contact_id_idx;
ALTER TABLE public.contact_messages DROP COLUMN IF EXISTS contact_id;

-- 3. Las 21 tablas del CRM. En un solo DROP, para que Postgres resuelva las
--    referencias entre ellas sin necesitar CASCADE.
DROP TABLE IF EXISTS
  public.conversation_reviews,
  public.automation_logs,
  public.automation_pending_executions,
  public.automation_steps,
  public.automations,
  public.crm_events,
  public.pipeline_deals,
  public.pipeline_stages,
  public.crm_messages,
  public.crm_conversations,
  public.prospect_search_results,
  public.prospect_searches,
  public.prospect_api_usage,
  public.outreach_templates,
  public.quick_replies,
  public.ai_knowledge_chunks,
  public.ai_knowledge_documents,
  public.ai_config,
  public.wa_excluded_numbers,
  public.wa_lines,
  public.crm_contacts;

-- 4. La configuración de búsqueda en español que armó el asistente de IA (004).
DROP TEXT SEARCH CONFIGURATION IF EXISTS public.spanish_unaccent;

COMMIT;

-- 5. Verificación
-- `tablas` tiene que listar exactamente: admin_invitations, admin_members,
-- admin_password_resets, company_info, contact_messages, hero_content,
-- hero_slides, products. `funciones` tiene que quedar en current_admin_role.
-- `mensajes_formulario` tiene que dar lo mismo que antes de correr esto (8 al
-- 26/10/2026).
SELECT
  (SELECT string_agg(tablename, ', ' ORDER BY tablename)
     FROM pg_tables WHERE schemaname = 'public') AS tablas,
  (SELECT string_agg(DISTINCT p.proname, ', ')
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
     WHERE n.nspname = 'public' AND d.objid IS NULL) AS funciones,
  (SELECT COUNT(*) FROM public.contact_messages) AS mensajes_formulario;
