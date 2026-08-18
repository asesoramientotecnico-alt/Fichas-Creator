import FormularioLogin from "./Formulario";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ volver_a?: string }>;
}) {
  const { volver_a } = await searchParams;

  // `volver_a` viene de la URL. Sólo se acepta una ruta interna, para que
  // nadie arme un /login?volver_a=https://otro-sitio y use el redirect
  // posterior al login como trampolín.
  const destino = volver_a?.startsWith("/") && !volver_a.startsWith("//") ? volver_a : "/";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "var(--space-6)",
      }}
    >
      <div style={{ width: "min(420px, 100%)" }}>
        <p className="eyebrow">Oficina Técnica · FAMIQ</p>
        <h1 className="titulo-pagina" style={{ marginTop: "var(--space-2)" }}>
          Fichas Técnicas
        </h1>
        <FormularioLogin volverA={destino} />
      </div>
    </main>
  );
}
