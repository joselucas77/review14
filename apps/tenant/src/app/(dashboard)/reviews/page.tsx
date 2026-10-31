"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { getClientStoreUrl } from "@/lib/urls";

interface CustomAnswerItem {
  id: string;
  ratingValue: number | null;
  textValue: string | null;
  selectedItems: string[] | null;
  CustomField?: {
    id: string;
    label: string;
    fieldType: "RATING_5" | "SINGLE_SELECT" | "MULTI_SELECT" | "TEXT";
  } | null;
}

interface ReviewItem {
  id: string;
  customerName: string;
  customerAvatar: string | null;
  initials: string;
  timeAgo: string;
  createdAt: string;
  table: string;
  rating: number;
  comment: string;
  isPromoter: boolean;
  replied: boolean;
  replyText?: string | null;
  replyDate?: string | null;
  answers: CustomAnswerItem[];
  phone?: string;
}

interface CompanyData {
  id: string;
  tradeName: string;
  slug: string;
  minRatingForGoogle: number;
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return "Agora mesmo";
    if (diffMins < 60) return `Há ${diffMins} min`;
    if (diffHours < 24) {
      const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      return `Hoje às ${timeStr}`;
    }
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

function getInitials(name: string): string {
  if (!name) return "CL";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ReviewsPage() {
  const [company, setCompany] = React.useState<CompanyData | null>(null);
  const [reviews, setReviews] = React.useState<ReviewItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [search, setSearch] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"all" | "5star" | "4star" | "retained" | "unreplied">("all");
  const [sortBy, setSortBy] = React.useState<"recent" | "highest" | "lowest">("recent");
  const [replyingId, setReplyingId] = React.useState<string | null>(null);
  const [replyInput, setReplyInput] = React.useState("");
  const [isSavingReply, setIsSavingReply] = React.useState(false);
  const [copiedReviewId, setCopiedReviewId] = React.useState<string | null>(null);

  // Carrega empresa ativa e avaliações do Supabase
  const loadData = React.useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // 1. Busca a empresa do usuário
      const { data: comp } = await supabase
        .from("Company")
        .select("id, tradeName, slug, minRatingForGoogle")
        .eq("ownerId", user.id)
        .order("createdAt", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!comp) {
        setLoading(false);
        return;
      }

      setCompany(comp);

      // 2. Busca todas as avaliações da empresa com respostas customizadas
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
          companyId,
          isPublic,
          isResolved,
          merchantReply,
          repliedAt,
          createdAt,
          CustomAnswer (
            id,
            ratingValue,
            textValue,
            selectedItems,
            CustomField (
              id,
              label,
              fieldType
            )
          )
        `)
        .eq("companyId", comp.id)
        .order("createdAt", { ascending: false });

      if (revErr) {
        console.error("Erro ao carregar avaliações do Supabase:", revErr);
      } else if (revData) {
        const minRating = comp.minRatingForGoogle ?? 4;
        const mapped: ReviewItem[] = revData.map((r: any) => {
          const customerName = r.isAnonymous
            ? r.anonymousName || "Cliente Anônimo"
            : r.anonymousName || "Cliente Verificado";
          const isPromoter = (r.overallRating || 0) >= minRating;

          return {
            id: r.id,
            customerName,
            customerAvatar: r.anonymousAvatar || null,
            initials: getInitials(customerName),
            timeAgo: formatRelativeTime(r.createdAt),
            createdAt: r.createdAt,
            table: "Mesa / Salão",
            rating: Number(r.overallRating) || 5,
            comment: r.comment || "",
            isPromoter,
            replied: Boolean(r.merchantReply),
            replyText: r.merchantReply || null,
            replyDate: r.repliedAt ? formatRelativeTime(r.repliedAt) : null,
            answers: Array.isArray(r.CustomAnswer) ? r.CustomAnswer : [],
          };
        });

        setReviews(mapped);
      }
    } catch (err) {
      console.error("Erro inesperado ao carregar avaliações:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();

    // Inscrição em tempo real no Supabase para novas avaliações
    const supabase = createClient();
    const channel = supabase
      .channel("tenant_reviews_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "Review",
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  // Salvar resposta do lojista no Supabase
  const handleSendReply = async (reviewId: string) => {
    if (!replyInput.trim()) return;
    setIsSavingReply(true);

    try {
      const supabase = createClient();
      const replyText = replyInput.trim();
      const repliedAt = new Date().toISOString();

      const { error } = await supabase
        .from("Review")
        .update({
          merchantReply: replyText,
          repliedAt,
          isResolved: true,
          updatedAt: repliedAt,
        })
        .eq("id", reviewId);

      if (error) {
        alert("Erro ao salvar resposta: " + error.message);
        return;
      }

      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? {
                ...r,
                replied: true,
                replyText,
                replyDate: "Agora mesmo",
              }
            : r
        )
      );

      setReplyingId(null);
      setReplyInput("");
    } catch (err) {
      console.error("Erro ao enviar resposta:", err);
      alert("Ocorreu um erro ao salvar a resposta.");
    } finally {
      setIsSavingReply(false);
    }
  };

  // Sugestão com IA contextualizada com o nome da loja
  const handleAiSuggest = (review: ReviewItem) => {
    const storeName = company?.tradeName || "Nosso Estabelecimento";
    const firstName = review.customerName.split(" ")[0];

    if (review.rating >= 4) {
      setReplyInput(
        `Olá ${firstName}! Que alegria ler sua avaliação tão carinhosa sobre sua experiência na ${storeName}. Nossa equipe se dedica diariamente para oferecer o melhor atendimento e qualidade. Esperamos te receber novamente em breve!`
      );
    } else {
      setReplyInput(
        `Olá ${firstName}, lamentamos sinceramente por não termos superado suas expectativas desta vez. Na ${storeName}, prezamos muito pelo padrão do nosso serviço. Seus apontamentos já foram repassados diretamente à nossa gerência para os devidos ajustes. Gostaríamos muito de uma nova oportunidade para lhe proporcionar uma experiência impecável!`
      );
    }
  };

  const handleCopyReviewLink = (id: string) => {
    if (typeof window !== "undefined") {
      const storeSlug = company?.slug || "loja";
      const publicUrl = `${getClientStoreUrl(storeSlug)}/feed`;
      navigator.clipboard.writeText(publicUrl);
      setCopiedReviewId(id);
      setTimeout(() => setCopiedReviewId(null), 2000);
    }
  };

  const handleExportCsv = () => {
    const storeName = company?.tradeName || "estabelecimento";
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["ID,Cliente,Nota,Triagem,Data,Comentario,Resposta do Lojista,Respondido Em"]
        .concat(
          reviews.map(
            (r) =>
              `"${r.id}","${r.customerName}",${r.rating},"${
                r.isPromoter ? "Triado para Google" : "Retido na Ouvidoria"
              }","${r.createdAt}","${(r.comment || "").replace(/"/g, '""')}","${(
                r.replyText || ""
              ).replace(/"/g, '""')}","${r.replyDate || ""}"`
          )
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `avaliacoes-${company?.slug || "review14"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // KPIs calculados com dados reais do Supabase
  const totalCount = reviews.length;
  const promotersCount = reviews.filter((r) => r.isPromoter).length;
  const promoterRate = totalCount > 0 ? ((promotersCount / totalCount) * 100).toFixed(1) : "0.0";
  const retainedCount = reviews.filter((r) => !r.isPromoter).length;
  const retainedRate = totalCount > 0 ? ((retainedCount / totalCount) * 100).toFixed(1) : "0.0";
  const unrepliedCount = reviews.filter((r) => !r.replied).length;

  // Filtragem
  const filtered = reviews.filter((r) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = r.customerName.toLowerCase().includes(q);
      const matchComment = r.comment.toLowerCase().includes(q);
      const matchAnswers = r.answers.some(
        (a) =>
          a.CustomField?.label.toLowerCase().includes(q) ||
          a.textValue?.toLowerCase().includes(q) ||
          a.selectedItems?.some((item) => item.toLowerCase().includes(q))
      );
      if (!matchName && !matchComment && !matchAnswers) return false;
    }

    if (activeTab === "5star") return r.rating === 5;
    if (activeTab === "4star") return r.rating === 4;
    if (activeTab === "retained") return !r.isPromoter;
    if (activeTab === "unreplied") return !r.replied;
    return true;
  });

  // Ordenação
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "highest") return b.rating - a.rating;
    if (sortBy === "lowest") return a.rating - b.rating;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-6 p-6 md:p-8 select-none transition-colors duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-0 items-start sm:items-end justify-between w-full">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[24px] font-bold leading-[30px] tracking-tight text-[#0F172A] dark:text-[#F8FAFC] m-0">
              Gestão de Avaliações &amp; Ouvidoria
            </h1>
            <span className="rounded-full bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
              {company?.tradeName ? `${company.tradeName} • ` : ""}
              {totalCount} {totalCount === 1 ? "registro" : "registros"}
            </span>
          </div>
          <p className="text-[13px] leading-4 text-[#64748B] dark:text-[#94A3B8] m-0">
            Acompanhe em tempo real as avaliações dos clientes, respostas e triagem automática para o Google Maps.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <a
            href={getClientStoreUrl(company?.slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#111827] px-3.5 py-2 text-[13px] font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-slate-50 dark:hover:bg-[#1F2937] transition-colors shadow-xs"
          >
            <span>📱 Abrir Avaliação do Cliente</span>
          </a>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={reviews.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 px-3.5 py-2 text-[13px] font-medium text-white transition-colors cursor-pointer shadow-xs"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Mini KPI Cards (Dados Reais) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {/* Total */}
        <div className="flex flex-col gap-1 rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            Total de Avaliações
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-[24px] font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              {loading ? "..." : totalCount}
            </span>
            <span className="text-[11px] text-[#15803D] dark:text-emerald-400 font-semibold">
              tempo real
            </span>
          </div>
        </div>

        {/* Triado para Google */}
        <div className="flex flex-col gap-1 rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              Triadas para o Google
            </span>
            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-[#15803D] dark:text-emerald-300 font-bold px-1.5 py-0.2 rounded">
              {promoterRate}%
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[24px] font-bold text-emerald-600 dark:text-emerald-400">
              {loading ? "..." : promotersCount}
            </span>
            <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">4 e 5 Estrelas</span>
          </div>
        </div>

        {/* Retido na Ouvidoria */}
        <div className="flex flex-col gap-1 rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              Retidos na Ouvidoria
            </span>
            <span className="text-[10px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold px-1.5 py-0.2 rounded">
              {retainedRate}%
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[24px] font-bold text-amber-600 dark:text-amber-400">
              {loading ? "..." : retainedCount}
            </span>
            <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">Protegidos do Google</span>
          </div>
        </div>

        {/* Aguardando Resposta */}
        <div className="flex flex-col gap-1 rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-4 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            Aguardando Resposta
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-[24px] font-bold text-[#2563EB] dark:text-blue-400">
              {loading ? "..." : unrepliedCount}
            </span>
            <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              {unrepliedCount === 0 ? "Todas respondidas" : "Pendentes"}
            </span>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-3.5 shadow-xs transition-colors">
        {/* Search Input */}
        <div className="flex items-center gap-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#1F2937] px-3 py-1.5 w-full md:w-80">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por cliente ou comentário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-[13px] leading-4 text-[#0F172A] dark:text-[#F8FAFC] placeholder-slate-400 outline-none"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors cursor-pointer ${
              activeTab === "all"
                ? "bg-[#2563EB] text-white"
                : "text-[#475569] dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-[#1F2937]"
            }`}
          >
            Todas ({reviews.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("5star")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors cursor-pointer ${
              activeTab === "5star"
                ? "bg-[#2563EB] text-white"
                : "text-[#475569] dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-[#1F2937]"
            }`}
          >
            <span>5 Estrelas ({reviews.filter((r) => r.rating === 5).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("4star")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors cursor-pointer ${
              activeTab === "4star"
                ? "bg-[#2563EB] text-white"
                : "text-[#475569] dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-[#1F2937]"
            }`}
          >
            <span>4 Estrelas ({reviews.filter((r) => r.rating === 4).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("retained")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors cursor-pointer ${
              activeTab === "retained"
                ? "bg-amber-600 text-white"
                : "text-amber-700 dark:text-amber-400 bg-amber-50/70 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Ouvidoria Retida (&lt;4★) ({retainedCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("unreplied")}
            className={`rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors cursor-pointer ${
              activeTab === "unreplied"
                ? "bg-[#2563EB] text-white"
                : "text-[#475569] dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-[#1F2937]"
            }`}
          >
            Não respondidas ({unrepliedCount})
          </button>
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 self-end md:self-auto">
          <span>Ordenar:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-md border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#111827] px-2 py-1 text-xs text-[#0F172A] dark:text-[#F8FAFC] outline-none cursor-pointer"
          >
            <option value="recent">Mais Recentes</option>
            <option value="highest">Maior Nota</option>
            <option value="lowest">Menor Nota</option>
          </select>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-36 rounded-xl border border-slate-200 dark:border-[#1F2937] bg-white dark:bg-[#111827] p-5 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Reviews Feed List */}
      {!loading && (
        <div className="space-y-4">
          {sorted.map((rev) => (
            <div
              key={rev.id}
              className={`flex flex-col gap-3.5 rounded-xl border p-5 shadow-xs transition-all duration-200 ${
                !rev.isPromoter
                  ? "border-amber-200/90 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10"
                  : "border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827]"
              }`}
            >
              {/* Header: Customer Info + Rating + Routing Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-3">
                  {rev.customerAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={rev.customerAvatar}
                      alt={rev.customerName}
                      className="h-10 w-10 rounded-full object-cover border border-slate-200 dark:border-[#334155]"
                    />
                  ) : (
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                        !rev.isPromoter
                          ? "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200"
                          : "bg-[#DBEAFE] dark:bg-blue-950/70 text-[#1D4ED8] dark:text-blue-300"
                      }`}
                    >
                      {rev.initials}
                    </div>
                  )}

                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        {rev.customerName}
                      </span>
                      <span className="rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 text-[10px] font-semibold px-1.5 py-0.2">
                        Verificado
                      </span>
                    </div>
                    <span className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">
                      {rev.timeAgo}
                    </span>
                  </div>
                </div>

                {/* Rating + Routing status */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Star visual */}
                  <div className="flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 px-2.5 py-1">
                    <div className="flex items-center gap-0.5 text-amber-500">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s} className={s <= rev.rating ? "text-amber-500" : "text-slate-300"}>
                          ★
                        </span>
                      ))}
                    </div>
                    <span className="text-[13px] font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                      {rev.rating.toFixed(1)}
                    </span>
                  </div>

