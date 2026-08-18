-- ============================================================
-- M1 — Schema inicial · Fichas Técnicas FAMIQ
-- Implementa §5 de CLAUDE.md: modelo de datos e invariantes.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Tipos
-- ------------------------------------------------------------

-- §5 invariante 4. Sólo 'aprobada' y 'publicada' exportan PDF sin marca de agua.
-- El orden del enum refleja el flujo borrador → en_revision → aprobada → publicada.
-- No se fuerzan las transiciones a nivel de base: §5 declara los estados, no un
-- grafo de transiciones, y el rechazo (volver a borrador) es un camino real.
create type ficha_estado as enum ('borrador', 'en_revision', 'aprobada', 'publicada');

create type sugerencia_estado as enum ('pendiente', 'aceptada', 'rechazada');

-- §6 regla 2.
create type sugerencia_severidad as enum ('error', 'inconsistencia', 'mejora');

create type asset_tipo as enum ('foto', 'croquis');

-- ------------------------------------------------------------
-- Tablas
-- ------------------------------------------------------------

-- Estructura de bloques sin datos, para instanciar fichas nuevas (§7, M6).
create table familia (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  plantilla_bloques  jsonb not null default '[]'::jsonb,
  created_at         timestamptz not null default now()
);

comment on column familia.plantilla_bloques is
  'Array ordenado de bloques tipados, sin contenido. Estructura, no datos.';

create table producto (
  id            uuid primary key default gen_random_uuid(),
  sku           text not null unique,
  nombre_es     text not null,
  nombre_en     text,
  categoria     text,
  subcategoria  text,
  familia_id    uuid references familia (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index producto_familia_id_idx on producto (familia_id);

-- `version` y `anio` alimentan la segunda línea de la cabecera, en rojo
-- ("VERSIÓN 1.0 · 2026"). Decisión de producto: se sigue la convención de la
-- ficha de la arandela, sin numeración jerárquica de familia.
create table ficha (
  id                  uuid primary key default gen_random_uuid(),
  producto_id         uuid not null references producto (id) on delete cascade,
  estado              ficha_estado not null default 'borrador',
  version             text not null default '1.0',
  anio                smallint not null default extract(year from now()),
  revision_actual_id  uuid,
  created_at          timestamptz not null default now()
);

create index ficha_producto_id_idx on ficha (producto_id);
create index ficha_estado_idx      on ficha (estado);

-- §5 invariante 1: append-only. Ver más abajo el trigger y las políticas RLS.
create table ficha_revision (
  id          uuid primary key default gen_random_uuid(),
  ficha_id    uuid not null references ficha (id) on delete cascade,
  n           integer not null,
  bloques     jsonb not null default '[]'::jsonb,
  autor_id    uuid not null references auth.users (id),
  comentario  text,
  created_at  timestamptz not null default now(),
  constraint ficha_revision_n_positivo unique (ficha_id, n)
);

create index ficha_revision_ficha_id_idx on ficha_revision (ficha_id, n desc);

comment on table ficha_revision is
  'APPEND-ONLY (§5 invariante 1). UPDATE y DELETE fallan por trigger y por RLS.';

alter table ficha
  add constraint ficha_revision_actual_fk
  foreign key (revision_actual_id) references ficha_revision (id) on delete set null;

-- §5 invariante 2: una norma sin año de edición no se puede guardar.
create table norma (
  id           uuid primary key default gen_random_uuid(),
  codigo       text not null,
  edicion_anio smallint not null,
  created_at   timestamptz not null default now(),
  constraint norma_codigo_edicion_unica unique (codigo, edicion_anio),
  constraint norma_edicion_anio_plausible check (edicion_anio between 1900 and 2200)
);

create table asset (
  id            uuid primary key default gen_random_uuid(),
  tipo          asset_tipo not null,
  storage_path  text not null,
  familia_id    uuid references familia (id) on delete cascade,
  alt           text,
  created_at    timestamptz not null default now()
);

create index asset_familia_id_idx on asset (familia_id, tipo);

-- §6 regla 3: cada decisión sobre una propuesta de la IA queda con rastro.
create table sugerencia_ia (
  id               uuid primary key default gen_random_uuid(),
  revision_id      uuid not null references ficha_revision (id) on delete cascade,
  bloque_id        text not null,
  campo            text not null,
  texto_original   text,
  texto_propuesto  text,
  motivo           text not null,
  severidad        sugerencia_severidad not null,
  estado           sugerencia_estado not null default 'pendiente',
  decidido_por     uuid references auth.users (id),
  decidido_at      timestamptz,
  created_at       timestamptz not null default now(),

  -- §5 invariante 3.
  constraint sugerencia_decision_trazable check (
    (estado =  'pendiente' and decidido_por is null and decidido_at is null) or
    (estado <> 'pendiente' and decidido_por is not null and decidido_at is not null)
  )
);

create index sugerencia_ia_revision_id_idx on sugerencia_ia (revision_id, estado);
