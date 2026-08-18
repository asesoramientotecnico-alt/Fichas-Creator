-- ============================================================
-- Verificación de las invariantes de §5
-- Criterio de aceptación de M1: un UPDATE sobre ficha_revision
-- debe fallar a nivel de base de datos.
-- ============================================================
\set ON_ERROR_STOP off
\timing off

-- Datos mínimos
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'tecnica@famiq.com.ar');
insert into familia (id, nombre) values
  ('22222222-2222-2222-2222-222222222222', 'Tuercas de acero inoxidable');
insert into producto (id, sku, nombre_es, familia_id) values
  ('33333333-3333-3333-3333-333333333333', 'FT-6.1',
   'Tuerca autofrenante con inserto de nylon',
   '22222222-2222-2222-2222-222222222222');
insert into ficha (id, producto_id) values
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333');

\echo ''
\echo '=== 1. n se autoasigna 1, 2, 3 ==='
insert into ficha_revision (ficha_id, bloques, autor_id, comentario)
  values ('44444444-4444-4444-4444-444444444444', '[]', '11111111-1111-1111-1111-111111111111', 'primera');
insert into ficha_revision (ficha_id, bloques, autor_id, comentario)
  values ('44444444-4444-4444-4444-444444444444', '[]', '11111111-1111-1111-1111-111111111111', 'segunda');
insert into ficha_revision (ficha_id, bloques, autor_id, comentario)
  values ('44444444-4444-4444-4444-444444444444', '[]', '11111111-1111-1111-1111-111111111111', 'tercera');
select n, comentario from ficha_revision order by n;

\echo ''
\echo '=== 2. ficha.revision_actual_id apunta a la última ==='
select (f.revision_actual_id = r.id) as apunta_a_la_ultima
  from ficha f
  join ficha_revision r on r.ficha_id = f.id and r.n = 3
 where f.id = '44444444-4444-4444-4444-444444444444';

\echo ''
\echo '=== 3. UPDATE sobre ficha_revision — DEBE FALLAR (aceptación M1) ==='
update ficha_revision set comentario = 'alterado' where n = 1;

\echo ''
\echo '=== 4. DELETE sobre ficha_revision — DEBE FALLAR ==='
delete from ficha_revision where n = 1;

\echo ''
\echo '=== 5. Contenido intacto tras los intentos ==='
select n, comentario from ficha_revision order by n;

\echo ''
\echo '=== 6. norma sin año de edición — DEBE FALLAR (invariante 2) ==='
insert into norma (codigo) values ('ASME B18.16.6');

\echo ''
\echo '=== 7. norma con año — OK ==='
insert into norma (codigo, edicion_anio) values ('ASME B18.16.6', 2020);
select codigo, edicion_anio from norma;

\echo ''
\echo '=== 8. sugerencia decidida sin decisor — DEBE FALLAR (invariante 3) ==='
insert into sugerencia_ia (revision_id, bloque_id, campo, motivo, severidad, estado)
  select id, 'b1', 'descripcion', 'prueba', 'error', 'aceptada'
    from ficha_revision where n = 1;

\echo ''
\echo '=== 9. sugerencia pendiente — OK ==='
insert into sugerencia_ia (id, revision_id, bloque_id, campo, motivo, severidad)
  select '55555555-5555-5555-5555-555555555555', id, 'b1', 'descripcion',
         'Whitworth atribuida a ASME B18.16.6', 'error'
    from ficha_revision where n = 1;
select estado, decidido_por, decidido_at from sugerencia_ia;

\echo ''
\echo '=== 10. al aceptarla, el trigger sella quién y cuándo ==='
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update sugerencia_ia set estado = 'aceptada' where id = '55555555-5555-5555-5555-555555555555';
select estado,
       (decidido_por = '11111111-1111-1111-1111-111111111111') as decisor_sellado,
       (decidido_at is not null) as fecha_sellada
  from sugerencia_ia;
