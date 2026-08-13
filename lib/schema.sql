create table if not exists listings (
  id             text primary key,
  source         text        not null,
  country        text        not null,
  url            text        not null,
  title          text        not null,

  make           text,
  model          text,
  generation     text,
  year           int,
  mileage_km     int,
  fuel           text,
  transmission   text,

  price_eur      numeric(10, 2),
  price_original numeric(12, 2),
  currency       text,

  location       text,
  image_url      text,
  description    text,

  dedupe_key     text,
  first_seen     timestamptz not null default now(),
  last_seen      timestamptz not null default now(),
  is_active      boolean     not null default true,
  raw            jsonb
);

create index if not exists listings_active_idx on listings (is_active, last_seen desc);
create index if not exists listings_model_idx  on listings (make, model, year);
create index if not exists listings_dedupe_idx on listings (dedupe_key);

-- One row per observed price change, so drops are visible over time.
create table if not exists price_history (
  listing_id text        not null references listings (id) on delete cascade,
  price_eur  numeric(10, 2) not null,
  seen_at    timestamptz not null default now(),
  primary key (listing_id, seen_at)
);

create table if not exists evaluations (
  listing_id        text primary key references listings (id) on delete cascade,
  -- Hash of the scored content. If the listing text and price are unchanged,
  -- the cached evaluation is reused instead of paying for the model again.
  content_hash      text        not null,
  score             int,
  market_median_eur numeric(10, 2),
  price_delta_pct   numeric(6, 2),
  landed_cost_eur   numeric(10, 2),
  ai_score          int,
  verdict           text,
  risks             jsonb,
  inspect           jsonb,
  evaluated_at      timestamptz not null default now()
);

create index if not exists evaluations_score_idx on evaluations (score desc);

-- Which content the AI verdict was written against. When content_hash moves
-- (price cut, edited ad) the verdict is stale and gets re-run.
alter table evaluations add column if not exists ai_hash text;

-- Engine power, always stored in kW regardless of the unit the site used.
alter table listings add column if not exists power_kw int;

-- Per-factor scoring explanation: [{label, points, detail}, ...]. Stored so
-- the UI can justify any score it shows instead of asking for trust.
alter table evaluations add column if not exists breakdown jsonb;

-- Single-user state: hidden, starred, and whether the ad has been opened.
-- flag and opened_at are orthogonal, so flag is nullable: a row can exist
-- purely to record that a listing was viewed.
create table if not exists user_flags (
  listing_id text primary key references listings (id) on delete cascade,
  flag       text,
  created_at timestamptz not null default now()
);

alter table user_flags alter column flag drop not null;
alter table user_flags add column if not exists opened_at timestamptz;

-- Owner's scoring blueprint, 2026-08-11: the AI pass now also outputs a
-- headline bucket (GREEN/YELLOW/RED) and a per-category point breakdown
-- (drivetrain, engine, suspension, upgrades, price-to-value — mirrors the
-- shape of the deterministic `breakdown` column above) alongside the
-- existing ai_score/verdict/risks/inspect.
alter table evaluations add column if not exists bucket text;
alter table evaluations add column if not exists category_breakdown jsonb;

-- Single-user settings for the email alert, editable from /alerts (mirrors
-- theparking.eu's own "Create an alert" modal: on/off, a score threshold,
-- and a frequency cap so a burst of new deals in one scan doesn't spam).
-- Singleton row, id is always 1.
create table if not exists alert_settings (
  id              int primary key default 1,
  enabled         boolean     not null default true,
  min_score       int         not null default 70,
  -- 0 = no cooldown, email every run a qualifying deal appears.
  frequency_hours int         not null default 0,
  recipient_email text,
  last_sent_at    timestamptz,
  constraint alert_settings_singleton check (id = 1)
);
insert into alert_settings (id) values (1) on conflict (id) do nothing;

-- One-click unsubscribe: embedded in every alert email, checked with no
-- login by GET /unsubscribe to flip enabled off.
alter table alert_settings add column if not exists unsub_token text;
update alert_settings set unsub_token = md5(random()::text || clock_timestamp()::text)
  where unsub_token is null;

-- One row per scan run: what each source returned, for drift detection.
create table if not exists scan_runs (
  id           bigint generated always as identity primary key,
  started_at   timestamptz not null,
  finished_at  timestamptz not null default now(),
  depth        int         not null,
  source_counts jsonb      not null,
  new_listings int         not null default 0,
  price_drops  int         not null default 0
);
