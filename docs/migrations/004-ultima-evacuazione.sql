-- ============================================================
--  Migrazione 004 — da quanto non evacua (schema_version 3)
--
--  Prima: `alvo` mescolava due cose diverse — la CONSISTENZA delle feci
--  ('regolare', 'stitico', 'diarrea') e un CONTEGGIO ('nessuna_evacuazione').
--  Il conteggio non sopravvive a un campionamento ogni tre giorni: fra una
--  risposta e l'altra restano due sere ignote, e non si distingue un bambino
--  che evacua ogni giorno da uno che lo fa una volta in quattro. La frequenza
--  e' esattamente cio' che il pediatra guarda per primo.
--
--  Ora: `ultima_evacuazione` porta i giorni dentro la risposta ("piu' di 3
--  giorni fa" dice qualcosa anche delle sere non chieste), e `alvo` resta per
--  la sola consistenza. Vedi Decisione 14 nel modello dati.
--
--  Solo ADDITIVA: 'nessuna_evacuazione' resta legale nell'enum e nessuna riga
--  viene riscritta. Le schede vecchie si convertono in LETTURA (src/domain/alvo.js):
--  un alvo di consistenza implica un'evacuazione quel giorno, mentre
--  'nessuna_evacuazione' dice solo "non oggi" e resta ignoto — quel buco e' la
--  ragione per cui questa migrazione esiste, e riempirlo a stima lo sprecherebbe.
--
--  Idempotente. Esegui una volta nell'SQL editor di Supabase.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ultima_evacuazione') then
    create type ultima_evacuazione as enum (
      'oggi', 'ieri', 'due_tre_giorni', 'oltre_tre_giorni', 'non_so'
    );
  end if;
end $$;

alter table night_records
  add column if not exists ultima_evacuazione ultima_evacuazione;

-- Nessun UPDATE, di proposito: i dati grezzi non si toccano.
