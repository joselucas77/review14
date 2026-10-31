"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getClientStoreUrl } from "@/lib/urls";

interface CustomFieldItem {
  id: string;
  companyId: string;
  label: string;
  description?: string | null;
  fieldType: "RATING_5" | "SINGLE_SELECT" | "MULTI_SELECT" | "TEXT";
  options?: string[] | null;
  order: number;
  isActive: boolean;
}

export default function FormBuilderPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [company, setCompany] = React.useState<any>(null);
  const [fields, setFields] = React.useState<CustomFieldItem[]>([]);
  const [feedbackMsg, setFeedbackMsg] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Formulário de novo critério
  const [newLabel, setNewLabel] = React.useState("");
  const [newType, setNewType] = React.useState<"RATING_5" | "SINGLE_SELECT" | "MULTI_SELECT" | "TEXT">("RATING_5");
  const [newOptionsText, setNewOptionsText] = React.useState("Excelente, Bom, Regular");

  React.useEffect(() => {
    async function loadCompanyAndFields() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        let activeCompany: any = null;

        if (user) {
          const { data: companyData } = await supabase
            .from("Company")
            .select("*")
            .eq("ownerId", user.id)
            .maybeSingle();

          if (companyData) {
            activeCompany = companyData;
          }
        }

        // Fallback para localStorage
        if (!activeCompany && typeof window !== "undefined") {
          const stored = localStorage.getItem("review14_current_company");
          if (stored) {
            try {
              activeCompany = JSON.parse(stored);
            } catch (e) {
              // ignore
            }
          }
        }

        if (activeCompany) {
          setCompany(activeCompany);

          // Busca campos no Supabase
          if (activeCompany.id) {
            const { data: dbFields, error } = await supabase
              .from("CustomField")
              .select("*")
              .eq("companyId", activeCompany.id)
              .order("order", { ascending: true });

            if (!error && dbFields && dbFields.length > 0) {
              setFields(dbFields as CustomFieldItem[]);
            } else if (!error && (!dbFields || dbFields.length === 0)) {
              // Cria critérios iniciais se ainda não houver nenhum
              const initialFields: CustomFieldItem[] = [
                {
                  id: `cf_${Date.now()}_1`,
                  companyId: activeCompany.id,
                  label: "Qualidade dos Produtos / Comida",
                  fieldType: "RATING_5",
                  order: 1,
                  isActive: true,
                },
                {
                  id: `cf_${Date.now()}_2`,
                  companyId: activeCompany.id,
                  label: "Agilidade e Atendimento",
                  fieldType: "RATING_5",
                  order: 2,
                  isActive: true,
                },
                {
                  id: `cf_${Date.now()}_3`,
                  companyId: activeCompany.id,
                  label: "Ambiente e Limpeza",
                  fieldType: "RATING_5",
                  order: 3,
                  isActive: true,
                },
              ];

              await supabase.from("CustomField").insert(
                initialFields.map((f) => ({
                  ...f,
                  updatedAt: new Date().toISOString(),
                }))
              );
              setFields(initialFields);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar campos personalizados:", err);
      } finally {
        setLoading(false);
      }
    }

    loadCompanyAndFields();

    const handleCompanyUpdated = (e: any) => {
      if (e.detail?.id) {
        loadCompanyAndFields();
      }
    };

    window.addEventListener("review14_company_updated", handleCompanyUpdated as EventListener);
    return () => {
      window.removeEventListener("review14_company_updated", handleCompanyUpdated as EventListener);
    };
  }, []);

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;

    setSaving(true);
    setFeedbackMsg(null);

    try {
      const supabase = createClient();
      const companyId = company?.id;

      if (!companyId) {
        setFeedbackMsg({
          type: "error",
          text: "Estabelecimento não identificado. Configure seu estabelecimento no Onboarding primeiro.",
        });
        setSaving(false);
        return;
      }

      let parsedOptions: string[] | null = null;
      if (newType === "SINGLE_SELECT" || newType === "MULTI_SELECT") {
        parsedOptions = newOptionsText
          .split(",")
          .map((opt) => opt.trim())
          .filter(Boolean);
        if (parsedOptions.length === 0) {
          parsedOptions = ["Opção 1", "Opção 2", "Opção 3"];
        }
      }

      const newId = `cf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newFieldData: CustomFieldItem = {
        id: newId,
        companyId,
        label: newLabel.trim(),
        fieldType: newType,
        options: parsedOptions,
        order: fields.length + 1,
        isActive: true,
      };

      const { error } = await supabase.from("CustomField").insert({
        ...newFieldData,
        updatedAt: new Date().toISOString(),
      });

      if (error) {
        throw error;
      }

      setFields((prev) => [...prev, newFieldData]);
      setNewLabel("");
      setFeedbackMsg({
        type: "success",
        text: `Critério "${newFieldData.label}" inserido no formulário público com sucesso!`,
      });
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err: any) {
      console.error("Erro ao salvar campo customizado:", err);
      setFeedbackMsg({
        type: "error",
        text: err.message || "Erro ao salvar o critério no banco de dados.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveField = async (id: string, label: string) => {
    try {
      const supabase = createClient();
      await supabase.from("CustomField").delete().eq("id", id);
      setFields((prev) => prev.filter((item) => item.id !== id));
      setFeedbackMsg({
        type: "success",
        text: `Critério "${label}" removido do formulário.`,
      });
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err: any) {
      console.error("Erro ao remover critério:", err);
      setFeedbackMsg({
        type: "error",
        text: "Erro ao remover o critério do banco de dados.",
      });
    }
  };

  const handleToggleActive = async (field: CustomFieldItem) => {
    try {
      const supabase = createClient();
      const updatedStatus = !field.isActive;

      await supabase
        .from("CustomField")
        .update({
          isActive: updatedStatus,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", field.id);

      setFields((prev) =>
        prev.map((item) => (item.id === field.id ? { ...item, isActive: updatedStatus } : item))
      );
    } catch (err) {
      console.error("Erro ao alternar status do campo:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 w-full items-center justify-center text-xs text-slate-400">
        <svg className="animate-spin h-5 w-5 text-blue-600 mr-2" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Carregando critérios de avaliação...
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-6 p-6 md:p-8 select-none transition-colors duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-0 items-start sm:items-end justify-between w-full">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[24px] font-bold leading-[30px] tracking-tight text-[#0F172A] dark:text-[#F8FAFC] m-0">
              Construtor de Perguntas &amp; Critérios PRO
            </h1>
            <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-900/50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
              ⭐ Recurso PRO Ativo
            </span>
          </div>
          <p className="text-[13px] leading-4 text-[#64748B] dark:text-[#94A3B8] m-0">
            Personalize as subperguntas que aparecem para os clientes após a nota geral de 5 estrelas.
          </p>
        </div>

        {/* Link para Testar no Cliente */}
        {company?.slug && (
          <Link
            href={getClientStoreUrl(company.slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 px-3.5 py-2 text-[13px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors shadow-xs"
          >
            <span>Ver Formulário Público</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </Link>
        )}
      </div>

      {/* Feedback Alert */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
            feedbackMsg.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300"
          }`}
        >
          {feedbackMsg.type === "success" ? "✓" : "⚠️"} {feedbackMsg.text}
        </div>
      )}

      {/* Grid: Esquerda Formulário de Adicionar / Direita Prévia e Lista */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
        {/* Coluna Esquerda: Adicionar Novo Critério */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 dark:border-[#1F2937] pb-3">
              <h2 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">
                + Adicionar Nova Pergunta
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Escolha o formato que melhor se adapta à experiência do seu negócio.
              </p>
            </div>

            <form onSubmit={handleAddField} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Título da Pergunta / Critério *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Qualidade do Espresso, Música do Ambiente..."
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#1E293B] text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Tipo de Resposta
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#1E293B] text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                >
                  <option value="RATING_5">⭐ Classificação de 1 a 5 Estrelas</option>
                  <option value="SINGLE_SELECT">🔘 Escolha Única (Opções prontas)</option>
                  <option value="MULTI_SELECT">☑️ Múltipla Escolha (Acordeon de tags)</option>
                  <option value="TEXT">💬 Pergunta Aberta (Texto livre)</option>
                </select>
              </div>

              {(newType === "SINGLE_SELECT" || newType === "MULTI_SELECT") && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Opções de Resposta</span>
                    <span className="text-[10px] text-slate-400 lowercase font-normal">separadas por vírgula</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Excelente, Boa, Regular, Ruim"
                    value={newOptionsText}
                    onChange={(e) => setNewOptionsText(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#1E293B] text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 px-4 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs tracking-wide shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Salvando Critério...</span>
                  </>
                ) : (
                  <span>+ Inserir no Formulário do Cliente</span>
                )}
              </button>
            </form>
          </div>

          {/* Dica Estratégica PRO */}
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-1.5">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
              💡 Dica de Engajamento PRO:
            </span>
            <p className="text-[11px] leading-4 text-amber-800 dark:text-amber-200/90 m-0">
              Formulários com <strong>3 a 4 perguntas focadas</strong> mantêm a taxa de conclusão acima de 85%. Subcategorias de 5 estrelas são respondidas em menos de 5 segundos pelos clientes no celular.
            </p>
          </div>
        </div>

        {/* Coluna Direita: Lista de Critérios Ativos e Prévia */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1F2937] pb-3">
              <div>
                <span className="text-[15px] font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Critérios Ativos no seu Formulário ({fields.length})
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 m-0">
                  Perguntas que seu cliente responderá ao escanear o QR Code de <strong>{company?.tradeName || "sua loja"}</strong>.
                </p>
              </div>
            </div>

            {fields.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                Nenhum critério cadastrado ainda. Use o formulário ao lado para adicionar perguntas específicas!
              </div>
            ) : (
              <div className="space-y-3">
                {fields.map((field, idx) => (
                  <div
                    key={field.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      field.isActive
                        ? "bg-slate-50/70 dark:bg-[#1F2937]/50 border-slate-200 dark:border-slate-800"
                        : "bg-slate-100/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-bold text-xs">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                            {field.label}
                          </h4>
                          {!field.isActive && (
                            <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.2 rounded font-semibold">
                              Pausada
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {field.fieldType === "RATING_5" && "⭐ Avaliação de 1 a 5 estrelas"}
                          {field.fieldType === "SINGLE_SELECT" && `🔘 Escolha única: ${field.options?.join(", ") || ""}`}
                          {field.fieldType === "MULTI_SELECT" && `☑️ Múltipla escolha: ${field.options?.join(", ") || ""}`}
                          {field.fieldType === "TEXT" && "💬 Resposta em texto livre"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(field)}
                        className={`text-[11px] px-2.5 py-1 rounded-md font-semibold transition-colors ${
                          field.isActive
                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300"
                        }`}
                      >
                        {field.isActive ? "Ativa" : "Ativar"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveField(field.id, field.label)}
                        className="text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 p-1.5 rounded-md transition-colors"
                        title="Remover pergunta"
                      >
                        ✕ Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
