-- ============================================================
--  Migrazione 003 — promemoria push (sera + mattina)
--
--  Una PWA non puo' programmare da sola una notifica per le 23: ad app chiusa
--  non gira nulla sul telefono. Quindi la sveglia sta qui: pg_cron chiama ogni
--  15 minuti la Edge Function `invia-promemoria`, che chiede a questo file CHI
--  va avvisato e manda il push.
--
--  La regola "chi va avvisato" vive in SQL, accanto ai dati, non nella Edge
--  Function: la Function fa solo crittografia e invio. Cosi' c'e' un solo posto
--  in cui la logica puo' sbagliare, ed e' interrogabile a mano dall'SQL editor.
--
--  Solo ADDITIVA: non tocca night_records ne' lo schema esistente.
--  Esegui una volta per progetto (staging E produzione).
--  Automatizzata da scripts/setup-notifiche.sh.
-- ============================================================

-- ----------------------------------------------------------------
--  Estensioni: la sveglia (pg_cron) e la chiamata HTTP (pg_net)
-- ----------------------------------------------------------------
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- ----------------------------------------------------------------
--  Un record per TELEFONO, non per utente.
--  Lo stesso genitore su telefono + tablet sono due subscription distinte:
--  l'endpoint (l'URL del push service) e' l'identita' del dispositivo.
-- ----------------------------------------------------------------
create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  -- Restituito dal browser. Unico: se lo stesso device si riscrive, si aggiorna.
  endpoint   text not null unique,
  -- Chiavi di cifratura del payload (standard Web Push).
  p256dh     text not null,
  auth_key   text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  -- Diagnostica: perche' un telefono ha smesso di ricevere.
  last_ok_at    timestamptz,
  last_error_at timestamptz,
  last_error    text
);

create index if not exists push_subscriptions_user_idx
  on push_subscriptions (user_id);

-- ----------------------------------------------------------------
--  Preferenze per GENITORE (non per telefono): se hai due device
--  vuoi decidere gli orari una volta sola.
-- ----------------------------------------------------------------
create table if not exists notification_prefs (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  sera_attiva   boolean not null default true,
  ora_sera      time    not null default '23:00',
  mattina_attiva boolean not null default true,
  ora_mattina   time    not null default '08:00',
  -- Il cron gira in UTC; il confronto con questi orari avviene in questo fuso,
  -- quindi il cambio ora legale/solare si gestisce da se'.
  timezone      text    not null default 'Europe/Rome',
  updated_at    timestamptz not null default now()
);

-- `or replace` perche' questo file va rilanciato: senza, la seconda esecuzione
-- muore su "trigger already exists" e con lei tutto il resto della migrazione.
create or replace trigger notification_prefs_touch
  before update on notification_prefs
  for each row execute function touch_updated_at();

-- ----------------------------------------------------------------
--  Log degli invii: serve a NON mandare due volte lo stesso promemoria.
--  La unique e' il lucchetto: chi riesce a inserire la riga ha il diritto di
--  inviare. Rende l'operazione atomica anche se il cron parte due volte.
-- ----------------------------------------------------------------
create table if not exists notification_log (
  subscription_id uuid not null references push_subscriptions(id) on delete cascade,
  momento         text not null check (momento in ('sera', 'mattina')),
  data_notte      date not null,
  sent_at         timestamptz not null default now(),
  primary key (subscription_id, momento, data_notte)
);

-- ----------------------------------------------------------------
--  Row-Level Security
--  Ognuno vede e gestisce SOLO le proprie subscription e preferenze.
--  notification_log non ha policy: ci accede solo il service role
--  (RLS attiva + zero policy = tutto chiuso agli utenti normali).
-- ----------------------------------------------------------------
alter table push_subscriptions enable row level security;
alter table notification_prefs enable row level security;
alter table notification_log   enable row level security;

drop policy if exists push_subscriptions_own on push_subscriptions;
create policy push_subscriptions_own on push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notification_prefs_own on notification_prefs;
create policy notification_prefs_own on notification_prefs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------------------
--  Specchio SQL di due regole che vivono anche lato client.
--  ATTENZIONE: se cambi le regole in src/domain/, cambiale anche qui.
-- ----------------------------------------------------------------

