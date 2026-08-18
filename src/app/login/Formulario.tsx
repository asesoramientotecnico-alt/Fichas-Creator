"use client";

import { useActionState } from "react";
import { iniciarSesion } from "@/app/acciones-auth";

export default function FormularioLogin({ volverA }: { volverA: string }) {
  const [estado, accion, pendiente] = useActionState(iniciarSesion, null);

  return (
    <form action={accion} className="form">
      <input type="hidden" name="volver_a" value={volverA} />

      <div className="campo">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </div>

      <div className="campo">
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {estado?.error ? <p className="error">{estado.error}</p> : null}

      <button className="boton" type="submit" disabled={pendiente}>
        {pendiente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
