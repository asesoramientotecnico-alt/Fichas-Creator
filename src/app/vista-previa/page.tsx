import FichaVista from "@/components/ficha/FichaVista";
import { FICHA_TUERCA, ASSETS_TUERCA } from "@/lib/fixtures/tuerca-autofrenante";

/**
 * Vista previa de M2 con la ficha de referencia y datos hardcodeados
 * (§8 M2 lo permite explícitamente). Sirve para el control de fidelidad
 * contra el PDF original.
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
      <FichaVista datos={FICHA_TUERCA} assets={ASSETS_TUERCA} />
    </main>
  );
}
