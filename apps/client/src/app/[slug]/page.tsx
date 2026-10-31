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

  // Fetch real store from Supabase
  React.useEffect(() => {
    async function loadStore() {
      try {
        setLoading(true);
        const supabase = createClient();
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
      loadStore();
    }
  }, [slug]);

  // Destination name: Real tradeName if available, else formatted slug
  const destinationName = React.useMemo(() => {
    if (storeData?.tradeName) return storeData.tradeName;
    return slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }, [storeData?.tradeName, slug]);

  const handleOAuth = (provider: "google" | "apple") => {
    // Redireciona mantendo o slug no callback
    router.push(`/api/auth/signin?callbackUrl=/${slug}/evaluate`);
  };

  const handleEmailSubmit = (data: { email: string; password: string }) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "review_auth",
        JSON.stringify({
          isAnonymous: false,
          email: data.email,
          name: data.email.split("@")[0],
          avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${data.email}`,
        })
      );
    }
    router.push(`/${slug}/evaluate`);
  };

  const handleRegisterSubmit = (data: {
    name: string;
    email: string;
    password: string;
  }) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "review_auth",
        JSON.stringify({
          isAnonymous: false,
          name: data.name,
          email: data.email,
          avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${data.email}`,
        })
      );
    }
    router.push(`/${slug}/evaluate`);
  };

  const handleGuestContinue = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "review_auth",
        JSON.stringify({
          isAnonymous: true,
          name: "Cliente Anônimo",
          email: null,
          avatarUrl: null,
        })
      );
    }
    router.push(`/${slug}/evaluate`);
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F8FAFC] px-5 py-8 text-[#0F172A] antialiased">
      {/* Container Centralizado de 390px (Mobile Standard) */}
      <div className="mx-auto flex w-full max-w-[390px] flex-col items-center gap-6">
        {mode === "options" && (
          <>
            {/* Header com Logo e Badge de Destino */}
            <LogoBadge destination={destinationName} icon="star" />

            {storeNotFound && !loading && (
              <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-xs text-amber-800">
                <p className="font-semibold">Estabelecimento não encontrado no sistema</p>
                <p className="mt-1 text-amber-700">
                  Você ainda pode visualizar e testar o fluxo de avaliação demonstrativo.
                </p>
              </div>
            )}

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
      </div>
    </div>
  );
}
