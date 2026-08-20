import type { Bloque } from "@/lib/tipos";

/**
 * Avisos sobre una ficha antes de guardarla.
 *
 * No inventa reglas: cada una está escrita en §4 del documento de diseño. Se
 * chequean acá porque hasta ahora nada las verificaba — se podía guardar una
 * ficha con dos cabeceras, o una `tabla-ancha` sin la nota que define sus
 * símbolos, y el problema aparecía recién en el PDF que ve el cliente.
 *
 * Son avisos y no bloqueos a propósito. Una ficha a medio cargar es un estado
 * legítimo: nace `borrador` y sale con marca de agua hasta que alguien la
 * apruebe (§5 invariante 4). Bloquear el guardado obligaría a completar todo de
 * una sentada o a perder el trabajo.
 */

export interface Aviso {
  bloqueId: string;
  mensaje: string;
}

export function revisarBloques(bloques: Bloque[]): Aviso[] {
  const avisos: Aviso[] = [];

  // §4: el header es uno por ficha y siempre primero.
  const cabeceras = bloques.filter((b) => b.tipo === "header");
  if (cabeceras.length > 1) {
    for (const c of cabeceras.slice(1)) {
      avisos.push({ bloqueId: c.id, mensaje: "Hay más de una cabecera: la ficha lleva una sola." });
    }
  }
  if (cabeceras.length === 1 && bloques[0]?.tipo !== "header") {
    avisos.push({
      bloqueId: cabeceras[0].id,
      mensaje: "La cabecera tiene que ser el primer bloque de la ficha.",
    });
  }

  for (const b of bloques) {
    switch (b.tipo) {
      case "header":
        if (!b.tituloEs.trim()) {
          avisos.push({ bloqueId: b.id, mensaje: "La cabecera no tiene título en castellano." });
        }
        break;

      // §4: en tabla-ancha la nota define los símbolos de las columnas, así que
      // es obligatoria — sin ella la tabla no se puede leer.
      case "tabla-ancha":
        if (!b.nota?.trim()) {
          avisos.push({
            bloqueId: b.id,
            mensaje: `"${b.etiqueta || "Tabla de cotas"}" no tiene la nota que define sus símbolos.`,
          });
        }
        if (b.columnas.length === 0) {
          avisos.push({ bloqueId: b.id, mensaje: "La tabla de cotas no tiene columnas." });
        }
        break;

      // §4: un croquis es imagen MÁS leyenda de cotas. Sin la leyenda es una
      // imagen, y para eso está el tipo imagen.
      case "croquis":
        if (b.cotas.filter((c) => c.simbolo.trim() || c.nombre.trim()).length === 0) {
          avisos.push({
            bloqueId: b.id,
            mensaje: "El croquis no tiene leyenda de cotas. Si no la lleva, usá el tipo imagen.",
          });
        }
        if (!b.assetId) {
          avisos.push({ bloqueId: b.id, mensaje: "El croquis no tiene imagen asignada." });
        }
        break;

      case "imagen":
        if (!b.assetId) {
          avisos.push({
            bloqueId: b.id,
            mensaje: `"${b.etiqueta || "Imagen"}" no tiene imagen asignada.`,
          });
        }
        break;

      case "tabla":
        if (b.columnas.length === 0) {
          avisos.push({
            bloqueId: b.id,
            mensaje: `"${b.etiqueta || "Tabla"}" no tiene columnas.`,
          });
        }
        break;

      case "tabla-kv":
        if (b.filas.filter((f) => f.label.trim() || f.value.trim()).length === 0) {
          avisos.push({
            bloqueId: b.id,
            mensaje: `"${b.etiqueta || "Tabla"}" está vacía.`,
          });
        }
        break;

      case "texto-rico":
        if (b.parrafos.filter((p) => p.trim()).length === 0) {
          avisos.push({
            bloqueId: b.id,
            mensaje: `"${b.etiqueta || "Párrafos"}" no tiene texto.`,
          });
        }
        break;

      case "chips":
        if (b.items.filter((i) => i.trim()).length === 0) {
          avisos.push({
            bloqueId: b.id,
            mensaje: `"${b.etiqueta || "Etiquetas"}" no tiene ninguna etiqueta.`,
          });
        }
        break;

      case "inline-kv":
      case "barra-destacada":
        if (!b.valor.trim()) {
          avisos.push({
            bloqueId: b.id,
            mensaje: `"${b.etiqueta || "Bloque"}" no tiene valor.`,
          });
        }
        break;

      default:
        break;
    }
  }

  return avisos;
}
