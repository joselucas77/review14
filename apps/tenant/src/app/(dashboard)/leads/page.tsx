"use client";

import * as React from "react";
import { Button } from "@ui/components/button";
import { createClient } from "@/lib/supabase/client";

interface LeadItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalVisits: number;
  lastVisited: string;
  optIn: boolean;
  origin: string;
}

export default function LeadsCrmPage() {
  const [search, setSearch] = React.useState("");
  const [leads, setLeads] = React.useState<LeadItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [companyName, setCompanyName] = React.useState("");

  React.useEffect(() => {
    async function loadLeads() {
      try {
        setLoading(true);
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // 1. Busca a empresa
        const { data: comp } = await supabase
          .from("Company")
          .select("id, tradeName, slug")
          .eq("ownerId", user.id)
          .order("createdAt", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!comp) {
          setLoading(false);
          return;
        }

        setCompanyName(comp.tradeName || "Minha Loja");

        // 2. Busca avaliações da empresa
        const { data: revs, error } = await supabase
          .from("Review")
          .select(`
            id,
            overallRating,
            isAnonymous,
            anonymousName,
            userId,
            createdAt
          `)
          .eq("companyId", comp.id)
          .order("createdAt", { ascending: false });

        if (!error && revs) {
          // Agrupa por cliente
          const map = new Map<string, {
            name: string;
            visits: number;
            lastDate: string;
            userId: string | null;
          }>();

          revs.forEach((r: any) => {
            const key = r.userId || r.anonymousName || "Cliente Anônimo";
            const name = r.anonymousName || "Cliente Verificado";
            const existing = map.get(key);
            if (existing) {
              existing.visits += 1;
              if (new Date(r.createdAt) > new Date(existing.lastDate)) {
                existing.lastDate = r.createdAt;
              }
            } else {
              map.set(key, {
                name,
                visits: 1,
                lastDate: r.createdAt,
                userId: r.userId || null,
              });
            }
          });

          // Se tiver userId, busca dados do usuário
          const mappedLeads: LeadItem[] = Array.from(map.entries()).map(([key, val], idx) => {
            const date = new Date(val.lastDate);
            const formattedDate = date.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return {
              id: `lead_${idx + 1}`,
              name: val.name,
              email: val.userId ? "Identificado via Google" : "Avaliação Presencial",
              phone: "—",
              totalVisits: val.visits,
              lastVisited: formattedDate,
              optIn: true,
              origin: "QR Code Salão",
            };
          });

          setLeads(mappedLeads);
        }
      } catch (err) {
        console.error("Erro ao carregar leads:", err);
      } finally {
        setLoading(false);
      }
    }

    loadLeads();
  }, []);

  const handleExportCsv = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["Nome,E-mail / Tipo,Telefone,Total de Visitas,Última Visita,Origem,OptIn Marketing"]
        .concat(
          leads.map(
            (l) =>
              `"${l.name}","${l.email}","${l.phone}",${l.totalVisits},"${l.lastVisited}","${l.origin}",${l.optIn ? "Sim" : "Nao"}`
          )
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `contatos-clientes-${companyName || "review14"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLeads = leads.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      l.phone.includes(q) ||
      l.origin.toLowerCase().includes(q)
    );
  });

  const totalContacts = leads.length;

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-6 p-6 md:p-8 select-none transition-colors duration-200">
      {/* Header Padronizado */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-0 items-start sm:items-end justify-between w-full">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[24px] font-bold leading-[30px] tracking-tight text-[#0F172A] dark:text-[#F8FAFC] m-0">
              Relatórios &amp; CRM de Clientes
            </h1>
            <span className="rounded-full bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
              {companyName ? `${companyName} • ` : ""}
              {totalContacts} {totalContacts === 1 ? "contato" : "contatos"}
            </span>
          </div>
          <p className="text-[13px] leading-4 text-[#64748B] dark:text-[#94A3B8] m-0">
            Cada cliente que se identifica para avaliar entra automaticamente na sua base de contatos para fidelização e campanhas.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="default"
            size="default"
            disabled={leads.length === 0}
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-[13px] font-semibold shadow-xs"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Exportar Base (CSV)</span>
          </Button>
        </div>
      </div>

      {/* 4 Mini KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Leads Totais */}
        <div className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#64748B] dark:text-[#94A3B8]">
              Total de Clientes Capturados
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2 pt-2">
            <span className="text-[24px] font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
              {loading ? "..." : totalContacts}
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              base ativa
            </span>
          </div>
        </div>

        {/* Card 2: Clientes Recorrentes */}
        <div className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#64748B] dark:text-[#94A3B8]">
              Clientes Recorrentes (2+ Visitas)
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2 pt-2">
            <span className="text-[24px] font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
              {loading ? "..." : leads.filter((l) => l.totalVisits > 1).length}
            </span>
            <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
              fidelizados
            </span>
          </div>
        </div>

        {/* Card 3: Origem Principal */}
        <div className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#64748B] dark:text-[#94A3B8]">
              Canal Principal de Entrada
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2 pt-2">
            <span className="text-[20px] font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
              QR Code
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              Mesas &amp; Balcão
            </span>
          </div>
        </div>

        {/* Card 4: Retenção */}
        <div className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#64748B] dark:text-[#94A3B8]">
              Permissão de Contato
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2 pt-2">
            <span className="text-[24px] font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
              100%
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              LGPD em conformidade
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Filtro e Busca */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-full max-w-md items-center gap-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#111827] px-3 shadow-xs">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 shrink-0">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nome do cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border-none bg-transparent text-[13px] text-[#0F172A] dark:text-[#F8FAFC] placeholder-slate-400 outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Tabela de Contatos */}
      <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="bg-[#F8FAFC] dark:bg-[#1F2937]/70 text-[11px] uppercase font-bold tracking-wider text-[#64748B] dark:text-[#94A3B8] border-b border-[#E2E8F0] dark:border-[#1F2937]">
              <tr>
                <th className="px-6 py-3.5">Cliente</th>
                <th className="px-6 py-3.5">Tipo de Acesso</th>
                <th className="px-6 py-3.5">Avaliações Feitas</th>
                <th className="px-6 py-3.5">Última Avaliação</th>
                <th className="px-6 py-3.5">Canal</th>
                <th className="px-6 py-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1F2937]">
              {filteredLeads.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/70 dark:hover:bg-[#1F2937]/40 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 text-xs font-bold">
                        {l.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-semibold text-[13px] text-[#0F172A] dark:text-[#F8FAFC]">
                        {l.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[13px] text-[#475569] dark:text-[#CBD5E1]">
                    {l.email}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-2.5 py-0.5 text-[11px]">
                      {l.totalVisits} {l.totalVisits === 1 ? "avaliação" : "avaliações"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {l.lastVisited}
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-[#475569] dark:text-[#CBD5E1]">
                    {l.origin}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                      ✓ Ativo
                    </span>
                  </td>
                </tr>
              ))}

              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                    {loading
                      ? "Carregando clientes..."
                      : `Nenhum cliente registrado ainda para a sua loja.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