                  {/* Routing Badge */}
                  {rev.isPromoter ? (
                    <div className="flex items-center gap-1.5 rounded-full bg-emerald-100/90 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/40 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Triado p/ Google Maps</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 rounded-full bg-amber-100/90 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/40 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <span>Retido na Ouvidoria (Privado)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Comment Body */}
              {rev.comment ? (
                <p className="text-[14px] leading-[22px] text-[#0F172A] dark:text-[#E2E8F0] m-0 font-normal">
                  &ldquo;{rev.comment}&rdquo;
                </p>
              ) : (
                <p className="text-[13px] italic text-slate-400 m-0">
                  (Cliente avaliou sem comentário escrito)
                </p>
              )}

              {/* Custom Answers Breakdown (Perguntas Específicas) */}
              {rev.answers && rev.answers.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  {rev.answers.map((ans) => {
                    const label = ans.CustomField?.label || "Questão";

                    if (ans.ratingValue !== null) {
                      return (
                        <div
                          key={ans.id}
                          className="flex items-center gap-1 rounded-md bg-slate-100 dark:bg-[#1F2937] px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800"
                        >
                          <span className="font-semibold">{label}:</span>
                          <span className="text-amber-500 font-bold">{"★".repeat(ans.ratingValue)}</span>
                          <span className="text-slate-400">({ans.ratingValue}/5)</span>
                        </div>
                      );
                    }

                    if (ans.selectedItems && ans.selectedItems.length > 0) {
                      return (
                        <div
                          key={ans.id}
                          className="flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 text-xs text-blue-800 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/40"
                        >
                          <span className="font-semibold">{label}:</span>
                          <span>{ans.selectedItems.join(", ")}</span>
                        </div>
                      );
                    }

                    if (ans.textValue) {
                      return (
                        <div
                          key={ans.id}
                          className="flex items-center gap-1 rounded-md bg-slate-100 dark:bg-[#1F2937] px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800"
                        >
                          <span className="font-semibold">{label}:</span>
                          <span>&ldquo;{ans.textValue}&rdquo;</span>
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>
              )}

              {/* Existing Reply Display */}
              {rev.replied && rev.replyText && (
                <div className="mt-1 rounded-lg border border-slate-200/90 dark:border-[#334155] bg-slate-50 dark:bg-[#1F2937]/50 p-3.5 text-xs space-y-1">
                  <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-100">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                      <span>Resposta de {company?.tradeName || "Você"}:</span>
                    </div>
                    {rev.replyDate && (
                      <span className="text-[11px] font-normal text-slate-400">{rev.replyDate}</span>
                    )}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[13px] leading-5 m-0">
                    {rev.replyText}
                  </p>
                </div>
              )}

              {/* Interactive Reply Area or Action Bar */}
              {replyingId === rev.id ? (
                <div className="mt-2 space-y-2.5 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 p-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Escreva a resposta oficial para {rev.customerName}:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAiSuggest(rev)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      ✨ Sugerir com IA
                    </button>
                  </div>

                  <textarea
                    rows={3}
                    placeholder="Escreva sua resposta cordial e personalizada..."
                    value={replyInput}
                    onChange={(e) => setReplyInput(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-[#334155] bg-white dark:bg-[#111827] p-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={isSavingReply}
                      onClick={() => {
                        setReplyingId(null);
                        setReplyInput("");
                      }}
                      className="rounded-md px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-[#1F2937]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={isSavingReply || !replyInput.trim()}
                      onClick={() => handleSendReply(rev.id)}
                      className="rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs"
                    >
                      {isSavingReply ? "Salvando..." : "Salvar Resposta"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#1F2937] text-xs">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleCopyReviewLink(rev.id)}
                      className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {copiedReviewId === rev.id ? "✓ Link copiado" : "Compartilhar página de feed"}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setReplyingId(rev.id);
                      setReplyInput(rev.replyText || "");
                    }}
                    className="rounded-md border border-[#DBEAFE] dark:border-blue-900/40 bg-[#EFF6FF] dark:bg-blue-950/40 px-3 py-1 text-[12px] font-semibold text-[#2563EB] dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors cursor-pointer"
                  >
                    {rev.replied ? "Editar Resposta" : "Responder ao Cliente"}
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Empty State */}
          {sorted.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-[#334155] bg-white dark:bg-[#111827] p-12 text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-3xl">
                ⭐
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {search ? "Nenhum resultado para a busca" : "Nenhuma avaliação recebida ainda"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                  {search
                    ? "Tente buscar por outro termo ou limpe os filtros."
                    : "Assim que seus clientes escanearem o QR Code ou responderem ao formulário de avaliação, os feedbacks e respostas aparecerão aqui em tempo real."}
                </p>
              </div>

              {!search && (
                <div className="flex items-center gap-3 pt-2">
                  <a
                    href="/qrcode"
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-xs"
                  >
                    Ver e Imprimir QR Codes
                  </a>
                  <a
                    href={getClientStoreUrl(company?.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-slate-300 dark:border-[#334155] px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1F2937]"
                  >
                    Testar Avaliação como Cliente →
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
