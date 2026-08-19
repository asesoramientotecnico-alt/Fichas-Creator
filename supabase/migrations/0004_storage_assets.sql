-- ============================================================
-- M6 — Bucket de assets por familia (§7)
-- ============================================================
-- Los croquis y las fotos se suben una vez, se asocian a la familia, y todas
-- las fichas de esa familia los reusan. La tabla `asset` ya existe (§5); acá
-- se crea el bucket y sus políticas.
--
-- El bucket ya puede existir (se puede crear por la API de Storage), pero las
-- políticas de storage.objects sólo se pueden crear por SQL. Sin ellas, un
-- usuario autenticado recibe "new row violates row-level security policy" al
-- subir: el service_role saltea RLS, la app no.

insert into storage.buckets (id, name, public)
values ('assets-ficha', 'assets-ficha', false)
on conflict (id) do nothing;

-- Bucket privado: las fichas van a cliente, pero los archivos se sirven por
-- URL firmada desde el servidor, no por link permanente adivinable.

create policy "autenticados leen assets de ficha"
  on storage.objects for select to authenticated
  using (bucket_id = 'assets-ficha');

create policy "autenticados suben assets de ficha"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'assets-ficha');

create policy "autenticados reemplazan assets de ficha"
  on storage.objects for update to authenticated
  using (bucket_id = 'assets-ficha') with check (bucket_id = 'assets-ficha');

create policy "autenticados borran assets de ficha"
  on storage.objects for delete to authenticated
  using (bucket_id = 'assets-ficha');
