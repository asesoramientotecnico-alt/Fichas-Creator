import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca la sesión de Supabase en cada request y protege las rutas.
 * Sin sesión, todo redirige a /login salvo el propio /login y /auth.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() revalida contra el servidor de Auth. No usar getSession() acá:
  // lee la cookie sin verificarla.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ruta = request.nextUrl.pathname;
  const esRutaPublica =
    ruta.startsWith("/login") ||
    ruta.startsWith("/auth") ||
    // Pantalla de control de fidelidad de M2. Datos hardcodeados, sin DB.
    ruta.startsWith("/vista-previa");

  if (!user && !esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("volver_a", ruta);
    return NextResponse.redirect(url);
  }

  if (user && ruta === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.delete("volver_a");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Todo menos estáticos de Next, imágenes y el favicon.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