-- Specchio di ORA_INIZIO_GIORNO = 5 (src/domain/dataNotte.js): tra mezzanotte
-- e le 5 siamo ancora nella CODA della notte precedente, non nel giorno nuovo.
-- Senza questo, un promemoria all'1 di notte attribuirebbe la notte sbagliata.
create or replace function giorno_effettivo(p_ts timestamptz, p_tz text)
returns date language sql stable as $$
  select case
    when extract(hour from (p_ts at time zone p_tz)) < 5
      then ((p_ts at time zone p_tz)::date - 1)
    else (p_ts at time zone p_tz)::date
  end;
$$;

-- Specchio di contestoVuoto() (src/domain/contesto.js): nessun campo della
-- sez. 3 valorizzato. `pipi_prima_dormire = false` CONTA (e' una risposta).
create or replace function contesto_vuoto(r night_records)
returns boolean language sql stable as $$
  select r.pipi_prima_dormire is null
     and r.liquidi_quantita is null
     and coalesce(array_length(r.cibi_sospetti, 1), 0) = 0
     and not exists (
       select 1
       from jsonb_each(coalesce(r.liquidi, '{}'::jsonb)) as e(k, v)
       where jsonb_typeof(v) = 'array' and jsonb_array_length(v) > 0
     );
$$;

-- La finestra di un promemoria: da `p_ora` per un'ora.
-- Non un istante esatto ma una finestra, cosi' se un invio fallisce il giro di
-- cron successivo (15 minuti dopo) riprova ancora dentro l'ora giusta.
create or replace function finestra_aperta(p_ts timestamptz, p_tz text, p_ora time)
returns boolean language sql stable as $$
  with l as (select (p_ts at time zone p_tz)::time as t)
  select case
    -- `time + interval` wrappa a mezzanotte: se il fine finestra e' "minore"
    -- dell'inizio, la finestra scavalca le 24 e il confronto va invertito.
    when (p_ora + interval '1 hour')::time > p_ora
      then (select t from l) >= p_ora
       and (select t from l) <  (p_ora + interval '1 hour')::time
    else (select t from l) >= p_ora
      or (select t from l) <  (p_ora + interval '1 hour')::time
  end;
$$;

-- ----------------------------------------------------------------
--  Il cuore: chi va avvisato ADESSO.
--
--  Restituisce una riga per ogni push da mandare, E CONTEMPORANEAMENTE segna
--  l'invio nel log. Non e' una funzione di sola lettura per scelta: leggere e
--  marcare in due passi lascerebbe la finestra per un doppio invio.
--
--  Regola del silenzio: se il dato di quel momento c'e' gia', non si notifica.
--  Vale per ENTRAMBI i genitori — il dato e' del bambino, non di chi lo scrive.
-- ----------------------------------------------------------------
create or replace function promemoria_da_inviare(p_adesso timestamptz default now())
returns table (
  subscription_id uuid,
  endpoint        text,
  p256dh          text,
  auth_key        text,
  momento         text,
  child_id        uuid,
  nome_bambino    text,
  data_notte      date
)
language plpgsql
security definer
set search_path = public
as $$
-- I nomi di RETURNS TABLE (`subscription_id`, `momento`, `data_notte`) in
-- plpgsql valgono come VARIABILI, e nella CTE `segnati` gli stessi nomi sono
-- anche colonne vere di notification_log. Senza questa direttiva Postgres non
-- sa a quale dei due ci si riferisce e alza "column reference ... is ambiguous"
-- A OGNI CHIAMATA: la funzione non torna zero righe, muore. E muore in un punto
-- dove non se ne accorge nessuno — l'errore resta nella risposta HTTP di pg_net,
-- non tocca push_subscriptions.last_error, e i telefoni tacciono per giorni.
#variable_conflict use_column
begin
  return query
  with candidati as (
    -- Ogni subscription incrociata coi due promemoria possibili, tenendo solo
    -- quelli attivi e la cui finestra oraria e' aperta adesso.
    select s.id as sub_id, s.user_id, s.endpoint, s.p256dh, s.auth_key,
           m.momento,
           giorno_effettivo(p_adesso, p.timezone) as giorno
    from push_subscriptions s
    join notification_prefs p on p.user_id = s.user_id
    cross join lateral (values
      ('sera',    p.ora_sera,    p.sera_attiva),
      ('mattina', p.ora_mattina, p.mattina_attiva)
    ) as m(momento, ora, attiva)
    where m.attiva
      and finestra_aperta(p_adesso, p.timezone, m.ora)
  ),
  obiettivi as (
    -- La notte a cui il promemoria si riferisce (Decisione 1: data del mattino).
    --   mattina -> la notte appena finita        = giorno effettivo
    --   sera    -> la notte che sta per iniziare = giorno effettivo + 1
    select c.*,
           cm.child_id,
           case when c.momento = 'mattina' then c.giorno else c.giorno + 1 end as dn
    from candidati c
    join child_members cm on cm.user_id = c.user_id
  ),
  da_inviare as (
    -- Il silenzio: tiene solo chi ha davvero un buco da colmare.
    select o.sub_id, o.endpoint, o.p256dh, o.auth_key, o.momento,
           o.child_id, ch.nome, o.dn
    from obiettivi o
    join children ch on ch.id = o.child_id
    left join night_records nr
      on nr.child_id = o.child_id and nr.data_notte = o.dn
    where case
      when o.momento = 'mattina' then nr.esito is null
      else nr.id is null or contesto_vuoto(nr)
    end
  ),
  segnati as (
    -- Il lucchetto: solo le righe inserite davvero vengono inviate.
    insert into notification_log (subscription_id, momento, data_notte)
    select d.sub_id, d.momento, d.dn from da_inviare d
    on conflict (subscription_id, momento, data_notte) do nothing
    returning notification_log.subscription_id,
              notification_log.momento,
              notification_log.data_notte
  )
  select d.sub_id, d.endpoint, d.p256dh, d.auth_key, d.momento,
         d.child_id, d.nome, d.dn
  from da_inviare d
  join segnati s
    on s.subscription_id = d.sub_id
   and s.momento         = d.momento
   and s.data_notte      = d.dn;
end;
$$;

-- Solo il service role (la Edge Function). Mai il client: restituisce gli
-- endpoint push di TUTTI i genitori e per giunta scrive nel log.
revoke execute on function promemoria_da_inviare(timestamptz) from public, anon, authenticated;
grant  execute on function promemoria_da_inviare(timestamptz) to service_role;

-- ----------------------------------------------------------------
--  Iscrizione di un dispositivo.
--
--  SECURITY DEFINER come create_child/join_child, e per lo stesso tipo di
--  motivo: l'endpoint e' unico per browser, non per account. Se sullo stesso
--  telefono entra l'altro genitore, la riga esiste gia' ma e' invisibile alle
--  sue RLS: un upsert dal client fallirebbe con un errore incomprensibile.
--  Qui l'endpoint viene riassegnato a chi sta chiedendo.
--
--  E' sicuro: l'endpoint e' un segreto del browser: chi lo presenta sta
--  dimostrando di ESSERE quel browser. Ed e' quello che si vuole — le notifiche
--  devono seguire l'account attivo sul telefono.
--
--  Semina anche le preferenze (23:00 / 08:00), cosi' i promemoria sono pronti
--  senza passare dalle impostazioni.
-- ----------------------------------------------------------------
create or replace function registra_push_subscription(
  p_endpoint   text,
  p_p256dh     text,
  p_auth_key   text,
  p_user_agent text default null
)
returns push_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  riga push_subscriptions;
begin
  if auth.uid() is null then
    raise exception 'Non autenticato';
  end if;

  insert into push_subscriptions (user_id, endpoint, p256dh, auth_key, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth_key, p_user_agent)
  on conflict (endpoint) do update
    set user_id       = auth.uid(),
        p256dh        = excluded.p256dh,
        auth_key      = excluded.auth_key,
        user_agent    = excluded.user_agent,
        -- Ricomincia pulito: gli errori vecchi riguardavano un'altra iscrizione.
        last_error    = null,
        last_error_at = null
  returning * into riga;

  insert into notification_prefs (user_id) values (auth.uid())
  on conflict (user_id) do nothing;

  return riga;
end;
$$;

revoke execute on function registra_push_subscription(text, text, text, text) from public, anon;
grant  execute on function registra_push_subscription(text, text, text, text) to authenticated;
