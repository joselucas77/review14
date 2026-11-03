"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@ui/components/card";
import { Badge } from "@ui/components/badge";
import { Button } from "@ui/components/button";
import { Avatar, AvatarFallback, AvatarImage } from "@ui/components/avatar";
import { createClient } from "@/lib/supabase/client";

interface CustomerReviewItem {
  id: string;
  storeName: string;
  storeSlug: string;
  logoUrl?: string | null;
  rating: number;
  date: string;
  comment: string;
  photos: string[];
  merchantReply?: string | null;
  repliedAt?: string | null;
}

interface UserProfile {
  id: string;
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  memberSince: string;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

function formatMemberSince(dateString?: string): string {
  if (!dateString) return "Membro recente";
  try {
    const date = new Date(dateString);
    const month = date.toLocaleDateString("pt-BR", { month: "long" });
    const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);
    const year = date.getFullYear();
    return `Membro desde ${capitalizedMonth} de ${year}`;
  } catch {
    return "Membro recente";
  }
}

function getInitials(name: string): string {
  if (!name) return "CL";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function MyReviewsPage() {
  const router = useRouter();
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [reviews, setReviews] = React.useState<CustomerReviewItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadUserReviews() {
      try {
        setLoading(true);
        const supabase = createClient();

        // 1. Obtém sessão do usuário autenticado no Supabase
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          // Tenta verificar se há dados na sessão local temporária
          const stored =
            typeof window !== "undefined"
              ? sessionStorage.getItem("review_auth")
              : null;
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              if (parsed.userId) {
                setProfile({
                  id: parsed.userId,
                  name: parsed.name || "Cliente Verificado",
                  email: parsed.email || null,
                  avatarUrl: parsed.avatarUrl || null,
                  memberSince: "Membro recente",
                });
                await fetchReviewsForUserId(supabase, parsed.userId);
                return;
              }
            } catch {}
          }
          setProfile(null);
          return;
        }

        const name =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "Cliente Verificado";
        const avatarUrl =
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          null;

        setProfile({
          id: user.id,
          name,
          email: user.email,
          avatarUrl,
          memberSince: formatMemberSince(user.created_at),
        });

        await fetchReviewsForUserId(supabase, user.id);
      } catch (err) {
        console.error("Erro ao carregar histórico do cliente:", err);
      } finally {
        setLoading(false);
      }
    }

    async function fetchReviewsForUserId(supabase: any, userId: string) {
      const { data, error } = await supabase
        .from("Review")
        .select(`
          id,
          overallRating,
          comment,
          createdAt,
          merchantReply,
          repliedAt,
          company:Company (
            id,
            tradeName,
            slug,
            logoUrl
          ),
          ReviewMedia (
            id,
            url
          )
        `)
        .eq("userId", userId)
        .order("createdAt", { ascending: false });

      if (error) {
        console.warn("Erro ao buscar avaliações do usuário:", error);
        return;
      }

      if (data) {
        const mapped: CustomerReviewItem[] = data.map((r: any) => ({
          id: r.id,
          storeName: r.company?.tradeName || "Estabelecimento",
          storeSlug: r.company?.slug || "",
          logoUrl: r.company?.logoUrl || null,
          rating: Number(r.overallRating) || 5,
          date: formatDate(r.createdAt),
          comment: r.comment || "",
          photos: Array.isArray(r.ReviewMedia)
            ? r.ReviewMedia.map((m: any) => m.url).filter(Boolean)
            : [],
          merchantReply: r.merchantReply || null,
          repliedAt: r.repliedAt ? formatDate(r.repliedAt) : null,
        }));
        setReviews(mapped);
      }
    }

    loadUserReviews();
  }, []);

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("review_auth");
      }
      setProfile(null);
      setReviews([]);
      router.push("/login");
    } catch (err) {
      console.warn("Erro ao deslogar:", err);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F8FAFC] text-[#0F172A] antialiased">
      <div className="mx-auto flex w-full max-w-[390px] flex-col gap-3.5 px-4 py-6">
        {loading ? (
          // Loading Skeleton
          <div className="flex flex-col gap-3">
            <div className="h-28 w-full animate-pulse rounded-2xl bg-slate-200/80" />
            <div className="h-40 w-full animate-pulse rounded-2xl bg-slate-200/80" />
            <div className="h-40 w-full animate-pulse rounded-2xl bg-slate-200/80" />
          </div>
        ) : !profile ? (
          // Estado Não Autenticado
          <Card className="rounded-[16px] border-[#E2E8F0] bg-white p-6 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#0F172A]">
                Você ainda não está conectado
              </h2>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Conecte-se com sua conta para visualizar seu histórico pessoal de avaliações em todos os restaurantes e lojas.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                type="button"
                fullWidth
                onClick={() => router.push("/login")}
                className="font-semibold shadow-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                Fazer Login na Conta
              </Button>
              <Button
                type="button"
                variant="outline"
                fullWidth
                onClick={() => router.push("/")}
                className="text-xs font-semibold border-slate-300"
              >
                Explorar Lojas para Avaliar
              </Button>
            </div>
          </Card>
        ) : (
          // Perfil do Cliente Autenticado
          <>
            <Card className="rounded-[14px] border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <CardContent className="flex flex-col gap-3 p-0">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[#64748B]">
                    Meu Perfil de Avaliador
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="brand">
                      {reviews.length} {reviews.length === 1 ? "AVALIAÇÃO" : "AVALIAÇÕES"}
                    </Badge>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="text-[11px] text-slate-400 hover:text-slate-700 underline cursor-pointer"
                    >
                      Sair
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11 border border-slate-200">
                    {profile.avatarUrl ? (
                      <AvatarImage src={profile.avatarUrl} alt={profile.name} />
                    ) : null}
                    <AvatarFallback className="bg-[#DBEAFE] text-[14px] font-bold text-[#1D4ED8]">
                      {getInitials(profile.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <h1 className="text-[16px] font-bold text-[#0F172A] truncate">
                      {profile.name}
                    </h1>
                    <span className="text-[12px] text-[#64748B]">
                      {profile.memberSince}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Avaliações Reais */}
            {reviews.length > 0 ? (
              <div className="flex flex-col gap-3">
                {reviews.map((item) => (
                  <Card
                    key={item.id}
                    className="rounded-[14px] border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-2.5"
                  >
                    <CardContent className="flex flex-col gap-2.5 p-0">
                      <div className="flex items-center justify-between">
                        <Link
                          href={item.storeSlug ? `/${item.storeSlug}/feed` : "#"}
                          className="flex items-center gap-2 text-[14px] font-bold text-[#0F172A] hover:text-[#2563EB] transition"
                        >
                          {item.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.logoUrl}
                              alt={item.storeName}
                              className="h-5 w-5 rounded object-cover border border-slate-200"
                            />
                          ) : null}
                          <span className="truncate">{item.storeName}</span>
                        </Link>
                        <div className="flex gap-0.5 shrink-0">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <svg
                              key={star}
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill={star <= item.rating ? "#F59E0B" : "none"}
                              stroke={star <= item.rating ? "#F59E0B" : "#CBD5E1"}
                              strokeWidth="1.5"
                            >
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          ))}
                        </div>
                      </div>

                      <span className="text-[11px] text-[#64748B]">{item.date}</span>

                      {item.comment ? (
                        <p className="text-[13px] leading-relaxed text-[#0F172A]">
                          "{item.comment}"
                        </p>
                      ) : (
                        <p className="text-[12px] italic text-[#94A3B8]">
                          Avaliação enviada com nota sem comentário adicional.
                        </p>
                      )}

                      {/* Fotos enviadas */}
                      {item.photos && item.photos.length > 0 && (
                        <div className="flex gap-2 pt-0.5 overflow-x-auto pb-1">
                          {item.photos.map((photoUrl, pIdx) => (
                            <div
                              key={pIdx}
                              className="h-[60px] w-[60px] shrink-0 overflow-hidden rounded-[8px] border border-[#CBD5E1] bg-slate-100"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photoUrl}
                                alt="Foto enviada na avaliação"
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Resposta Oficial do Lojista */}
                      {item.merchantReply && (
                        <div className="mt-1 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-left space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold text-blue-900">
                            <span>Resposta oficial de {item.storeName}</span>
                            {item.repliedAt && (
                              <span className="text-[10px] text-blue-700/80 font-normal">
                                {item.repliedAt}
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
              </div>
            ) : (
              // Empty State com Usuário Logado
              <Card className="rounded-[16px] border border-dashed border-slate-300 bg-white p-8 text-center shadow-xs space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-2xl">
                  ⭐
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-[#0F172A]">
                    Você ainda não avaliou nenhuma loja
                  </h3>
                  <p className="text-xs text-[#64748B] leading-relaxed">
                    Assim que escanear um QR Code ou avaliar um estabelecimento parceiro, suas avaliações e fotos ficarão salvas aqui.
                  </p>
                </div>
                <div className="pt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => router.push("/")}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs"
                  >
                    Ver Lojas Disponíveis
                  </Button>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
