"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogoBadge } from "@/components/auth/logo-badge";
import { Button } from "@ui/components/button";
import { Card, CardContent } from "@ui/components/card";
import { Badge } from "@ui/components/badge";
import { createClient } from "@/lib/supabase/client";

interface StoreItem {
  id: string;
  slug: string;
  tradeName: string;
  category?: string;
  city?: string;
  state?: string;
  logoUrl?: string;
}

export default function StoreSelectorPage() {
  const router = useRouter();
  const [storeQuery, setStoreQuery] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [stores, setStores] = React.useState<StoreItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSearching, setIsSearching] = React.useState(false);

  // Busca estabelecimentos ativos no Supabase
  React.useEffect(() => {
    async function loadStores() {
      try {
        setLoading(true);
        const supabase = createClient();
        const { data, error } = await supabase
          .from("Company")
          .select("id, slug, tradeName, category, city, state, logoUrl")
          .order("createdAt", { ascending: false })
          .limit(20);

        if (!error && data) {
          setStores(data);
        }
      } catch (err) {
        console.warn("Erro ao buscar lojas:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStores();
  }, []);

  const handleAccessStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const raw = storeQuery.trim();
    if (!raw) {
      setErrorMsg("Digite o nome ou identificador da loja.");
      return;
    }

    setIsSearching(true);

    try {
      // 1. Extrai o slug caso o usuário tenha colado uma URL completa
      let potentialSlug = raw;
      if (raw.startsWith("http://") || raw.startsWith("https://")) {
        try {
          const url = new URL(raw);
          const segments = url.pathname.split("/").filter(Boolean);
          potentialSlug = segments[0] || "";
        } catch {}
      } else if (raw.includes("/")) {
        const segments = raw.split("/").filter(Boolean);
        potentialSlug = segments[segments.length - 1];
      }

      const cleanSlug = potentialSlug.toLowerCase().replace(/[^a-z0-9-_]/g, "");

      const supabase = createClient();

      // 2. Busca primeiro por slug exato no banco
      if (cleanSlug) {
        const { data: bySlug } = await supabase
          .from("Company")
          .select("slug")
          .eq("slug", cleanSlug)
          .maybeSingle();

        if (bySlug?.slug) {
          router.push(`/${bySlug.slug}`);
          return;
        }
      }

      // 3. Busca por Nome Fantasia aproximado (ex: "Café Aurora")
      const { data: byName } = await supabase
        .from("Company")
        .select("slug")
        .ilike("tradeName", `%${raw}%`)
        .order("createdAt", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (byName?.slug) {
        router.push(`/${byName.slug}`);
        return;
      }

      // 4. Se não encontrou nem por slug nem por nome, tenta navegar para o slug digitado
      if (cleanSlug) {
        router.push(`/${cleanSlug}`);
      } else {
        setErrorMsg("Identificador da loja inválido. Exemplo: cafe-aurora");
      }
    } catch (err) {
      console.warn("Erro ao buscar loja:", err);
      const cleanSlug = raw.toLowerCase().replace(/[^a-z0-9-_]/g, "");
      if (cleanSlug) {
        router.push(`/${cleanSlug}`);
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Filtro dinâmico na lista de lojas abaixo
  const filteredStores = React.useMemo(() => {
    if (!storeQuery.trim()) return stores;
    const q = storeQuery.toLowerCase().trim();
    return stores.filter(
      (s) =>
        s.tradeName.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        (s.category && s.category.toLowerCase().includes(q))
    );
  }, [stores, storeQuery]);

  const tenantUrl =
    process.env.NEXT_PUBLIC_TENANT_URL || "https://tenant-review14.vercel.app";

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F8FAFC] px-5 py-8 text-[#0F172A] antialiased">
      <div className="mx-auto flex w-full max-w-[390px] flex-col items-center gap-5">
        {/* Logo e Identidade Review14 */}
        <LogoBadge icon="star" />

        <div className="flex flex-col items-center text-center gap-1 pt-1">
          <Badge variant="brand" className="text-[11px] font-bold uppercase tracking-wider py-0.5 px-2.5">
            Acesso a Estabelecimentos
          </Badge>
          <h1 className="text-[22px] font-bold tracking-tight text-[#0F172A] pt-1">
            Qual loja deseja avaliar?
          </h1>
          <p className="text-[13px] text-[#64748B] leading-relaxed">
            Para avaliar uma experiência, é necessário acessar o link exclusivo ou escanear o QR Code da loja.
          </p>
        </div>

        {/* Formulário de Digitação do Link ou Slug */}
        <Card className="w-full rounded-[16px] border-[#E2E8F0] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <CardContent className="flex flex-col gap-3.5 p-0">
            <form onSubmit={handleAccessStore} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5 text-left">
                <label htmlFor="store-input" className="text-[13px] font-semibold text-[#0F172A]">
                  Nome ou identificador da loja (slug):
                </label>
                <div className="relative flex items-center">
                  <div className="pointer-events-none absolute left-3 flex items-center text-slate-400">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  </div>
                  <input
                    id="store-input"
                    type="text"
                    value={storeQuery}
                    onChange={(e) => {
                      setStoreQuery(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Ex: cafe-aurora ou Café Aurora"
                    className="w-full rounded-[10px] border border-[#CBD5E1] bg-slate-50/60 py-2.5 pl-9 pr-3 text-[14px] text-[#0F172A] placeholder-slate-400 transition focus:border-[#2563EB] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                  />
                </div>
                {errorMsg && (
                  <span className="text-[12px] font-medium text-red-600">
                    {errorMsg}
                  </span>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSearching}
                size="lg"
                fullWidth
                className="gap-2 font-semibold shadow-xs bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              >
                <span>{isSearching ? "Buscando Loja..." : "Acessar Loja para Avaliar"}</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Lista de Estabelecimentos Cadastrados */}
        <div className="flex w-full flex-col gap-2.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[#64748B]">
              Lojas Disponíveis
            </span>
            <span className="text-[11px] text-[#94A3B8]">
              {filteredStores.length} encontrada{filteredStores.length === 1 ? "" : "s"}
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-14 w-full animate-pulse rounded-xl bg-slate-200/70"
                />
              ))}
            </div>
          ) : filteredStores.length > 0 ? (
            <div className="flex flex-col gap-2">
              {filteredStores.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => router.push(`/${s.slug}`)}
                  className="flex w-full items-center justify-between rounded-xl border border-[#E2E8F0] bg-white p-3 text-left shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition hover:border-[#2563EB] hover:bg-blue-50/30 active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-blue-600 font-bold overflow-hidden">
                      {s.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.logoUrl}
                          alt={s.tradeName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{s.tradeName.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[14px] font-semibold text-[#0F172A] truncate">
                        {s.tradeName}
                      </span>
                      <span className="text-[11px] font-mono text-[#64748B] truncate">
                        /{s.slug} {s.city ? `• ${s.city}` : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[12px] font-semibold text-blue-600 shrink-0">
                    <span>Avaliar</span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">
              {storeQuery
                ? `Nenhuma loja encontrada para "${storeQuery}".`
                : "Nenhuma loja cadastrada no momento. Solicite o link ou QR Code no estabelecimento."}
            </div>
          )}
        </div>

        {/* Como funciona */}
        <div className="w-full rounded-xl border border-slate-200/80 bg-white p-3.5 space-y-2 text-left">
          <span className="text-[12px] font-bold text-slate-800">
            Como avaliar um estabelecimento?
          </span>
          <div className="space-y-1.5 text-[11px] text-slate-600">
            <div className="flex items-center gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">1</span>
              <span>Aponte a câmera do celular para o QR Code na mesa ou balcão</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">2</span>
              <span>Faça login rápido com Google ou e-mail</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">3</span>
              <span>Envie sua nota sincera e fotos da sua experiência</span>
            </div>
          </div>
        </div>

        {/* Rodapé para o Dono da Loja */}
        <div className="pt-2 text-center text-[12px] text-slate-500">
          <span>Você é dono de uma loja? </span>
          <a
            href={tenantUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-blue-600 hover:underline"
          >
            Acesse o Painel do Lojista →
          </a>
        </div>
      </div>
    </div>
  );
}
