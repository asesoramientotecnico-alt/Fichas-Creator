-- ============================================================
-- Limpiar los datos de prueba
-- ============================================================
-- Correr en Supabase → SQL Editor, pegado tal cual.
--
-- Este archivo vive en el repo a propósito: el SQL de limpieza se venía pasando
-- por chat y se perdía. Está acá, en docs/, y se puede volver a buscar cuando
-- haga falta.
--
-- QUÉ BORRA. Los productos que las pruebas automáticas y los diagnósticos van
-- dejando, que se reconocen por el prefijo de su SKU:
--
--   TAL-*    el taller de edición (e2e/taller-editor.spec.ts)
--   PDF-*    la carga desde PDF (e2e/extraccion-pdf.spec.ts)
--   M3-*     editor y revisiones
--   M5-*     el revisor con IA
--   M6-*     familias y assets
--   E2E-*    auth y CRUD
--   ANUL-*   anulación de fichas
--   *-DEMO   las fichas de demostración que se armaron a mano para mirar algo
--
-- QUÉ NO BORRA. Cualquier producto cuyo SKU no entre en esa lista. Los
-- productos de verdad del catálogo no se tocan: revisá con el SELECT del
-- final ANTES de correr el DELETE, que te dice exactamente qué se va.
--
-- POR QUÉ DESHABILITA UN TRIGGER. `ficha_revision` es append-only y su trigger
-- rechaza todo DELETE (§5 invariante 1). Borrar un producto cascadea a su
-- ficha y de ahí a sus revisiones, así que sin deshabilitarlo el borrado falla
-- entero. Se vuelve a habilitar en la misma transacción, y si algo sale mal el
-- ROLLBACK lo deja habilitado igual. Esa invariante existe para que no se pueda
-- reescribir el historial de una ficha real; acá se está tirando la ficha
-- completa, que es otra cosa.

begin;

alter table ficha_revision disable trigger ficha_revision_sin_delete;

-- Los productos de prueba. La ficha, sus revisiones y sus sugerencias se van
-- por cascada.
delete from producto
where sku like 'TAL-%'
   or sku like 'PDF-%'
   or sku like 'M3-%'
   or sku like 'M5-%'
   or sku like 'M6-%'
   or sku like 'E2E-%'
   or sku like 'ANUL-%'
   or sku like '%-DEMO';

alter table ficha_revision enable trigger ficha_revision_sin_delete;

-- Las familias que quedaron sin ningún producto. Las pruebas de M6 crean una
-- familia por corrida y no la limpian.
delete from familia f
where not exists (select 1 from producto p where p.familia_id = f.id);

-- Los assets huérfanos: los de una familia que ya no está se fueron por
-- cascada, pero los que se subieron sin familia quedan.
delete from asset
where familia_id is null;

commit;

-- ============================================================
-- Control: qué quedó
-- ============================================================
-- Correr esto ANTES para ver qué se va a borrar, y DESPUÉS para confirmar que
-- sólo quedaron los productos de verdad.

select p.sku, p.nombre_es, f.estado, count(r.id) as revisiones
from producto p
left join ficha f on f.producto_id = p.id
left join ficha_revision r on r.ficha_id = f.id
group by p.sku, p.nombre_es, f.estado
order by p.sku;

-- Los archivos del Storage no se borran desde acá: el bucket de assets se
-- limpia desde Supabase → Storage. Un archivo sin fila en `asset` no lo
-- referencia nadie y no molesta más que en la factura.

-- Los usuarios de prueba tampoco salen de acá: `auth.users` no se toca con SQL
-- de la aplicación. Se borran desde Supabase → Authentication → Users. Son los
-- que tienen mail `e2e-*@famiq.com.ar` o `diag-*@famiq.com.ar`; conviene dejar
-- uno vivo, porque la suite de pruebas necesita un usuario para entrar
-- (E2E_EMAIL / E2E_PASSWORD).
