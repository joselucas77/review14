import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { searchParams, pathname } = request.nextUrl;
  const code = searchParams.get("code");

  // Se o Supabase redirecionar com ?code=... para a raiz ou outra rota (fallback do Site URL),
  // encaminha imediatamente para /auth/callback para trocar o código PKCE pela sessão
  if (code && pathname !== "/auth/callback") {
    const callbackUrl = new URL("/auth/callback", request.url);
    callbackUrl.searchParams.set("code", code);
    const next = searchParams.get("next");
    if (next) callbackUrl.searchParams.set("next", next);
    return NextResponse.redirect(callbackUrl);
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://tacrpktefuolrgsnbkej.supabase.co";
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhY3Jwa3RlZnVvbHJnc25ia2VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzMDMzOTksImV4cCI6MjEwODg3OTM5OX0.NKp80mNetlhuOblqLZh5iNQzOso4mqXftSCGzAF9Kq0";

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: getUser() refreshes the Auth token and validates the JWT.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = pathname === "/login" || pathname === "/register";
  const isCallbackRoute = pathname === "/auth/callback";

  // Helper para criar redirect preservando cookies de autenticação atualizados
  const createRedirectWithCookies = (targetUrl: URL) => {
    const redirectResponse = NextResponse.redirect(targetUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  };

  // 1. Usuário NÃO autenticado (ou token expirado):
  // Ao acessar qualquer rota protegida (como a raiz "/" ou painel), redireciona para "/login"
  if (!user && !isAuthRoute && !isCallbackRoute) {
    const loginUrl = new URL("/login", request.url);
    return createRedirectWithCookies(loginUrl);
  }

  // 2. Usuário JÁ autenticado com token válido:
  // Ao tentar acessar "/login" ou "/register", redireciona para a raiz "/" (Dashboard)
  if (user && isAuthRoute) {
    const dashboardUrl = new URL("/", request.url);
    return createRedirectWithCookies(dashboardUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
