import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";
import { cerrarSesion } from "@/app/acciones-auth";

export default async function Cabecera() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="app-header">
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-6)" }}>
        <Link href="/" className="marca" style={{ color: "var(--fg-1)" }}>
          Fichas <span>Técnicas</span>
        </Link>
        <nav className="app-nav">
          <Link href="/">Fichas</Link>
          <Link href="/productos">Productos</Link>
        </nav>
      </div>

      {user ? (
        <form action={cerrarSesion} style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          <span style={{ color: "var(--fg-3)", fontSize: "var(--fs-micro)" }}>{user.email}</span>
          <button className="boton" data-variante="secundario" type="submit">
            Salir
          </button>
        </form>
      ) : null}
    </header>
  );
}
