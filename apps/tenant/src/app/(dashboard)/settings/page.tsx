"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { createClient } from "@/lib/supabase/client";
import { getClientBaseUrl, getClientStoreUrl } from "@/lib/urls";

interface CompanyRecord {
  id: string;
  slug: string;
  legalName: string;
  tradeName: string;
  cnpj?: string | null;
  category: string;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  googlePlaceId?: string | null;
  customRedirectUrl?: string | null;
  minRatingForGoogle: number;
  planTier: string;
  ownerId: string;
}

export default function TenantSettingsPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [companyId, setCompanyId] = React.useState<string | null>(null);

  // Form Fields
  const [tradeName, setTradeName] = React.useState("");
  const [legalName, setLegalName] = React.useState("");
  const [cnpj, setCnpj] = React.useState("");
  const [category, setCategory] = React.useState("Restaurante");
  const [slug, setSlug] = React.useState("");
  const [slugCustomized, setSlugCustomized] = React.useState(false);
  const [phone, setPhone] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState("");

  // Google Reputação
  const [googlePlaceId, setGooglePlaceId] = React.useState("");
  const [customRedirectUrl, setCustomRedirectUrl] = React.useState("");
  const [minRating, setMinRating] = React.useState(4);

  // Feedback states
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const formatCnpj = (value: string) => {
    const raw = value.replace(/\D/g, "").slice(0, 14);
    return raw
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleTradeNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTradeName(val);
    if (!legalName) {
      setLegalName(val);
    }
    if (!slugCustomized) {
      setSlug(generateSlug(val));
    }
  };

  // Carrega dados da empresa associada ao lojista logado
  React.useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setUserId(user.id);

          // 1. Busca empresa existente no Supabase para este proprietário
          const { data: comp, error } = await supabase
            .from("Company")
            .select("*")
            .eq("ownerId", user.id)
            .maybeSingle();

          if (comp && !error) {
            setCompanyId(comp.id);
            setTradeName(comp.tradeName || "");
            setLegalName(comp.legalName || comp.tradeName || "");
            setCnpj(comp.cnpj ? formatCnpj(comp.cnpj) : "");
            setCategory(comp.category || "Restaurante");
            setSlug(comp.slug || "");
            setSlugCustomized(true);
            setPhone(comp.phone || "");
            setCity(comp.city || "");
            setState(comp.state || "");
            setGooglePlaceId(comp.googlePlaceId || "");
            setCustomRedirectUrl(comp.customRedirectUrl || "");
            setMinRating(comp.minRatingForGoogle ?? 4);

            if (typeof window !== "undefined") {
              localStorage.setItem("review14_current_company", JSON.stringify(comp));
            }
          } else {
            // Tenta recuperar do localStorage se ainda não gravou no banco
            const stored = localStorage.getItem("review14_current_company");
            if (stored) {
              try {
                const parsed = JSON.parse(stored);
                if (parsed.tradeName) setTradeName(parsed.tradeName);
                if (parsed.legalName) setLegalName(parsed.legalName);
                if (parsed.cnpj) setCnpj(formatCnpj(parsed.cnpj));
                if (parsed.category) setCategory(parsed.category);
                if (parsed.slug) {
                  setSlug(parsed.slug);
                  setSlugCustomized(true);
                }
              } catch (e) {
                // ignore
              }
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar configurações da loja:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!tradeName.trim()) {
      setErrorMessage("Por favor, informe o Nome Fantasia do estabelecimento.");
      return;
    }

    const finalSlug = slug.trim() ? generateSlug(slug) : generateSlug(tradeName);
    if (!finalSlug) {
      setErrorMessage("O link/slug do estabelecimento é obrigatório.");
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();
      let currentOwnerId = userId;

      // Obtém usuário se não estava carregado
      if (!currentOwnerId) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          currentOwnerId = user.id;
          setUserId(user.id);
        } else {
          setErrorMessage("Você precisa estar autenticado para salvar as configurações.");
          setSaving(false);
          return;
        }
      }

      // Validação de unicidade do slug (não pode colidir com outra empresa)
      const { data: existingSlug } = await supabase
        .from("Company")
        .select("id")
        .eq("slug", finalSlug)
        .maybeSingle();

      if (existingSlug && existingSlug.id !== companyId) {
        setErrorMessage(
          `O link "${finalSlug}" já está em uso por outro estabelecimento. Escolha outro slug.`
        );
        setSaving(false);
        return;
      }

      const cleanCnpj = cnpj.replace(/\D/g, "") || null;
      const targetLegalName = legalName.trim() || tradeName.trim();
      const targetCategory = category.trim() || "Restaurante";

      let savedComp: CompanyRecord;

      if (companyId) {
        // Atualiza a empresa existente
        const { data, error } = await supabase
          .from("Company")
          .update({
            tradeName: tradeName.trim(),
            legalName: targetLegalName,
            cnpj: cleanCnpj,
            category: targetCategory,
            slug: finalSlug,
            phone: phone.trim() || null,
            city: city.trim() || null,
            state: state.trim() || null,
            googlePlaceId: googlePlaceId.trim() || null,
            customRedirectUrl: customRedirectUrl.trim() || null,
            minRatingForGoogle: minRating,
            updatedAt: new Date().toISOString(),
          })
          .eq("id", companyId)
          .select()
          .single();

        if (error) {
          throw error;
        }
        savedComp = data as CompanyRecord;
      } else {
        // Cria a nova empresa no Supabase para este proprietário
        const newId = crypto.randomUUID();
        const { data, error } = await supabase
          .from("Company")
          .insert({
            id: newId,
            tradeName: tradeName.trim(),
            legalName: targetLegalName,
            cnpj: cleanCnpj,
            category: targetCategory,
            slug: finalSlug,
            phone: phone.trim() || null,
            city: city.trim() || null,
            state: state.trim() || null,
            googlePlaceId: googlePlaceId.trim() || null,
            customRedirectUrl: customRedirectUrl.trim() || null,
            minRatingForGoogle: minRating,
            planTier: "PRO",
            subscriptionStatus: "ACTIVE",
            isActive: true,
            ownerId: currentOwnerId,
            updatedAt: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        savedComp = data as CompanyRecord;
        setCompanyId(newId);

        // Cria perguntas iniciais sugeridas em CustomField
        await supabase.from("CustomField").insert([
          {
            id: crypto.randomUUID(),
            companyId: newId,
            label: "Qualidade do Atendimento",
            fieldType: "RATING_5",
            order: 1,
            isActive: true,
            updatedAt: new Date().toISOString(),
          },
          {
            id: crypto.randomUUID(),
            companyId: newId,
            label: "Qualidade dos Produtos / Serviços",
            fieldType: "RATING_5",
            order: 2,
            isActive: true,
            updatedAt: new Date().toISOString(),
          },
          {
            id: crypto.randomUUID(),
            companyId: newId,
            label: "Como foi sua experiência?",
            fieldType: "SINGLE_SELECT",
            options: ["Consumo no Local", "Retirada no Balcão", "Delivery"],
            order: 3,
            isActive: true,
            updatedAt: new Date().toISOString(),
          },
          {
            id: crypto.randomUUID(),
            companyId: newId,
            label: "Destaques do Estabelecimento",
            fieldType: "MULTI_SELECT",
            options: [
              "Atendimento atencioso",
              "Ambiente agradável",
              "Wi-Fi rápido",
              "Custo-benefício",
            ],
            order: 4,
            isActive: true,
            updatedAt: new Date().toISOString(),
          },
        ]);
      }

      // Salva no localStorage e dispara evento de sincronização para a Sidebar e Header
      if (typeof window !== "undefined") {
        localStorage.setItem("review14_current_company", JSON.stringify(savedComp));
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(
          new CustomEvent("review14_company_updated", { detail: savedComp })
        );
      }

      setSuccessMessage(
        "Loja configurada com sucesso! O link do QR Code e as perguntas de avaliação já estão 100% ativos."
      );
    } catch (err: any) {
      console.error("Erro ao salvar loja:", err);
      setErrorMessage(
        err?.message || "Ocorreu um erro ao salvar as configurações. Tente novamente."
      );
    } finally {
      setSaving(false);
    }
  };

  const clientOrigin = getClientBaseUrl();
  const publicStoreUrl = getClientStoreUrl(slug);

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-6 p-6 md:p-8 select-none transition-colors duration-200 pb-12">
      {/* Header Padronizado */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-0 items-start sm:items-end justify-between w-full">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[24px] font-bold leading-[30px] tracking-tight text-[#0F172A] dark:text-[#F8FAFC] m-0">
              Configurações da Loja &amp; Perfil Comercial
            </h1>
            <span className="rounded-full bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
              Perfil do Estabelecimento
            </span>
          </div>
          <p className="text-[13px] leading-4 text-[#64748B] dark:text-[#94A3B8] m-0">
            Configure a identidade da sua loja, o link público do QR Code e as regras de proteção de reputação no Google.
          </p>
        </div>

        {/* Botão de Acesso Rápido */}
        {slug && (
          <a
            href={publicStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 px-3.5 py-2 text-[13px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors shadow-xs"
          >
            <span>Ver Loja no Cliente</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" strokeWidth="2" />
            </svg>
          </a>
        )}
      </div>

      {/* Banner de Aviso caso a loja ainda não tenha sido cadastrada */}
      {!loading && !companyId && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-4 text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div className="text-xs space-y-1">
            <p className="font-bold text-sm">Finalize a configuração da sua loja</p>
            <p className="text-amber-800 dark:text-amber-300">
              Você ainda não possui um estabelecimento salvo no sistema. Preencha o{" "}
              <strong>Nome Fantasia</strong> e <strong>CNPJ</strong> abaixo para gerar o
              seu link exclusivo, ativar os QR Codes e liberar o criador de perguntas PRO!
            </p>
          </div>
        </div>
      )}

      {/* Alertas de Sucesso e Erro */}
      {successMessage && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-emerald-900 dark:text-emerald-200 flex items-start gap-3">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <div className="text-xs space-y-2 flex-1">
            <p className="font-bold text-sm">{successMessage}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href={publicStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-3 py-1.5 font-semibold hover:bg-emerald-700 transition"
              >
                Abrir Página de Avaliação →
              </a>
              <Link
                href="/form-builder"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 px-3 py-1.5 font-semibold hover:bg-emerald-100/50 transition"
              >
                Configurar Perguntas PRO
              </Link>
              <Link
                href="/qrcode"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 px-3 py-1.5 font-semibold hover:bg-emerald-100/50 transition"
              >
                Imprimir QR Code
              </Link>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-4 text-rose-900 dark:text-rose-200 flex items-start gap-3 text-xs">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="shrink-0 text-rose-600 dark:text-rose-400"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Grid de Configurações */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Principal (2/3 da largura) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Seção 1: Dados Cadastrais */}
          <div className="p-6 bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-3xl shadow-xs space-y-6">
            <div className="border-b border-slate-100 dark:border-[#1F2937] pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Identificação do Estabelecimento
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Esses dados identificam sua empresa e aparecem para os clientes no topo do
                formulário de avaliação.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nome Fantasia */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nome Fantasia da Loja *
                </label>
                <Input
                  value={tradeName}
                  onChange={handleTradeNameChange}
                  placeholder="Ex: Café & Bistrô Aurora"
                  required
                  className="dark:bg-[#1F2937] dark:border-[#334155] dark:text-white"
                />
                <p className="text-[11px] text-slate-400">
                  O nome principal que seus clientes veem ao avaliar.
                </p>
              </div>

              {/* CNPJ */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  CNPJ
                </label>
                <Input
                  value={cnpj}
                  onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  className="dark:bg-[#1F2937] dark:border-[#334155] dark:text-white"
                />
                <p className="text-[11px] text-slate-400">
                  Opcional para negócios MEI / autônomos.
                </p>
              </div>

              {/* Razão Social */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Razão Social
                </label>
                <Input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Ex: Aurora Alimentos e Bebidas Ltda"
                  className="dark:bg-[#1F2937] dark:border-[#334155] dark:text-white"
                />
              </div>

              {/* Categoria */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Segmento / Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-md border border-slate-300 dark:border-[#334155] bg-white dark:bg-[#1F2937] px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                >
                  <option value="Restaurante">Restaurante</option>
                  <option value="Cafeteria & Bistrô">Cafeteria &amp; Bistrô</option>
                  <option value="Bar & Pub">Bar &amp; Pub</option>
                  <option value="Pizzaria">Pizzaria</option>
                  <option value="Hamburgueria">Hamburgueria</option>
                  <option value="Padaria & Confeitaria">Padaria &amp; Confeitaria</option>
                  <option value="Salão de Beleza & Barbearia">
                    Salão de Beleza &amp; Barbearia
                  </option>
                  <option value="Clínica & Saúde">Clínica &amp; Saúde</option>
                  <option value="Varejo & Comércio">Varejo &amp; Comércio</option>
                  <option value="Hotel & Hospedagem">Hotel &amp; Hospedagem</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              {/* Telefone / WhatsApp */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Telefone / WhatsApp Comercial
                </label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 98765-4321"
                  className="dark:bg-[#1F2937] dark:border-[#334155] dark:text-white"
                />
              </div>

              {/* Cidade e Estado */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Cidade
                </label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: São Paulo"
                  className="dark:bg-[#1F2937] dark:border-[#334155] dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Estado (UF)
                </label>
                <Input
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="SP"
                  maxLength={2}
                  className="dark:bg-[#1F2937] dark:border-[#334155] dark:text-white uppercase"
                />
              </div>
            </div>
          </div>

          {/* Seção 2: Link do Estabelecimento & QR Code */}
          <div className="p-6 bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-3xl shadow-xs space-y-6">
            <div className="border-b border-slate-100 dark:border-[#1F2937] pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                Link Público e Endereço do QR Code
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Este é o link direto para o qual os clientes serão redirecionados ao
                escanear o QR Code nas mesas ou no balcão.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Slug / Identificador da URL *
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                    {clientOrigin}/
                  </span>
                  <Input
                    value={slug}
                    onChange={(e) => {
                      setSlugCustomized(true);
                      setSlug(generateSlug(e.target.value));
                    }}
                    placeholder="ex: cafe-aurora"
                    required
                    className="font-mono text-sm dark:bg-[#1F2937] dark:border-[#334155] dark:text-white"
                  />
                </div>
              </div>

              {/* Preview do Link Ativo */}
              <div className="rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/30 p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate font-mono">
                    {publicStoreUrl}
                  </span>
                </div>
                {slug && (
                  <a
                    href={publicStoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    Testar link
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Seção 3: Triagem do Google Meu Negócio */}
          <div className="p-6 bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-3xl shadow-xs space-y-6">
            <div className="border-b border-slate-100 dark:border-[#1F2937] pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Regras de Proteção de Reputação no Google Maps
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Defina qual a nota mínima para convidar o cliente satisfeito a postar no
                Google Avaliações.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Google Place ID (Para Redirecionamento Direto em 1 Clique)
                  </label>
                  <a
                    href="https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Onde encontrar meu Place ID? ↗
                  </a>
                </div>
                <Input
                  value={googlePlaceId}
                  onChange={(e) => setGooglePlaceId(e.target.value)}
                  placeholder="Ex: ChIJN1t_tDeuEmsRUsoyG83frY4"
                  className="dark:bg-[#1F2937] dark:border-[#334155] dark:text-white font-mono text-sm"
                />
                <p className="text-[11px] text-slate-400">
                  Se não tiver o Place ID, o sistema busca automaticamente pelo nome da sua loja no Google Maps.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nota Mínima para Convite ao Google ({minRating} Estrelas)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={3}
                    max={5}
                    step={1}
                    value={minRating}
                    onChange={(e) => setMinRating(Number(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <span className="font-bold text-sm bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0">
                    {minRating}★ ou mais
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Clientes que avaliarem com {minRating} ou 5 estrelas serão convidados a
                  compartilhar no Google com o comentário já copiado. Notas menores serão
                  retidas confidencialmente na ouvidoria interna.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna Lateral (1/3 da largura) */}
        <div className="space-y-6">
          {/* Card de Ação Principal de Salvar */}
          <div className="p-5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-3xl shadow-xs space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Salvar Alterações
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Clique abaixo para atualizar o perfil e ativar o link e os QR Codes da sua loja.
              </p>
            </div>

            <Button
              type="submit"
              disabled={saving || loading}
              size="lg"
              fullWidth
              className="font-semibold shadow-md bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Salvando...
                </span>
              ) : (
                "Salvar e Ativar Estabelecimento"
              )}
            </Button>
          </div>

          {/* Card de Assinatura PRO */}
          <div className="p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white rounded-3xl space-y-4 shadow-sm border border-slate-800">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-[11px] uppercase font-bold tracking-wider text-amber-400">
                  Assinatura Review14
                </span>
                <h3 className="text-lg font-black mt-0.5">Plano PRO Ativo</h3>
              </div>
              <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                Ativo
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Critérios ilimitados de avaliação, proteção anti-detratores, redirecionamento Google e QR Codes ilimitados.
            </p>

            <div className="pt-2 flex flex-col gap-2">
              <Link href="/form-builder" className="w-full">
                <Button
                  type="button"
                  variant="outline"
                  fullWidth
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs font-semibold justify-center"
                >
                  Gerenciar Perguntas PRO →
                </Button>
              </Link>
              <Link href="/qrcode" className="w-full">
                <Button
                  type="button"
                  variant="outline"
                  fullWidth
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs font-semibold justify-center"
                >
                  Gerar QR Codes →
                </Button>
              </Link>
            </div>
          </div>

          {/* Card de Atalhos Rápidos */}
          <div className="p-5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1F2937] rounded-3xl shadow-xs space-y-3">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Acesso Rápido
            </span>
            <div className="space-y-1.5 text-xs">
              <Link
                href="/reviews"
                className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-[#1F2937] text-slate-700 dark:text-slate-300 transition"
              >
                <span>Ver Feed de Avaliações</span>
                <span className="text-slate-400">→</span>
              </Link>
              <Link
                href="/leads"
                className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-[#1F2937] text-slate-700 dark:text-slate-300 transition"
              >
                <span>Relatórios &amp; CRM de Clientes</span>
                <span className="text-slate-400">→</span>
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
