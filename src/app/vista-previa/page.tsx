import FichaPaginada from "@/components/ficha/FichaPaginada";
import { FICHA_TUERCA, ASSETS_TUERCA } from "@/lib/fixtures/tuerca-autofrenante";

/**
 * Vista previa de control con la ficha de referencia y datos hardcodeados
 * (§8 M2 lo permite). Los bloques del fixture se aplanan para que el paginado
 * automático decida el reparto, como con una ficha real.
 */
export default function VistaPreviaPage() {
  const { hojas: _hojas, ...datos } = FICHA_TUERCA;
  const bloques = FICHA_TUERCA.hojas.flatMap((h) => h.bloques);

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
        datos={datos}
        bloques={bloques}
        assets={ASSETS_TUERCA}
        tituloInterior="Tabla de cotas y dimensiones"
        antetitulo="Tuerca autofrenante con inserto de nylon"
      />
    </main>
  );
}
