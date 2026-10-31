"use client";

import * as React from "react";
import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";

export default function LeadsCrmPage() {
  const [search, setSearch] = React.useState("");

  const leads = [
    {
      id: "lead_1",
      name: "Mariana Costa",
      email: "mariana.costa@gmail.com",
      phone: "(11) 98112-3344",
      totalVisits: 4,
      lastVisited: "Ontem às 20:30",
      optIn: true,
      origin: "Mesa 14",
    },
    {
      id: "lead_2",
      name: "Rodrigo Almeida",
      email: "rodrigo.almeida@hotmail.com",
      phone: "(11) 97223-9900",
      totalVisits: 1,
      lastVisited: "24/10/2026",
      optIn: true,
      origin: "Balcão",
    },
    {
      id: "lead_3",
      name: "Camila Rodrigues",
      email: "camila.rodrigues@yahoo.com.br",
      phone: "(11) 99182-4411",
      totalVisits: 2,
      lastVisited: "20/10/2026",
      optIn: false,
      origin: "Mesa 08",
    },
    {
      id: "lead_4",
      name: "Lucas Fernandes",
      email: "lucas.fernandes@outlook.com",
      phone: "(11) 98341-8899",
      totalVisits: 6,
      lastVisited: "Hoje às 12:45",
      optIn: true,
      origin: "Delivery",
    },
    {
      id: "lead_5",
      name: "Juliana Mendes",
      email: "juliana.mendes@gmail.com",
      phone: "(11) 97654-2210",
      totalVisits: 3,
      lastVisited: "28/10/2026",
      optIn: true,
      origin: "Mesa 03",
    },
  ];

  const handleExportCsv = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["Nome,E-mail,Telefone,Total de Visitas,Última Visita,Origem,OptIn Marketing"]
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
    link.setAttribute("download", "review14-leads-crm.csv");
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
              Base de Contatos &amp; NPS
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
              Total de Contatos Capturados
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
              1.284
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              +18.4% este mês
            </span>
          </div>
        </div>

        {/* Card 2: Taxa de Opt-In */}
        <div className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#64748B] dark:text-[#94A3B8]">
              Permissão de Marketing (Opt-In)
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2 pt-2">
            <span className="text-[24px] font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
              84.6%
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              1.086 autorizados
            </span>
          </div>
        </div>

        {/* Card 3: Clientes Recorrentes */}
        <div className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#64748B] dark:text-[#94A3B8]">
              Fidelidade (2+ Avaliações)
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2 pt-2">
            <span className="text-[24px] font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
              38.2%
            </span>
            <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
              Clientes recorrentes
            </span>
          </div>
        </div>

        {/* Card 4: NPS Score */}
        <div className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#64748B] dark:text-[#94A3B8]">
              Net Promoter Score (NPS)
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2 pt-2">
            <span className="text-[24px] font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
              +82
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              Zona de Excelência
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
            placeholder="Buscar por nome, e-mail, telefone ou mesa..."
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
                <th className="px-6 py-3.5">E-mail</th>
                <th className="px-6 py-3.5">Telefone</th>
                <th className="px-6 py-3.5">Visitas</th>
                <th className="px-6 py-3.5">Última Avaliação</th>
                <th className="px-6 py-3.5">Local / Origem</th>
                <th className="px-6 py-3.5 text-center">Permite Marketing</th>
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
                  <td className="px-6 py-4 text-[13px] font-mono text-[#475569] dark:text-[#CBD5E1]">
                    {l.phone}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-2.5 py-0.5 text-[11px]">
                      {l.totalVisits} {l.totalVisits === 1 ? "visita" : "visitas"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {l.lastVisited}
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-[#475569] dark:text-[#CBD5E1]">
                    {l.origin}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        l.optIn
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {l.optIn ? "✓ Autorizado" : "✕ Não"}
                    </span>
                  </td>
                </tr>
              ))}

              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                    Nenhum cliente encontrado para o filtro "{search}".
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
