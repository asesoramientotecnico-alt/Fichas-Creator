import FichaPaginada from "@/components/ficha/FichaPaginada";
import {
  BLOQUES_VALVULA,
  ASSETS_VALVULA,
  DATOS_VALVULA,
  HOJAS_VALVULA,
} from "@/lib/fixtures/valvula-esferica";

/**
 * Vista previa de control con la plantilla de referencia V26 y datos
 * hardcodeados (§8 M2 lo permite). El paginado decide el reparto en hojas,
 * como con una ficha real: el fixture no declara en qué hoja va cada bloque.
 */
export default function VistaPreviaPage() {
  return (
    <main
      style={{
        background: "var(--famiq-grey-200)",
        minHeight: "100vh",
        padding: "10mm",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <FichaPaginada
        datos={DATOS_VALVULA}
        bloques={BLOQUES_VALVULA}
        assets={ASSETS_VALVULA}
        tituloInterior={HOJAS_VALVULA.tituloInterior}
        antetitulo={HOJAS_VALVULA.antetitulo}
      />
    </main>
  );
}
