"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@ui/components/card";
import { Badge } from "@ui/components/badge";
import { Tabs, TabsList, TabsTrigger } from "@ui/components/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@ui/components/avatar";
import { Button } from "@ui/components/button";
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
  authorName: string;
  authorAvatar: string | null;
  merchantReply?: string | null;
  repliedAt?: string | null;
  createdAt: string;
  media?: { id: string; url: string; fileKey: string; type: string }[];
}

export default function StoreFeedPage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params.slug as string) || "estabelecimento";

  const [activeTab, setActiveTab] = React.useState<string>("store");
  const [filterChip, setFilterChip] = React.useState<"all" | "photos" | "stars5">("all");
  const [company, setCompany] = React.useState<CompanyData | null>(null);
  const [reviews, setReviews] = React.useState<ReviewRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);

  // Check current session auth for "Minhas avaliações"
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

  // Load store, session and reviews from Supabase
  React.useEffect(() => {
    async function fetchFeed() {
      try {
        setLoading(true);
        const supabase = createClient();

        // 1. Check current logged user
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
        }

        // 2. Fetch Company
        const { data: compData } = await supabase
          .from("Company")
          .select("id, slug, tradeName, category, city, state, logoUrl")
          .eq("slug", slug)
          .maybeSingle();

        if (compData) {
          setCompany(compData);

          // 3. Fetch Reviews with joined User profile
          const { data: revData, error: revErr } = await supabase
            .from("Review")
            .select(`
              id,
              overallRating,
              comment,
              isAnonymous,
              anonymousName,
              anonymousAvatar,
              userId,
              merchantReply,
              repliedAt,
              createdAt,
              user:User (
                id,
                name,
                avatarUrl
              ),
              ReviewMedia (
                id,
                url,
                fileKey,
                type
              )
            `)
            .eq("companyId", compData.id)
            .eq("isPublic", true)
            .order("createdAt", { ascending: false });

          if (!revErr && revData) {
            const mapped: ReviewRecord[] = revData.map((r: any) => {
              const authorName = r.isAnonymous
                ? r.anonymousName || "Cliente Anônimo"
                : r.user?.name || r.anonymousName || "Cliente Verificado";
              const authorAvatar = r.isAnonymous
                ? null
                : r.user?.avatarUrl || r.anonymousAvatar || null;

              return {
                id: r.id,
                overallRating: Number(r.overallRating) || 5,
                comment: r.comment || null,
                isAnonymous: Boolean(r.isAnonymous),
                anonymousName: r.anonymousName,
                anonymousAvatar: r.anonymousAvatar,
                userId: r.userId,
                authorName,
                authorAvatar,
                merchantReply: r.merchantReply || null,
                repliedAt: r.repliedAt || null,
                createdAt: r.createdAt,
                media: Array.isArray(r.ReviewMedia) ? r.ReviewMedia : [],
              };
            });
            setReviews(mapped);
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

  // Overall store stats
  const averageRating = React.useMemo(() => {
    if (reviews.length === 0) return "5.0";
    const sum = reviews.reduce((acc, r) => acc + r.overallRating, 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviews]);

  const displayedReviews = React.useMemo(() => {
    let list = reviews;

    // Filter by tab
    if (activeTab === "user") {
      list = list.filter((r) => {
        if (currentUserId && r.userId === currentUserId) return true;
        if (currentAuth?.userId && r.userId === currentAuth.userId) return true;
        if (currentAuth?.name && r.authorName.toLowerCase() === currentAuth.name.toLowerCase()) return true;
        return false;
      });
    }

    // Filter by chip
    if (filterChip === "photos") {
      list = list.filter((r) => r.media && r.media.length > 0);
    } else if (filterChip === "stars5") {
      list = list.filter((r) => r.overallRating === 5);
    }

    return list;
  }, [activeTab, filterChip, reviews, currentUserId, currentAuth]);

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
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F8FAFC] text-[#0F172A] antialiased">
      <div className="mx-auto flex w-full max-w-[390px] flex-col gap-3.5 px-4 py-6">
        {/* Cartão de Cabeçalho do Estabelecimento */}
        <Card className="rounded-[14px] border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <CardContent className="flex flex-col gap-3.5 p-0">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 rounded-[12px] border border-[#CBD5E1] bg-slate-100 overflow-hidden">
                {company?.logoUrl ? (
                  <AvatarImage
                    src={company.logoUrl}
                    alt={storeDisplayName}
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback className="bg-[#DBEAFE] text-[16px] font-bold text-[#1D4ED8]">
                  {storeInitials}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-[16px] font-bold text-[#0F172A] truncate">
                    {storeDisplayName}
                  </h1>
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#2563EB] text-[9px] text-white">
                    ✓
                  </span>
                </div>
                <span className="text-[12px] text-[#64748B]">
                  {company?.category || "Restaurante"}
                  {company?.city ? ` • ${company.city}` : ""}
                </span>
              </div>
            </div>

            {/* Métricas do Estabelecimento */}
            <div className="flex items-center justify-between border-t border-[#F1F5F9] pt-3">
              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="#F59E0B"
                      stroke="#F59E0B"
                      strokeWidth="1.5"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ))}
                </div>
                <span className="text-[14px] font-bold text-[#0F172A]">
                  {averageRating}
                </span>
                <span className="text-[12px] text-[#64748B]">
                  ({reviews.length} avaliaç{reviews.length === 1 ? "ão" : "ões"})
                </span>
              </div>

              <Button
                size="sm"
                onClick={() => router.push(`/${slug}/evaluate`)}
                className="font-semibold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
              >
                + Avaliar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Abas: Feed da Loja vs Minhas Avaliações */}
        <Tabs
          defaultValue="store"
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 rounded-[10px] bg-[#E2E8F0]/60 p-1">
            <TabsTrigger
              value="store"
              className="rounded-[8px] text-[13px] font-semibold data-[state=active]:bg-white data-[state=active]:text-[#0F172A] data-[state=active]:shadow-xs"
            >
              Feed da Loja ({reviews.length})
            </TabsTrigger>
            <TabsTrigger
              value="user"
              className="rounded-[8px] text-[13px] font-semibold data-[state=active]:bg-white data-[state=active]:text-[#0F172A] data-[state=active]:shadow-xs"
            >
              Minhas Avaliações
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Chips de Filtro Rápido */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setFilterChip("all")}
            className={`rounded-full px-3 py-1 font-semibold transition cursor-pointer ${
              filterChip === "all"
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => setFilterChip("photos")}
            className={`rounded-full px-3 py-1 font-semibold transition cursor-pointer flex items-center gap-1 ${
              filterChip === "photos"
                ? "bg-blue-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span>📸 Com Fotos</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterChip("stars5")}
            className={`rounded-full px-3 py-1 font-semibold transition cursor-pointer flex items-center gap-1 ${
              filterChip === "stars5"
                ? "bg-amber-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span>⭐ 5 Estrelas</span>
          </button>
        </div>

        {/* Lista de Avaliações */}
        <div className="flex flex-col gap-3">
          {loading && (
            <div className="flex flex-col gap-2.5 py-4">
              <div className="h-28 w-full animate-pulse rounded-2xl bg-slate-200/80" />
              <div className="h-28 w-full animate-pulse rounded-2xl bg-slate-200/80" />
            </div>
          )}

          {!loading && displayedReviews.length > 0 &&
            displayedReviews.map((item) => (
              <Card
                key={item.id}
                className="rounded-[14px] border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
              >
                <CardContent className="flex flex-col gap-2.5 p-0">
                  {/* Header do Autor */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-[34px] w-[34px] border border-slate-200 shrink-0">
                        {item.authorAvatar ? (
                          <AvatarImage
                            src={item.authorAvatar}
                            alt={item.authorName}
                          />
                        ) : null}
                        <AvatarFallback className="bg-[#DBEAFE] text-[#1D4ED8] text-xs font-bold">
                          {getAuthorInitials(item.authorName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[13px] font-semibold text-[#0F172A] truncate">
                            {item.authorName}
                          </span>
                          {!item.isAnonymous && (
                            <span className="text-[10px] font-bold text-[#15803D]" title="Cliente Verificado">
                              ✓
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#64748B]">
                          {formatReviewDate(item.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Estrelas */}
                    <div className="flex gap-0.5 shrink-0">
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
                      Avaliação enviada com nota sem comentário por escrito.
                    </p>
                  )}

                  {/* Fotos da Visita */}
                  {item.media && item.media.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto py-1">
                      {item.media.map((m) => (
                        <a
                          key={m.id}
                          href={m.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 hover:opacity-90 transition"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.url}
                            alt="Foto da visita"
                            className="h-full w-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Resposta do Lojista */}
                  {item.merchantReply && (
                    <div className="rounded-[10px] border border-blue-100 bg-blue-50/70 p-2.5 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-blue-900">
                        <span>Resposta de {storeDisplayName}</span>
                        {item.repliedAt && (
                          <span className="text-[10px] text-blue-700/80 font-normal">
                            {formatReviewDate(item.repliedAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] leading-relaxed text-blue-950">
                        {item.merchantReply}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

          {/* Empty States */}
          {!loading && displayedReviews.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-3">
              <div className="text-2xl">
                {activeTab === "user" ? "👤" : "💬"}
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800">
                  {activeTab === "user"
                    ? "Você ainda não avaliou este estabelecimento"
                    : filterChip !== "all"
                    ? "Nenhuma avaliação encontrada com este filtro"
                    : "Nenhuma avaliação registrada ainda"}
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  {activeTab === "user"
                    ? "Compartilhe sua experiência gastronômica ou de atendimento com outros clientes!"
                    : "Seja a primeira pessoa a avaliar e deixar suas impressões sobre o local."}
                </p>
              </div>

              <div className="pt-1">
                <Button
                  size="sm"
                  onClick={() => router.push(`/${slug}/evaluate`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs"
                >
                  Avaliar Agora
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
