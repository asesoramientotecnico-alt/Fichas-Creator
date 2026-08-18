"use client";

import { useRouter } from "next/navigation";

interface Props {
  fichaId: string;
  revisiones: { n: number; comentario: string | null; created_at: string }[];
  nA: number;
  nB: number;
}

export default function SelectorRevisiones({ fichaId, revisiones, nA, nB }: Props) {
  const router = useRouter();

  const ir = (a: number, b: number) => router.push(`/fichas/${fichaId}/revisiones?a=${a}&b=${b}`);

  const opciones = revisiones.map((r) => (
    <option key={r.n} value={r.n}>
      Rev. {r.n} — {r.comentario ?? "sin comentario"} ({new Date(r.created_at).toLocaleDateString("es-AR")})
    </option>
  ));

  return (
    <div className="form" style={{ maxWidth: "none", gridTemplateColumns: "1fr 1fr", marginBottom: "var(--space-5)" }}>
      <div className="campo">
        <label htmlFor="rev-a">Desde</label>
        <select id="rev-a" value={nA} onChange={(e) => ir(Number(e.target.value), nB)}>
          {opciones}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="rev-b">Hasta</label>
        <select id="rev-b" value={nB} onChange={(e) => ir(nA, Number(e.target.value))}>
          {opciones}
        </select>
      </div>
    </div>
  );
}
