-- ============================================================
--  Migrazione 002 — bevande correlate alla fascia oraria
--  (schema_version 2)
--
--  Prima: liquidi_tipo[] e liquidi_orario[] erano due liste SCOLLEGATE, quindi
--  "the prima di cena, acqua a cena, latte dopo cena" non era rappresentabile.
--  Ora: una mappa { fascia -> [tipi] } che conserva la correlazione.
--
--  Solo ADDITIVA: non tocca ne' elimina le colonne legacy (nessun dato distrutto).
--  Esegui una volta nell'SQL editor di Supabase.
-- ============================================================

alter table night_records
  add column if not exists liquidi jsonb not null default '{}'::jsonb;

-- L'oggetto JSON deve essere... un oggetto. (idempotente: crea solo se assente)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'liquidi_e_oggetto'
  ) then
    alter table night_records
      add constraint liquidi_e_oggetto check (jsonb_typeof(liquidi) = 'object');
  end if;
end $$;

-- (Facoltativo) Migrazione best-effort dei dati legacy: se una notte aveva UNA
-- sola fascia e dei tipi, li accorpa. Con piu' fasce non e' ricostruibile la
-- correlazione, quindi si lascia stare (i dati legacy restano nelle colonne
-- vecchie e non si perdono). Scommenta se vuoi eseguirla.
--
-- update night_records
-- set liquidi = jsonb_build_object(liquidi_orario[1], to_jsonb(liquidi_tipo))
-- where liquidi = '{}'::jsonb
--   and array_length(liquidi_orario, 1) = 1
--   and array_length(liquidi_tipo, 1) >= 1;
