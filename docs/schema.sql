-- ============================================================
--  App monitoraggio enuresi — schema database (Supabase / Postgres)
--  Incolla questo nell'SQL editor di Supabase ed eseguilo.
--  Implementa il modello dati della "scheda notte".
-- ============================================================

-- ----------------------------------------------------------------
--  Enum (valori a scelta singola)
-- ----------------------------------------------------------------
create type esito_notte        as enum ('asciutto', 'bagnato');
create type gravita_notte      as enum ('piccola', 'media', 'zuppo');
create type minzione_notturna  as enum ('nessuna', 'da_solo', 'accompagnato_svegliato');
create type liquidi_quantita   as enum ('pochi', 'medi', 'molti');
create type alvo_stato         as enum ('regolare', 'stitico', 'nessuna_evacuazione', 'diarrea');
create type salute_stato       as enum ('sano', 'malato', 'sconosciuto');

-- ----------------------------------------------------------------
--  Bambini + condivisione tra genitori
-- ----------------------------------------------------------------
create table children (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  data_nascita date,
  -- Codice invito condiviso: il secondo genitore si unisce passandolo a
  -- join_child() (vedi funzioni piu' sotto). Non e' un segreto forte, ma e'
  -- un UUID non indovinabile e l'unico modo per entrare in un bambino esistente.
  invite_code  uuid not null default gen_random_uuid(),
  created_at   timestamptz not null default now()
);

-- Chi puo' accedere a quale bambino (entrambi i genitori => 2 righe).
-- E' la base su cui poggiano tutte le RLS piu' sotto.
create table child_members (
  child_id   uuid not null references children(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  ruolo      text not null default 'genitore',
  created_at timestamptz not null default now(),
  primary key (child_id, user_id)
);

-- ----------------------------------------------------------------
--  Stato persistente corrente per bambino
--  (Decisione 7: "porta avanti" la salute + orologio per la scadenza)
-- ----------------------------------------------------------------
create table child_active_states (
  child_id             uuid primary key references children(id) on delete cascade,
  salute_stato         salute_stato not null default 'sano',
  salute_sintomi       text[] not null default '{}',
  -- data dell'ultima impostazione/conferma: se supera la finestra (3-4 gg)
  -- l'app obbliga a reimpostare ripartendo da 'sano'.
  salute_confermato_il date,
  updated_at           timestamptz not null default now(),
  constraint salute_sintomi_validi check (
    salute_sintomi <@ array['febbre','tosse','raffreddore','mal_di_gola','altro']
  )
);

-- ----------------------------------------------------------------
--  Scheda notte — un record per bambino per notte
-- ----------------------------------------------------------------
create table night_records (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references children(id) on delete cascade,

  -- Convenzione (Decisione 1): data del MATTINO del risveglio.
  data_notte    date not null,

  -- --- Esito (sez. 2) ---
  esito             esito_notte,               -- null finche' non registrato
  gravita           gravita_notte,             -- solo se bagnato
  episodi           smallint check (episodi is null or episodi >= 1),
  minzione          minzione_notturna,
  numero_risvegli   smallint check (numero_risvegli is null or numero_risvegli >= 1),

  -- --- Contesto serale (sez. 3) ---
  pipi_prima_dormire boolean,
  liquidi_quantita   liquidi_quantita,
  -- Bevande CORRELATE alla fascia oraria: mappa { fascia -> [tipi] }.
  -- Es. {"prima_di_cena":["caffeina_teina"],"a_cena":["acqua"],"dopo_cena":["latte"]}.
  -- Sostituisce le due liste scollegate liquidi_tipo/liquidi_orario (tenute
  -- legacy sotto: non le usiamo piu' da schema_version 2, non si distruggono dati).
  liquidi            jsonb not null default '{}'::jsonb,
  liquidi_tipo       text[] not null default '{}',   -- legacy (<= v1)
  liquidi_orario     text[] not null default '{}',   -- legacy (<= v1)
  cibi_sospetti      text[] not null default '{}',

  -- --- Contesto clinico (sez. 4) ---
  alvo             alvo_stato,
  sintomi_diurni   text[] not null default '{}',
  interventi       text[] not null default '{}',

  -- Snapshot dello stato di salute per QUESTA notte (per le correlazioni)
  salute_stato     salute_stato,
  salute_sintomi   text[] not null default '{}',

  -- --- Note e tono (sez. 5) ---
  note             text,
  umore_bambino    text,

  -- --- Metadati / a prova di futuro ---
  schema_version smallint not null default 1,
  created_by     uuid references auth.users(id),
  updated_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Un solo record per notte: le due porte (sera/mattina) scrivono qui.
  unique (child_id, data_notte),

  -- Coerenza esito/gravita.
  constraint gravita_solo_se_bagnato check (
    (esito = 'bagnato') or (gravita is null)
  ),
  -- Vincoli sui valori ammessi negli array (in stile enum, ma multi-valore).
  -- liquidi (v2) e' una mappa fascia->tipi: dev'essere un oggetto JSON.
  -- La validazione fine dei valori (fasce/tipi ammessi) sta lato client (costanti.js).
  constraint liquidi_e_oggetto check (jsonb_typeof(liquidi) = 'object'),
  constraint liquidi_tipo_validi check (
    liquidi_tipo <@ array['acqua','latte','zuccherate','caffeina_teina','altro']
  ),
  constraint liquidi_orario_validi check (
    liquidi_orario <@ array['prima_di_cena','a_cena','dopo_cena','prima_di_dormire']
  ),
  constraint cibi_sospetti_validi check (
    cibi_sospetti <@ array['fritto','molto_salato','piccante','frutta_acquosa','nessuno']
  ),
  constraint sintomi_diurni_validi check (
    sintomi_diurni <@ array['urgenza','minzioni_frequenti','incidenti_giorno','nessuno']
  ),
  constraint interventi_validi check (
    interventi <@ array['sveglia_lifting','allarme','terapia','nessuno']
  ),
  constraint salute_sintomi_validi check (
    salute_sintomi <@ array['febbre','tosse','raffreddore','mal_di_gola','altro']
  )
);

-- Query tipiche: "tutte le notti di un bambino in ordine di data".
create index night_records_child_data_idx
  on night_records (child_id, data_notte desc);

-- ----------------------------------------------------------------
--  Trigger: mantiene updated_at aggiornato
-- ----------------------------------------------------------------
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger night_records_touch
  before update on night_records
  for each row execute function touch_updated_at();

create trigger child_active_states_touch
  before update on child_active_states
  for each row execute function touch_updated_at();

-- ----------------------------------------------------------------
--  Row-Level Security
--  Regola unica: un utente vede/scrive solo i dati dei bambini
--  di cui e' membro (tabella child_members).
-- ----------------------------------------------------------------
alter table children            enable row level security;
alter table child_members       enable row level security;
alter table child_active_states enable row level security;
alter table night_records       enable row level security;

-- Helper: e' l'utente corrente membro di questo bambino?
create or replace function is_member_of(target_child uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from child_members
    where child_id = target_child and user_id = auth.uid()
  );
$$;

-- children: vedo i bambini di cui sono membro.
create policy children_select on children
  for select using (is_member_of(id));

-- child_members: vedo tutti i membri dei bambini di cui faccio parte
-- (serve a mostrare "l'altro genitore e' collegato"). Non ricorsivo: is_member_of
-- e' SECURITY DEFINER e non riscatena le RLS.
create policy child_members_select on child_members
  for select using (is_member_of(child_id));

-- Nessuna policy di INSERT diretta su children / child_members: le due
-- operazioni delicate (creare un bambino, unirsi come secondo genitore) passano
-- dalle funzioni SECURITY DEFINER piu' sotto, che le eseguono in modo atomico e
-- controllato. Cosi' le RLS restano semplici e non c'e' il classico problema
-- ricorsivo del "primo membro che deve iscrivere se stesso".

-- child_active_states: accesso pieno se sono membro.
create policy active_states_all on child_active_states
  for all using (is_member_of(child_id)) with check (is_member_of(child_id));

-- night_records: accesso pieno se sono membro.
create policy night_records_all on night_records
  for all using (is_member_of(child_id)) with check (is_member_of(child_id));

-- ----------------------------------------------------------------
--  Onboarding: creare un bambino e unirsi come secondo genitore.
--  Sono SECURITY DEFINER: girano coi diritti del proprietario e quindi
--  bypassano le RLS in modo controllato. Evitano policy di INSERT permissive
--  e il problema ricorsivo del primo membro che deve iscrivere se stesso.
-- ----------------------------------------------------------------

-- Crea un bambino e iscrive chi chiama come primo genitore, atomico.
-- Semina anche la riga di stato salute (default 'sano').
create or replace function create_child(p_nome text, p_data_nascita date default null)
returns children
language plpgsql
security definer
set search_path = public
as $$
declare
  nuovo children;
begin
  if auth.uid() is null then
    raise exception 'Non autenticato';
  end if;

  insert into children (nome, data_nascita)
  values (p_nome, p_data_nascita)
  returning * into nuovo;

  insert into child_members (child_id, user_id, ruolo)
  values (nuovo.id, auth.uid(), 'genitore');

  insert into child_active_states (child_id)
  values (nuovo.id);

  return nuovo;
end;
$$;

-- Il secondo genitore si unisce a un bambino esistente tramite l'invite_code.
-- Idempotente: se e' gia' membro non fa nulla (on conflict).
create or replace function join_child(p_invite_code uuid)
returns children
language plpgsql
security definer
set search_path = public
as $$
declare
  trovato children;
begin
  if auth.uid() is null then
    raise exception 'Non autenticato';
  end if;

  select * into trovato from children where invite_code = p_invite_code;
  if not found then
    raise exception 'Codice invito non valido';
  end if;

  insert into child_members (child_id, user_id, ruolo)
  values (trovato.id, auth.uid(), 'genitore')
  on conflict (child_id, user_id) do nothing;

  return trovato;
end;
$$;

-- Solo gli utenti autenticati possono chiamarle (anon avrebbe comunque
-- auth.uid() null e verrebbe respinto, ma meglio esplicitare).
revoke execute on function create_child(text, date) from public;
revoke execute on function join_child(uuid)        from public;
grant  execute on function create_child(text, date) to authenticated;
grant  execute on function join_child(uuid)        to authenticated;

-- ----------------------------------------------------------------
--  Realtime: fa arrivare le modifiche sull'altro telefono
-- ----------------------------------------------------------------
alter publication supabase_realtime add table night_records;
alter publication supabase_realtime add table child_active_states;
