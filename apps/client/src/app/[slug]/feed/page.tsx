"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@ui/components/card";
import { Badge } from "@ui/components/badge";
import { Tabs, TabsList, TabsTrigger } from "@ui/components/tabs";
import { Avatar, AvatarFallback } from "@ui/components/avatar";
import { createClient } from "@/lib/supabase/client";

interface CompanyData {
  id: string;
  slug: string;
  tradeName: string;
  category: string;
  city?: string;
  state?: string;
  logoUrl?: string;
}

interface ReviewRecord {
  id: string;
  overallRating: number;
  comment: string | null;
  isAnonymous: boolean;
  anonymousName: string | null;
  anonymousAvatar: string | null;
  userId: string | null;
  createdAt: string;
}

export default function StoreFeedPage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params.slug as string) || "estabelecimento";

  const [activeTab, setActiveTab] = React.useState<string>("store");
  const [company, setCompany] = React.useState<CompanyData | null>(null);
  const [reviews, setReviews] = React.useState<ReviewRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Load store and reviews from Supabase
  React.useEffect(() => {
    async function fetchFeed() {
      try {
        setLoading(true);
        const supabase = createClient();

        // 1. Fetch Company
        const { data: compData } = await supabase
          .from("Company")
          .select("id, slug, tradeName, category, city, state, logoUrl")
          .eq("slug", slug)
          .maybeSingle();

        if (compData) {
          setCompany(compData);

          // 2. Fetch Reviews for this company
          const { data: revData, error: revErr } = await supabase
            .from("Review")
            .select("id, overallRating, comment, isAnonymous, anonymousName, anonymousAvatar, userId, createdAt")
            .eq("companyId", compData.id)
            .eq("isPublic", true)
            .order("createdAt", { ascending: false });

          if (!revErr && revData) {
            setReviews(revData);
          }
        }
      } catch (err) {
        console.error("Error loading feed:", err);
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchFeed();
    }
  }, [slug]);

  const storeDisplayName = React.useMemo(() => {
    if (company?.tradeName) return company.tradeName;
    return slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }, [company?.tradeName, slug]);

  const storeInitials = React.useMemo(() => {
    return storeDisplayName
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [storeDisplayName]);

  // Current session user for "Minhas avaliações"
  const currentAuth = React.useMemo(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("review_auth");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return null;
        }
      }
    }
    return null;
  }, []);

  const displayedReviews = React.useMemo(() => {
    if (activeTab === "store") {
      return reviews;
    }
    // Minhas avaliações: filter by current auth name or email if available
    if (currentAuth?.name) {
      return reviews.filter(
        (r) => r.anonymousName?.toLowerCase() === currentAuth.name.toLowerCase()
      );
    }
    return [];
  }, [activeTab, reviews, currentAuth]);

  const formatReviewDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recentemente";
    }
  };

  const getAuthorInitials = (name?: string | null) => {
    if (!name) return "CV";
    return name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F8FAFC] text-[#0F172A] antialiased">
      <div className="mx-auto flex w-full max-w-[390px] flex-col gap-3.5 px-4 py-6">
        {/* Cartão de Cabeçalho do Estabelecimento */}
        <Card className="rounded-[14px] border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <CardContent className="flex flex-col gap-3 p-0">
            {/* Top Row: Voltar & Badge Feed Público */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => router.push(`/${slug}/evaluate`)}
                className="text-[12px] font-semibold text-[#2563EB] hover:underline"
              >
                ← Nova Avaliação
              </button>
              <Badge variant="brand">FEED PÚBLICO</Badge>
            </div>

            {/* Identidade da Loja */}
            <div className="flex items-center gap-2.5">
              <Avatar className="h-[42px] w-[42px] rounded-[10px]">
                <AvatarFallback className="rounded-[10px] bg-[#DBEAFE] font-bold text-[15px] text-[#1D4ED8]">
                  {storeInitials || "RV"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-[16px] font-bold text-[#0F172A]">
                    {storeDisplayName}
                  </h1>
                  <Badge variant="success" className="px-1.5 py-0 text-[10px]">
                    Verificado
                  </Badge>
                </div>
                <span className="text-[12px] text-[#64748B]">
                  {company?.category || "Estabelecimento Parceiro"}
                  {company?.city ? ` • ${company.city}` : ""}
                  {company?.state ? `, ${company.state}` : ""}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="w-full">
                <TabsTrigger value="store" className="flex-1 gap-1.5">
                  <span>Esta loja</span>
                  <span className="rounded-full bg-[#EFF6FF] px-1.5 py-0.5 text-[10px] font-semibold text-[#2563EB]">
                    {reviews.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="my" className="flex-1">
                  Minhas avaliações
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Lista de Avaliações */}
        <div className="flex flex-col gap-3">
          {loading && (
            <div className="flex justify-center py-8 text-sm text-[#64748B]">
              Carregando avaliações...
            </div>
          )}

          {!loading &&
            displayedReviews.map((item) => (
              <Card
                key={item.id}
                className="rounded-[14px] border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
              >
                <CardContent className="flex flex-col gap-2.5 p-0">
                  {/* Header do Autor */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-[34px] w-[34px]">
                        <AvatarFallback className="bg-[#DBEAFE] text-[#1D4ED8] text-xs font-bold">
                          {getAuthorInitials(item.anonymousName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          <span className="text-[13px] font-semibold text-[#0F172A]">
                            {item.anonymousName || "Cliente Verificado"}
                          </span>
                          <span className="text-[10px] font-bold text-[#15803D]">
                            ✓
                          </span>
                        </div>
                        <span className="text-[11px] text-[#64748B]">
                          {formatReviewDate(item.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Estrelas */}
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill={star <= item.overallRating ? "#F59E0B" : "none"}
                          stroke={star <= item.overallRating ? "#F59E0B" : "#CBD5E1"}
                          strokeWidth="1.5"
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      ))}
                    </div>
                  </div>

                  {/* Texto do Feedback */}
                  {item.comment ? (
                    <p className="text-[13px] leading-relaxed text-[#0F172A]">
                      "{item.comment}"
                    </p>
                  ) : (
                    <p className="text-[12px] italic text-[#94A3B8]">
                      Avaliação sem comentário por escrito.
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}

          {!loading && displayedReviews.length === 0 && (
            <Card className="rounded-[14px] border-dashed border-[#CBD5E1] bg-white p-8 text-center shadow-none">
              <CardContent className="flex flex-col items-center justify-center gap-2 p-0">
                <span className="text-[14px] font-semibold text-[#0F172A]">
                  {activeTab === "store"
                    ? "Nenhuma avaliação encontrada"
                    : "Você ainda não avaliou este local"}
                </span>
                <p className="text-[12px] text-[#64748B]">
                  {activeTab === "store"
                    ? "Seja o primeiro a compartilhar sua experiência com o estabelecimento!"
                    : "Após enviar uma avaliação com seu perfil, ela aparecerá aqui."}
                </p>
                <button
                  type="button"
                  onClick={() => router.push(`/${slug}/evaluate`)}
                  className="mt-2 text-[13px] font-bold text-[#2563EB] hover:underline"
                >
                  Avaliar agora →
                </button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
