/**
 * Helper utilitário para obter o domínio base da aplicação do cliente (consumidor final).
 * - Em produção na Vercel: https://cliente-review14.vercel.app
 * - Em desenvolvimento local: http://localhost:3000
 */
export function getClientBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_CLIENT_URL) {
    return process.env.NEXT_PUBLIC_CLIENT_URL.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    // Se estiver na Vercel (*.vercel.app)
    if (hostname.includes("vercel.app")) {
      return "https://cliente-review14.vercel.app";
    }
    // Se estiver em desenvolvimento local
    return window.location.origin.replace(":3002", ":3000");
  }

  return process.env.NODE_ENV === "production"
    ? "https://cliente-review14.vercel.app"
    : "http://localhost:3000";
}

export function getClientStoreUrl(slug?: string | null): string {
  const base = getClientBaseUrl();
  return slug ? `${base}/${slug}` : base;
}
