"use client";

import { useEffect, useState } from "react";

/**
 * El mismo valor, pero atrasado: sólo se actualiza cuando pasaron `ms` sin
 * cambios.
 *
 * Existe para la vista previa. Repartir la ficha en hojas exige montar el
 * medidor oculto —que dibuja cada bloque una segunda vez— y leer los altos del
 * DOM. Encadenado a `bloques`, eso corría en cada tecla que se escribía en un
 * campo: con una ficha de quince bloques se siente como si el editor estuviera
 * trabado. Con el retardo, tipear es inmediato y el preview alcanza 250 ms
 * después de que dejás de escribir.
 *
 * No se usa `useDeferredValue`: baja la prioridad del re-render pero igual
 * hace el trabajo una vez por tecla. Acá lo que hay que evitar es el trabajo,
 * no reordenarlo.
 */
export function useRetardado<T>(valor: T, ms = 250): T {
  const [atrasado, setAtrasado] = useState(valor);

  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);

  return atrasado;
}
