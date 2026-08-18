-- ============================================================
-- M1 — Row Level Security (§2: "RLS activo")
-- ============================================================
-- Modelo de acceso de v1: la app es interna de Oficina Técnica. Todo usuario
-- autenticado lee y escribe; `anon` no ve nada. CLAUDE.md no define roles
-- diferenciados, así que no se inventan: cuando existan, se refina acá.
--
-- La excepción es ficha_revision, donde §5 pide revocar UPDATE y DELETE por
-- política. Se hace por omisión: no se crea ninguna política para esas
-- operaciones, así que quedan denegadas. El trigger de 0002 las bloquea
-- además para service_role, que saltea RLS.

alter table familia        enable row level security;
alter table producto       enable row level security;
alter table ficha          enable row level security;
alter table ficha_revision enable row level security;
alter table norma          enable row level security;
alter table asset          enable row level security;
alter table sugerencia_ia  enable row level security;

-- ------------------------------------------------------------
-- Tablas de lectura/escritura plena para autenticados
-- ------------------------------------------------------------

create policy "autenticados leen familia"
  on familia for select to authenticated using (true);
create policy "autenticados escriben familia"
  on familia for insert to authenticated with check (true);
create policy "autenticados modifican familia"
  on familia for update to authenticated using (true) with check (true);
create policy "autenticados borran familia"
  on familia for delete to authenticated using (true);

create policy "autenticados leen producto"
  on producto for select to authenticated using (true);
create policy "autenticados escriben producto"
  on producto for insert to authenticated with check (true);
create policy "autenticados modifican producto"
  on producto for update to authenticated using (true) with check (true);
create policy "autenticados borran producto"
  on producto for delete to authenticated using (true);

create policy "autenticados leen ficha"
  on ficha for select to authenticated using (true);
create policy "autenticados escriben ficha"
  on ficha for insert to authenticated with check (true);
create policy "autenticados modifican ficha"
  on ficha for update to authenticated using (true) with check (true);
create policy "autenticados borran ficha"
  on ficha for delete to authenticated using (true);

create policy "autenticados leen norma"
  on norma for select to authenticated using (true);
create policy "autenticados escriben norma"
  on norma for insert to authenticated with check (true);
create policy "autenticados modifican norma"
  on norma for update to authenticated using (true) with check (true);
create policy "autenticados borran norma"
  on norma for delete to authenticated using (true);

create policy "autenticados leen asset"
  on asset for select to authenticated using (true);
create policy "autenticados escriben asset"
  on asset for insert to authenticated with check (true);
create policy "autenticados modifican asset"
  on asset for update to authenticated using (true) with check (true);
create policy "autenticados borran asset"
  on asset for delete to authenticated using (true);

-- ------------------------------------------------------------
-- §5 invariante 1 — ficha_revision: sólo SELECT e INSERT
-- ------------------------------------------------------------
-- Deliberadamente NO existen políticas de UPDATE ni de DELETE.
-- Con RLS activo, la ausencia de política es denegación.

create policy "autenticados leen revisiones"
  on ficha_revision for select to authenticated using (true);

-- El autor de la revisión es siempre quien está autenticado: no se puede
-- insertar una revisión a nombre de otro.
create policy "autenticados agregan revisiones"
  on ficha_revision for insert to authenticated
  with check (autor_id = auth.uid());

-- ------------------------------------------------------------
-- sugerencia_ia
-- ------------------------------------------------------------
-- Sin DELETE: el rastro de lo que la IA propuso y de quién lo resolvió no se
-- borra (§5 invariante 3, y el requisito 2 de §1).

create policy "autenticados leen sugerencias"
  on sugerencia_ia for select to authenticated using (true);
create policy "autenticados escriben sugerencias"
  on sugerencia_ia for insert to authenticated with check (true);
create policy "autenticados deciden sugerencias"
  on sugerencia_ia for update to authenticated using (true) with check (true);
