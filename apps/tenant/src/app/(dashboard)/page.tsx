"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getClientStoreUrl } from "@/lib/urls";
import { toast } from "@saas/ui/components/sonner";

interface Review {
  id: string;
  customerName: string;
  customerAvatar?: string | null;
  initials: string;
  timeAgo: string;
  createdAt: string;
  table: string;
  rating: number;
  comment: string;
  replied?: boolean;
  replyText?: string | null;
  replyDate?: string | null;
  isPromoter: boolean;
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

const DATE_OPTIONS = [
  "Tempo Todo",
  "Hoje",
  "Últimos 7 dias",
  "Últimos 30 dias",
  "Este Mês",
];

export default function TenantDashboardPage() {
  const [company, setCompany] = React.useState<CompanyData | null>(null);
  const [reviewsList, setReviewsList] = React.useState<Review[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [activeFilter, setActiveFilter] = React.useState<"all" | "5star" | "4star" | "retained" | "unreplied">("all");
  const [dateRange, setDateRange] = React.useState("Tempo Todo");
  const [dateMenuOpen, setDateMenuOpen] = React.useState(false);
  const [replyingToId, setReplyingToId] = React.useState<string | null>(null);
  const [replyInput, setReplyInput] = React.useState("");
  const [isSavingReply, setIsSavingReply] = React.useState(false);

  // Carrega empresa e avaliações reais do Supabase
  const loadData = React.useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // 1. Busca a empresa do usuário logado
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

      // 2. Busca as avaliações reais
      const { data: revs, error } = await supabase
        .from("Review")
        .select(`
          id,
          overallRating,
          comment,
          isAnonymous,
          anonymousName,
          anonymousAvatar,
          merchantReply,
          repliedAt,
          createdAt
        `)
        .eq("companyId", comp.id)
        .order("createdAt", { ascending: false });

      if (!error && revs) {
        const minRating = comp.minRatingForGoogle ?? 4;
        const mapped: Review[] = revs.map((r: any) => {
          const name = r.isAnonymous
            ? r.anonymousName || "Cliente Anônimo"
            : r.anonymousName || "Cliente Verificado";
          return {
            id: r.id,
            customerName: name,
            customerAvatar: r.anonymousAvatar || null,
            initials: getInitials(name),
            timeAgo: formatRelativeTime(r.createdAt),
            createdAt: r.createdAt,
            table: "Mesa / Salão",
            rating: Number(r.overallRating) || 5,
            comment: r.comment || "",
            replied: Boolean(r.merchantReply),
            replyText: r.merchantReply || null,
            replyDate: r.repliedAt ? formatRelativeTime(r.repliedAt) : null,
            isPromoter: (Number(r.overallRating) || 5) >= minRating,
          };
        });
        setReviewsList(mapped);
      }
    } catch (err) {
      console.error("Erro ao carregar dados do dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();

    // Inscrição em tempo real para novas avaliações no Supabase
    const supabase = createClient();
    const channel = supabase
      .channel("dashboard_reviews_realtime")
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

  const handleSendReply = async (reviewId: string) => {
    if (!replyInput.trim()) return;
    setIsSavingReply(true);

    try {
      const supabase = createClient();
      const text = replyInput.trim();
      const repliedAt = new Date().toISOString();

      const { error } = await supabase
        .from("Review")
        .update({
          merchantReply: text,
          repliedAt,
          isResolved: true,
          updatedAt: repliedAt,
        })
        .eq("id", reviewId);

      if (error) {
        toast.error("Erro ao responder avaliação: " + error.message);
        return;
      }

      toast.success("Resposta enviada com sucesso!");

      setReviewsList((prev) =>
        prev.map((r) =>
          r.id === reviewId ? { ...r, replied: true, replyText: text, replyDate: "Agora mesmo" } : r
        )
      );
      setReplyingToId(null);
      setReplyInput("");
    } catch (err) {
      console.error("Erro ao salvar resposta:", err);
      toast.error("Ocorreu um erro ao salvar a resposta.");
    } finally {
      setIsSavingReply(false);
    }
  };

  const handleExportReport = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["ID,Cliente,Nota,Comentario,Data,Respondido,Resposta"]
        .concat(
          reviewsList.map(
            (r) =>
              `"${r.id}","${r.customerName}",${r.rating},"${(r.comment || "").replace(/"/g, '""')}","${r.createdAt}","${
                r.replied ? "Sim" : "Nao"
              }","${(r.replyText || "").replace(/"/g, '""')}"`
          )
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio-avaliacoes-${company?.slug || "review14"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Filtragem por Período de Data
  const dateFilteredReviews = React.useMemo(() => {
    if (dateRange === "Tempo Todo") return reviewsList;

    const now = new Date();
    return reviewsList.filter((r) => {
      const itemDate = new Date(r.createdAt);
      if (dateRange === "Hoje") {
        return itemDate.toDateString() === now.toDateString();
      }
      if (dateRange === "Últimos 7 dias") {
        return now.getTime() - itemDate.getTime() <= 7 * 24 * 60 * 60 * 1000;
      }
      if (dateRange === "Últimos 30 dias") {
        return now.getTime() - itemDate.getTime() <= 30 * 24 * 60 * 60 * 1000;
      }
      if (dateRange === "Este Mês") {
        return (
          itemDate.getMonth() === now.getMonth() &&
          itemDate.getFullYear() === now.getFullYear()
        );
      }
      return true;
    });
  }, [reviewsList, dateRange]);

  // KPIs calculados sobre o período selecionado
  const totalReviews = dateFilteredReviews.length;
  const avgRating =
    totalReviews > 0
      ? (dateFilteredReviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1)
      : "5.0";
  const promoterCount = dateFilteredReviews.filter((r) => r.isPromoter).length;
  const satisfactionRate =
    totalReviews > 0 ? ((promoterCount / totalReviews) * 100).toFixed(1) : "100.0";
  const unrepliedCount = dateFilteredReviews.filter((r) => !r.replied).length;
  const replyRate =
    totalReviews > 0
      ? (((totalReviews - unrepliedCount) / totalReviews) * 100).toFixed(1)
      : "100.0";

  // Distribuição de notas no período
  const count5 = dateFilteredReviews.filter((r) => r.rating === 5).length;
  const count4 = dateFilteredReviews.filter((r) => r.rating === 4).length;
  const count3 = dateFilteredReviews.filter((r) => r.rating === 3).length;
  const count2 = dateFilteredReviews.filter((r) => r.rating === 2).length;
  const count1 = dateFilteredReviews.filter((r) => r.rating === 1).length;
  const countRetained = count3 + count2 + count1;

  const pct = (cnt: number) => (totalReviews > 0 ? `${(cnt / totalReviews) * 100}%` : "0%");

  // Filtragem por Tab ativa
  const filteredReviews = dateFilteredReviews.filter((rev) => {
    if (activeFilter === "5star") return rev.rating === 5;
    if (activeFilter === "4star") return rev.rating === 4;
    if (activeFilter === "retained") return rev.rating < (company?.minRatingForGoogle ?? 4);
    if (activeFilter === "unreplied") return !rev.replied;
    return true;
  });

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-6 p-6 md:p-8 select-none transition-colors duration-200">
      {/* Banner se a loja ainda não estiver configurada */}
      {!loading && !company && (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-5 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏪</span>
            <div>
              <h3 className="font-bold text-sm">Configure seu Estabelecimento</h3>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Você ainda não configurou o perfil da sua loja. Cadastre seu nome e link para ativar os QR Codes e receber avaliações.
              </p>
            </div>
          </div>
          <Link
            href="/settings"
            className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 text-xs font-bold transition shadow-xs shrink-0"
          >
            Configurar Loja Agora →
          </Link>
        </div>
      )}

      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-0 items-start sm:items-end justify-between w-full">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[24px] font-bold leading-[30px] tracking-tight text-[#0F172A] dark:text-[#F8FAFC] m-0">
              Desempenho &amp; Avaliações
            </h1>
            <div className="rounded-full bg-[#DCFCE7] dark:bg-emerald-950/50 border border-transparent dark:border-emerald-800/40 px-2.5 py-0.5">
              <span className="text-[11px] font-semibold leading-3.5 text-[#15803D] dark:text-emerald-400">
                ● {satisfactionRate}% de satisfação
              </span>
            </div>
          </div>
          <p className="text-[13px] leading-4 text-[#64748B] dark:text-[#94A3B8] m-0">
            Monitoramento em tempo real das experiências dos clientes de{" "}
            <strong>{company?.tradeName || "sua loja"}</strong>
          </p>
        </div>

        {/* Date Selector & Export Button */}
        <div className="flex items-center gap-2.5 relative flex-wrap sm:flex-nowrap">
          {/* Seletor Visual de Datas */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setDateMenuOpen(!dateMenuOpen)}
              className="flex items-center gap-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#111827] px-3.5 py-2 text-[13px] font-semibold text-[#0F172A] dark:text-[#F8FAFC] hover:bg-slate-50 dark:hover:bg-[#1F2937] transition-colors shadow-xs cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{dateRange}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {dateMenuOpen && (
              <div className="absolute right-0 top-11 z-50 w-44 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-1 shadow-xl animate-in fade-in duration-150">
                {DATE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setDateRange(opt);
                      setDateMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                      dateRange === opt
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-bold"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>

          <a
            href={getClientStoreUrl(company?.slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#111827] px-3.5 py-2 text-[13px] font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-slate-50 dark:hover:bg-[#1F2937] transition-colors shadow-xs"
          >
            <span>📱 Testar Avaliação</span>
          </a>

          {/* Export Report Button */}
          <button
            type="button"
            onClick={handleExportReport}
            disabled={totalReviews === 0}
            className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 px-4 py-2 text-[13px] font-semibold leading-4 text-white shadow-xs transition-colors cursor-pointer active:scale-[0.98]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" fill="none" stroke="#FFFFFF" strokeWidth="2" />
              <polyline points="7 10 12 15 17 10" fill="none" stroke="#FFFFFF" strokeWidth="2" />
              <line x1="12" y1="15" x2="12" y2="3" stroke="#FFFFFF" strokeWidth="2" />
            </svg>
            <span>Exportar Relatório</span>
          </button>
        </div>
      </div>

      {/* 4 Metric Cards (Reais calculados por período) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {/* Card 1: Nota Média */}
        <div className="flex flex-col gap-2 rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-[18px] shadow-xs transition-colors duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium leading-4 text-[#64748B] dark:text-[#94A3B8]">
              Nota Média
            </span>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#FFFBEB] dark:bg-amber-950/40">
              <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                <polygon
                  points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                  fill="#F59E0B"
                  stroke="#F59E0B"
                />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[26px] font-bold leading-8 text-[#0F172A] dark:text-[#F8FAFC]">
              {loading ? "..." : avgRating}
            </span>
            <span className="text-[13px] leading-4 text-[#64748B] dark:text-[#94A3B8]">
              / 5.0
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="rounded bg-[#F0FDF4] dark:bg-emerald-950/40 px-1.5 py-0.5">
              <span className="text-[11px] font-semibold leading-3.5 text-[#15803D] dark:text-emerald-400">
                Período: {dateRange}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Total de Avaliações */}
        <div className="flex flex-col gap-2 rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-[18px] shadow-xs transition-colors duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium leading-4 text-[#64748B] dark:text-[#94A3B8]">
              Total de Avaliações
            </span>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#EFF6FF] dark:bg-blue-950/40">
              <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="none" stroke="#2563EB" strokeWidth="2" className="dark:stroke-blue-400" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[26px] font-bold leading-8 text-[#0F172A] dark:text-[#F8FAFC]">
              {loading ? "..." : totalReviews}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] leading-3.5 text-[#64748B] dark:text-[#94A3B8]">
              {totalReviews === 1 ? "1 avaliação coletada" : `${totalReviews} avaliações coletadas`}
            </span>
          </div>
        </div>

        {/* Card 3: Taxa de Resposta */}
        <div className="flex flex-col gap-2 rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-[18px] shadow-xs transition-colors duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium leading-4 text-[#64748B] dark:text-[#94A3B8]">
              Taxa de Resposta
            </span>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#F0FDF4] dark:bg-emerald-950/40">
              <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                <polyline points="20 6 9 17 4 12" fill="none" stroke="#15803D" strokeWidth="2" className="dark:stroke-emerald-400" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[26px] font-bold leading-8 text-[#0F172A] dark:text-[#F8FAFC]">
              {loading ? "..." : `${replyRate}%`}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold leading-3.5 text-[#15803D] dark:text-emerald-400">
              {unrepliedCount === 0 ? "Tudo respondido" : `${unrepliedCount} pendente(s)`}
            </span>
          </div>
        </div>

        {/* Card 4: Promotores Google */}
        <div className="flex flex-col gap-2 rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-[18px] shadow-xs transition-colors duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium leading-4 text-[#64748B] dark:text-[#94A3B8]">
              Triadas para o Google
            </span>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#EFF6FF] dark:bg-blue-950/40">
              <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                <circle cx="12" cy="12" r="10" fill="none" stroke="#2563EB" strokeWidth="2" className="dark:stroke-blue-400" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" fill="none" stroke="#2563EB" strokeWidth="2" className="dark:stroke-blue-400" />
                <line x1="9" y1="9" x2="9.01" y2="9" stroke="#2563EB" strokeWidth="2" className="dark:stroke-blue-400" />
                <line x1="15" y1="9" x2="15.01" y2="9" stroke="#2563EB" strokeWidth="2" className="dark:stroke-blue-400" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[26px] font-bold leading-8 text-[#2563EB] dark:text-blue-400">
              {loading ? "..." : promoterCount}
            </span>
            <span className="text-[13px] text-slate-400">({satisfactionRate}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="rounded bg-[#DBEAFE] dark:bg-blue-950/60 px-1.5 py-0.5">
              <span className="text-[11px] font-semibold leading-3.5 text-[#1D4ED8] dark:text-blue-300">
                4★ e 5★ no Google Maps
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Section: Left (Distribution) & Right (Review Filter & Feed) */}
      <div className="flex flex-col lg:flex-row gap-5 items-start w-full">
        {/* Left Column: Distribuição das Notas Reais */}
        <div className="flex flex-col gap-3.5 rounded-[14px] border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-5 shadow-xs w-full lg:w-[340px] shrink-0 transition-colors duration-200">
          <span className="text-[15px] font-semibold leading-[18px] text-[#0F172A] dark:text-[#F8FAFC]">
            Distribuição das Notas
          </span>

          <div className="flex flex-col gap-2">
            {/* 5 Stars */}
            <div className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-[12px] font-semibold leading-4 text-[#0F172A] dark:text-[#F8FAFC]">
                5★
              </span>
              <div className="flex h-2 flex-1 rounded-full bg-[#F1F5F9] dark:bg-[#1F2937] overflow-hidden">
                <div className="h-full rounded-full bg-[#F59E0B]" style={{ width: pct(count5) }} />
              </div>
              <span className="w-11 shrink-0 text-right text-[12px] leading-4 text-[#64748B] dark:text-[#94A3B8]">
                {count5}
              </span>
            </div>

            {/* 4 Stars */}
            <div className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-[12px] font-semibold leading-4 text-[#0F172A] dark:text-[#F8FAFC]">
                4★
              </span>
              <div className="flex h-2 flex-1 rounded-full bg-[#F1F5F9] dark:bg-[#1F2937] overflow-hidden">
                <div className="h-full rounded-full bg-[#F59E0B]" style={{ width: pct(count4) }} />
              </div>
              <span className="w-11 shrink-0 text-right text-[12px] leading-4 text-[#64748B] dark:text-[#94A3B8]">
                {count4}
              </span>
            </div>

            {/* 3 Stars */}
            <div className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-[12px] font-semibold leading-4 text-[#0F172A] dark:text-[#F8FAFC]">
                3★
              </span>
              <div className="flex h-2 flex-1 rounded-full bg-[#F1F5F9] dark:bg-[#1F2937] overflow-hidden">
                <div className="h-full rounded-full bg-[#F59E0B]" style={{ width: pct(count3) }} />
              </div>
              <span className="w-11 shrink-0 text-right text-[12px] leading-4 text-[#64748B] dark:text-[#94A3B8]">
                {count3}
              </span>
            </div>

            {/* 2 Stars */}
            <div className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-[12px] font-semibold leading-4 text-[#0F172A] dark:text-[#F8FAFC]">
                2★
              </span>
              <div className="flex h-2 flex-1 rounded-full bg-[#F1F5F9] dark:bg-[#1F2937] overflow-hidden">
                <div className="h-full rounded-full bg-[#CBD5E1] dark:bg-[#475569]" style={{ width: pct(count2) }} />
              </div>
              <span className="w-11 shrink-0 text-right text-[12px] leading-4 text-[#64748B] dark:text-[#94A3B8]">
                {count2}
              </span>
            </div>

            {/* 1 Star */}
            <div className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-[12px] font-semibold leading-4 text-[#0F172A] dark:text-[#F8FAFC]">
                1★
              </span>
              <div className="flex h-2 flex-1 rounded-full bg-[#F1F5F9] dark:bg-[#1F2937] overflow-hidden">
                <div className="h-full rounded-full bg-[#DC2626]" style={{ width: pct(count1) }} />
              </div>
              <span className="w-11 shrink-0 text-right text-[12px] leading-4 text-[#64748B] dark:text-[#94A3B8]">
                {count1}
              </span>
            </div>
          </div>

          <div className="border-t border-[#F1F5F9] dark:border-[#1F2937] pt-3 flex flex-col gap-2">
            <span className="text-[12px] font-semibold text-[#475569] dark:text-[#CBD5E1]">
              Acesso Rápido
            </span>
            <Link
              href="/reviews"
              className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
            >
              Ir para gestão completa de avaliações →
            </Link>
          </div>
        </div>

        {/* Right Column: Filter Bar & Review Cards */}
        <div className="flex flex-col gap-3.5 flex-1 w-full">
          {/* Filter Bar com abas completas */}
          <div className="flex items-center justify-between flex-wrap gap-2 rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] px-4 py-3 shadow-xs transition-colors duration-200">
            <div className="flex items-center gap-2 flex-wrap">
              {/* All */}
              <button
                type="button"
                onClick={() => setActiveFilter("all")}
                className={`rounded-lg px-3 py-1.5 text-[12px] leading-4 font-semibold transition-colors cursor-pointer ${
                  activeFilter === "all"
                    ? "bg-[#2563EB] text-white"
                    : "border border-[#CBD5E1] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#1F2937] text-[#475569] dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-[#283548]"
                }`}
              >
                Todas ({totalReviews})
              </button>

              {/* 5 Stars */}
              <button
                type="button"
                onClick={() => setActiveFilter("5star")}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] leading-4 font-medium transition-colors cursor-pointer ${
                  activeFilter === "5star"
                    ? "bg-[#2563EB] text-white"
                    : "border border-[#CBD5E1] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#1F2937] text-[#0F172A] dark:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-[#283548]"
                }`}
              >
                <span>5★ ({count5})</span>
              </button>

              {/* 4 Stars */}
              <button
                type="button"
                onClick={() => setActiveFilter("4star")}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] leading-4 font-medium transition-colors cursor-pointer ${
                  activeFilter === "4star"
                    ? "bg-[#2563EB] text-white"
                    : "border border-[#CBD5E1] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#1F2937] text-[#0F172A] dark:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-[#283548]"
                }`}
              >
                <span>4★ ({count4})</span>
              </button>

              {/* Ouvidoria / Notas Baixas (<4) */}
              <button
                type="button"
                onClick={() => setActiveFilter("retained")}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] leading-4 font-medium transition-colors cursor-pointer ${
                  activeFilter === "retained"
                    ? "bg-amber-600 text-white"
                    : "border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 hover:bg-amber-100"
                }`}
              >
                <span>Ouvidoria &lt;4★ ({countRetained})</span>
              </button>

              {/* Unreplied */}
              <button
                type="button"
                onClick={() => setActiveFilter("unreplied")}
                className={`rounded-lg px-3 py-1.5 text-[12px] leading-4 font-medium transition-colors cursor-pointer ${
                  activeFilter === "unreplied"
                    ? "bg-[#2563EB] text-white"
                    : "border border-[#CBD5E1] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#1F2937] text-[#475569] dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-[#283548]"
                }`}
              >
                Não respondidas ({unrepliedCount})
              </button>
            </div>
          </div>

          {/* Review Cards Feed */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-28 rounded-xl border border-slate-200 dark:border-[#1F2937] bg-white dark:bg-[#111827] p-4 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredReviews.map((rev) => (
                <div
                  key={rev.id}
                  className={`flex flex-col gap-2.5 rounded-xl border p-4 shadow-xs transition-colors duration-200 ${
                    !rev.isPromoter
                      ? "border-amber-200/90 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10"
                      : "border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827]"
                  }`}
                >
                  {/* Top Bar: Customer & Rating */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {rev.customerAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={rev.customerAvatar}
                          alt={rev.customerName}
                          className="h-8 w-8 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] dark:bg-blue-950/60 text-[#1D4ED8] dark:text-blue-300 text-xs font-bold">
                          {rev.initials}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                            {rev.customerName}
                          </span>
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1 py-0.2 rounded font-semibold border border-emerald-200/60">
                            Verificado
                          </span>
                          {!rev.isPromoter && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-1.5 py-0.2 rounded font-semibold border border-amber-300 dark:border-amber-900/50">
                              Ouvidoria Privada
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                          {rev.timeAgo}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 px-2 py-0.5 rounded">
                      <span className="text-amber-500 text-xs">★</span>
                      <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        {rev.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {/* Comment */}
                  {rev.comment && (
                    <p className="text-[13px] leading-5 text-[#0F172A] dark:text-[#CBD5E1] m-0">
                      &ldquo;{rev.comment}&rdquo;
                    </p>
                  )}

                  {/* Reply Display */}
                  {rev.replied && rev.replyText && (
                    <div className="rounded-lg bg-slate-50 dark:bg-[#1F2937]/50 p-3 text-xs space-y-1 border border-slate-100 dark:border-slate-800">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        Sua resposta:
                      </span>
                      <p className="text-slate-600 dark:text-slate-300 m-0">{rev.replyText}</p>
                    </div>
                  )}

                  {/* Reply Form */}
                  {replyingToId === rev.id ? (
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <textarea
                        rows={2}
                        placeholder="Escreva sua resposta para o cliente..."
                        value={replyInput}
                        onChange={(e) => setReplyInput(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-[#334155] p-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600 bg-white dark:bg-[#111827]"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingToId(null);
                            setReplyInput("");
                          }}
                          className="px-3 py-1 text-xs text-slate-600 dark:text-slate-300 cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={isSavingReply || !replyInput.trim()}
                          onClick={() => handleSendReply(rev.id)}
                          className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                        >
                          {isSavingReply ? "Salvando..." : "Salvar"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingToId(rev.id);
                          setReplyInput(rev.replyText || "");
                        }}
                        className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                      >
                        {rev.replied ? "Editar Resposta" : "Responder"}
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {filteredReviews.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-[#334155] bg-white dark:bg-[#111827] p-8 text-center text-slate-500 text-xs">
                  {totalReviews === 0
                    ? `Nenhuma avaliação encontrada para o período "${dateRange}".`
                    : "Nenhuma avaliação encontrada com o filtro selecionado."}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
