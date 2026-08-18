-- ============================================================
-- M1 — Invariantes de §5 como mecanismos de base de datos
-- ============================================================

-- ------------------------------------------------------------
-- §5 invariante 1 — ficha_revision es append-only
-- ------------------------------------------------------------
-- §5 pide revocarlo "a nivel de política RLS, no sólo evitarlo en el código".
-- Se hace, más abajo. Pero RLS NO aplica a service_role ni al owner de la
-- tabla, y el criterio de aceptación de M1 dice que un UPDATE debe fallar
-- "a nivel de base de datos". Un trigger sí alcanza a todos los roles, así
-- que se usan los dos mecanismos: el trigger es la garantía dura, RLS es
-- la capa que pide §5 explícitamente.

create or replace function ficha_revision_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'ficha_revision es append-only (CLAUDE.md §5 invariante 1): % denegado. Insertá una revisión nueva con n = anterior + 1.',
    tg_op
    using errcode = 'restrict_violation';
end;
$$;

create trigger ficha_revision_sin_update
  before update on ficha_revision
  for each row execute function ficha_revision_append_only();

create trigger ficha_revision_sin_delete
  before delete on ficha_revision
  for each row execute function ficha_revision_append_only();

-- ------------------------------------------------------------
-- n = anterior + 1, asignado por la base
-- ------------------------------------------------------------
-- El cliente no elige `n`. Se toma un lock por ficha para que dos guardados
-- concurrentes no reclamen el mismo número; si aun así colisionan, el unique
-- (ficha_id, n) es la última línea de defensa.

create or replace function ficha_revision_asignar_n()
returns trigger
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.ficha_id::text, 0));

  select coalesce(max(n), 0) + 1
    into new.n
    from ficha_revision
   where ficha_id = new.ficha_id;

  return new;
end;
$$;

create trigger ficha_revision_numerar
  before insert on ficha_revision
  for each row execute function ficha_revision_asignar_n();

-- Mantener ficha.revision_actual_id apuntando a la última revisión.
create or replace function ficha_actualizar_revision_actual()
returns trigger
language plpgsql
as $$
begin
  update ficha
     set revision_actual_id = new.id
   where id = new.ficha_id;
  return new;
end;
$$;

create trigger ficha_revision_marcar_actual
  after insert on ficha_revision
  for each row execute function ficha_actualizar_revision_actual();

-- ------------------------------------------------------------
-- §5 invariante 3 — sellar la decisión sobre una sugerencia
-- ------------------------------------------------------------
-- El CHECK de la tabla exige que decidido_por/decidido_at estén completos
-- cuando estado <> 'pendiente'. Este trigger los completa solo, para que la
-- app no pueda olvidarse ni falsear quién decidió.

create or replace function sugerencia_ia_sellar_decision()
returns trigger
language plpgsql
as $$
begin
  if new.estado <> 'pendiente' and old.estado = 'pendiente' then
    new.decidido_por := coalesce(new.decidido_por, auth.uid());
    new.decidido_at  := coalesce(new.decidido_at, now());
  end if;

  if new.estado = 'pendiente' then
    new.decidido_por := null;
    new.decidido_at  := null;
  end if;

  return new;
end;
$$;

create trigger sugerencia_ia_sellar
  before update on sugerencia_ia
  for each row execute function sugerencia_ia_sellar_decision();
