import Link from "next/link";
import Cabecera from "@/components/Cabecera";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";
import FormularioNuevaFicha from "./Formulario";

export default async function NuevaFichaPage() {
  const supabase = await crearClienteServidor();
  const { data: productos } = await supabase
    .from("producto")
    .select("id, sku, nombre_es")
    .order("nombre_es")
    .overrideTypes<{ id: string; sku: string; nombre_es: string }[]>();

  return (
    <div className="app-shell">
      <Cabecera />
      <main className="app-main">
        <p className="eyebrow">Fichas</p>
        <h1 className="titulo-pagina" style={{ marginTop: "var(--space-2)" }}>
          Nueva ficha
        </h1>

        {!productos || productos.length === 0 ? (
          <p className="vacio">
            No hay productos cargados todavía.{" "}
            <Link href="/productos/nuevo">Creá el primero</Link>.
          </p>
        ) : (
          <FormularioNuevaFicha productos={productos} />
        )}
      </main>
    </div>
  );
}
