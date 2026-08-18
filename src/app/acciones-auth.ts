"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";

export async function iniciarSesion(_estadoPrevio: unknown, datos: FormData) {
  const email = String(datos.get("email") ?? "").trim();
  const password = String(datos.get("password") ?? "");
  const volverA = String(datos.get("volver_a") ?? "/") || "/";

  if (!email || !password) {
    return { error: "Completá email y contraseña." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "No pudimos iniciar sesión. Revisá email y contraseña." };
  }

  revalidatePath("/", "layout");
  redirect(volverA);
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
