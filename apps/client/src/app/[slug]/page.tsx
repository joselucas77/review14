"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { LogoBadge } from "@/components/auth/logo-badge";
import { LoginOptionsCard } from "@/components/auth/login-options-card";
import { EmailLoginCard } from "@/components/auth/email-login-card";
import { RegisterCard } from "@/components/auth/register-card";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "options" | "email" | "register";

interface StoreData {
  id: string;
  slug: string;
  tradeName: string;
  category: string;
  logoUrl?: string;
  planTier: string;
}

export default function StoreAuthPage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params.slug as string) || "estabelecimento";

  const [mode, setMode] = React.useState<AuthMode>("options");
  const [storeData, setStoreData] = React.useState<StoreData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [storeNotFound, setStoreNotFound] = React.useState(false);

  // Fetch real store from Supabase & check existing auth
  React.useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const supabase = createClient();

        // 1. Check if user is already authenticated
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          if (typeof window !== "undefined") {
            sessionStorage.setItem(
              "review_auth",
              JSON.stringify({
                isAnonymous: false,
                name:
                  user.user_metadata?.full_name ||
                  user.user_metadata?.name ||
                  user.email?.split("@")[0] ||
                  "Cliente Verificado",
                email: user.email,
                avatarUrl:
                  user.user_metadata?.avatar_url ||
                  user.user_metadata?.picture ||
                  `https://api.dicebear.com/7.x/identicon/svg?seed=${user.email}`,
                userId: user.id,
              })
            );
          }
          router.push(`/${slug}/evaluate`);
          return;
        }

        // 2. Fetch Store
        const { data, error } = await supabase
          .from("Company")
          .select("id, slug, tradeName, category, logoUrl, planTier")
          .eq("slug", slug)
          .maybeSingle();

        if (error || !data) {
          console.warn("Store not found in DB for slug:", slug);
          setStoreNotFound(true);
        } else {
          setStoreData(data);
          if (typeof window !== "undefined") {
            sessionStorage.setItem("current_company", JSON.stringify(data));
          }
        }
      } catch (err) {
        console.error("Error loading store:", err);
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      init();
    }
  }, [slug, router]);

  // Destination name: Real tradeName if available, else formatted slug
  const destinationName = React.useMemo(() => {
    if (storeData?.tradeName) return storeData.tradeName;
    return slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }, [storeData?.tradeName, slug]);

  const handleOAuth = async (provider: "google" | "apple") => {
    if (provider === "google") {
      try {
        const supabase = createClient();
        const origin = window.location.origin;

        // Armazena a rota de retorno em cookie e localStorage para recuperar no callback
        if (typeof document !== "undefined") {
          document.cookie = `review14_eval_next=/${slug}/evaluate; path=/; max-age=600; SameSite=Lax`;
          try {
            localStorage.setItem("review14_eval_next", `/${slug}/evaluate`);
          } catch {}
        }

        // URL limpa sem query string para compatibilidade exata com o allowlist do Supabase
        const redirectUrl = `${origin}/auth/callback`;

        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: redirectUrl,
            queryParams: {
              access_type: "offline",
              prompt: "consent",
            },
          },
        });

        if (error) {
          console.error("Erro no login Google:", error);
          alert(error.message || "Erro ao conectar com Google.");
        }
      } catch (err: any) {
        console.error("Erro no login Google:", err);
        alert("Não foi possível conectar com o Google.");
      }
    } else {
      alert("Autenticação com Apple em desenvolvimento.");
    }
  };

  const handleEmailSubmit = async (data: { email: string; password: string }) => {
    try {
      const supabase = createClient();
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email.trim(),
        password: data.password,
      });

      if (error) {
        alert(error.message || "E-mail ou senha incorretos.");
        return;
      }

      if (authData.user && typeof window !== "undefined") {
        sessionStorage.setItem(
          "review_auth",
          JSON.stringify({
            isAnonymous: false,
            email: authData.user.email,
            name:
              authData.user.user_metadata?.full_name ||
              authData.user.user_metadata?.name ||
              authData.user.email?.split("@")[0],
            avatarUrl:
              authData.user.user_metadata?.avatar_url ||
              `https://api.dicebear.com/7.x/identicon/svg?seed=${authData.user.email}`,
            userId: authData.user.id,
          })
        );
      }
      router.push(`/${slug}/evaluate`);
    } catch (err: any) {
      console.error("Erro no login:", err);
      alert("Ocorreu um erro ao fazer login.");
    }
  };

  const handleRegisterSubmit = async (data: {
    name: string;
    email: string;
    password: string;
  }) => {
    try {
      const supabase = createClient();
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email.trim(),
        password: data.password,
        options: {
          data: {
            name: data.name.trim(),
            role: "CUSTOMER",
          },
        },
      });

      if (error) {
        alert(error.message || "Falha ao criar conta.");
        return;
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          "review_auth",
          JSON.stringify({
            isAnonymous: false,
            name: data.name,
            email: data.email,
            avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${data.email}`,
            userId: authData.user?.id,
          })
        );
      }
      router.push(`/${slug}/evaluate`);
    } catch (err: any) {
      console.error("Erro no cadastro:", err);
      alert("Ocorreu um erro ao realizar cadastro.");
    }
  };

  const handleGuestContinue = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "review_auth",
        JSON.stringify({
          isAnonymous: true,
          name: "Cliente Anônimo",
        })
      );
    }
    router.push(`/${slug}/evaluate`);
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F8FAFC] px-5 py-8 text-[#0F172A] antialiased">
      {/* Container Centralizado de 390px (Mobile Standard) */}
      <div className="mx-auto flex w-full max-w-[390px] flex-col items-center gap-6">
        {storeNotFound && !loading ? (
          <div className="flex w-full flex-col items-center gap-4 text-center pt-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <div className="flex flex-col gap-1">
              <h1 className="text-[20px] font-bold text-[#0F172A]">
                Loja não encontrada
              </h1>
              <p className="text-[13px] text-[#64748B] leading-relaxed">
                Não encontramos nenhum estabelecimento ativo com o identificador <span className="font-mono font-semibold text-[#0F172A]">/{slug}</span>.
              </p>
            </div>

            <div className="w-full pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="w-full rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white p-3 text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                Buscar ou Informar Outra Loja
              </button>
            </div>
          </div>
        ) : (
          <>
            {mode === "options" && (
              <>
                {/* Header com Logo e Badge de Destino */}
                <LogoBadge destination={destinationName} icon="star" />

                {/* Cartão com Opções de Login */}
                <LoginOptionsCard
                  onSelectGoogle={() => handleOAuth("google")}
                  onSelectApple={() => handleOAuth("apple")}
                  onSelectEmail={() => setMode("email")}
                  onGoToRegister={() => setMode("register")}
                  onContinueAsGuest={handleGuestContinue}
                />
              </>
            )}

            {mode === "email" && (
              <EmailLoginCard
                onBackToOptions={() => setMode("options")}
                onGoToRegister={() => setMode("register")}
                onSubmit={handleEmailSubmit}
              />
            )}

            {mode === "register" && (
              <RegisterCard
                onBackToLogin={() => setMode("options")}
                onSubmit={handleRegisterSubmit}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
