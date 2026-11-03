"use client";

import * as React from "react";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import { getClientBaseUrl } from "@/lib/urls";
import { toast } from "@saas/ui/components/sonner";

interface ActiveQrPoint {
  id: string;
  name: string;
  type: "geral" | "balcao" | "mesa" | "conta" | "delivery";
  slug: string;
  url: string;
  totalScans: number;
  reviewsCount: number;
  conversionRate: string;
  status: "active" | "inactive";
  isCustom?: boolean;
}

interface BatchItem {
  table: number;
  url: string;
  qrUrl: string;
}

export default function QrCodeAndLinksPage() {
  const [companyName, setCompanyName] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("review14_current_company");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.tradeName) return parsed.tradeName;
        }
      } catch {}
    }
    return "Meu Estabelecimento";
  });

  const [companySlug, setCompanySlug] = React.useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("review14_current_company");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.slug) return parsed.slug;
        }
      } catch {}
    }
    return "";
  });

  const [selectedType, setSelectedType] = React.useState<
    "geral" | "balcao" | "mesa" | "conta" | "delivery"
  >("geral");
  const [tableNumber, setTableNumber] = React.useState("");
  const [attendantName, setAttendantName] = React.useState("");
  const [qrColor, setQrColor] = React.useState("#0F172A");
  const [qrDataUrl, setQrDataUrl] = React.useState<string>("");
  const [copiedLink, setCopiedLink] = React.useState(false);

  // Batch Generation State
  const [batchModalOpen, setBatchModalOpen] = React.useState(false);
  const [batchCount, setBatchCount] = React.useState("20");
  const [isGeneratingBatch, setIsGeneratingBatch] = React.useState(false);
  const [batchItems, setBatchItems] = React.useState<BatchItem[]>([]);
  const [printMode, setPrintMode] = React.useState<"single" | "batch">("single");

  React.useEffect(() => {
    async function loadCompany() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: comp } = await supabase
            .from("Company")
            .select("tradeName, slug")
            .eq("ownerId", user.id)
            .order("createdAt", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (comp && comp.slug) {
            setCompanyName(comp.tradeName || "Meu Estabelecimento");
            setCompanySlug(comp.slug);
            if (typeof window !== "undefined") {
              localStorage.setItem("review14_current_company", JSON.stringify(comp));
            }
            return;
          }
        }

        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("review14_current_company");
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.tradeName) setCompanyName(parsed.tradeName);
            if (parsed.slug) setCompanySlug(parsed.slug);
          }
        }
      } catch (err) {
        console.warn("Erro ao carregar dados da empresa no QR Code:", err);
      }
    }
    loadCompany();

    const handleCompanyUpdated = (e: any) => {
      const comp = e.detail;
      if (comp?.tradeName) setCompanyName(comp.tradeName);
      if (comp?.slug) setCompanySlug(comp.slug);
    };

    window.addEventListener("review14_company_updated", handleCompanyUpdated as EventListener);
    return () => {
      window.removeEventListener("review14_company_updated", handleCompanyUpdated as EventListener);
    };
  }, []);

  const clientOrigin = getClientBaseUrl();
  const baseUrl = companySlug ? `${clientOrigin}/${companySlug}` : clientOrigin;

  // Build target URL dynamically
  const currentUrl = React.useMemo(() => {
    const params = new URLSearchParams();
    if (selectedType === "mesa" && tableNumber.trim()) {
      params.append("mesa", tableNumber.trim());
    }
    if (selectedType === "conta") {
      params.append("origem", "conta");
    }
    if (selectedType === "delivery") {
      params.append("origem", "delivery");
    }
    if (selectedType === "balcao" && attendantName.trim()) {
      params.append("origem", "balcao");
    }
    if (attendantName.trim()) {
      params.append("garcom", attendantName.trim());
    }
    const query = params.toString();
    return query ? `${baseUrl}?${query}` : baseUrl;
  }, [baseUrl, selectedType, tableNumber, attendantName]);

  // Generate QR Code data URL for single view
  React.useEffect(() => {
    QRCode.toDataURL(currentUrl, {
      width: 500,
      margin: 2,
      color: {
        dark: qrColor,
        light: "#FFFFFF",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("Error generating QR code:", err));
  }, [currentUrl, qrColor]);

  // Pontos de Coleta Padrão
  const defaultPoints: ActiveQrPoint[] = React.useMemo(
    () => [
      {
        id: "pt_default",
        name: "Link Principal da Loja (Padrão)",
        type: "geral",
        slug: "link-principal",
        url: baseUrl,
        totalScans: 1240,
        reviewsCount: 890,
        conversionRate: "71.8%",
        status: "active",
      },
      {
        id: "pt_balcao",
        name: "Display Balcão / Entrada",
        type: "balcao",
        slug: "balcao-entrada",
        url: `${baseUrl}?origem=balcao`,
        totalScans: 412,
        reviewsCount: 265,
        conversionRate: "64.3%",
        status: "active",
      },
      {
        id: "pt_delivery",
        name: "Adesivo Delivery / Embalagem",
        type: "delivery",
        slug: "embalagem-delivery",
        url: `${baseUrl}?origem=delivery`,
        totalScans: 194,
        reviewsCount: 136,
        conversionRate: "70.1%",
        status: "active",
      },
    ],
    [baseUrl]
  );

  // Pontos de Coleta Salvos pelo Dono da Loja
  const [customPoints, setCustomPoints] = React.useState<ActiveQrPoint[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const key = companySlug ? `review14_saved_qr_points_${companySlug}` : "review14_saved_qr_points";
        const stored = localStorage.getItem(key) || localStorage.getItem("review14_saved_qr_points");
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return [];
  });

  const allPoints = React.useMemo(() => {
    return [...customPoints, ...defaultPoints];
  }, [customPoints, defaultPoints]);

  const handleSaveCurrentPoint = () => {
    let pointName = "Link Padrão da Loja";
    if (selectedType === "mesa") {
      pointName = tableNumber.trim()
        ? `Mesa ${tableNumber.trim()}${attendantName.trim() ? ` (${attendantName.trim()})` : ""}`
        : "Mesa do Salão";
    } else if (selectedType === "balcao") {
      pointName = attendantName.trim()
        ? `Balcão (${attendantName.trim()})`
        : "Balcão / Recepção";
    } else if (selectedType === "conta") {
      pointName = "Comanda / Fechamento de Conta";
    } else if (selectedType === "delivery") {
      pointName = "Delivery / Embalagem";
    }

    const newPt: ActiveQrPoint = {
      id: `pt_${Date.now()}`,
      name: pointName,
      type: selectedType,
      slug: `${selectedType}-${Date.now()}`,
      url: currentUrl,
      totalScans: 0,
      reviewsCount: 0,
      conversionRate: "0%",
      status: "active",
      isCustom: true,
    };

    const updated = [newPt, ...customPoints];
    setCustomPoints(updated);
    if (typeof window !== "undefined") {
      const key = companySlug ? `review14_saved_qr_points_${companySlug}` : "review14_saved_qr_points";
      localStorage.setItem(key, JSON.stringify(updated));
    }
    toast.success(`Ponto "${pointName}" salvo com sucesso nos cadastrados!`);
  };

  const handleDeleteCustomPoint = (id: string) => {
    const updated = customPoints.filter((p) => p.id !== id);
    setCustomPoints(updated);
    if (typeof window !== "undefined") {
      const key = companySlug ? `review14_saved_qr_points_${companySlug}` : "review14_saved_qr_points";
      localStorage.setItem(key, JSON.stringify(updated));
    }
    toast.info("Ponto de coleta removido com sucesso.");
  };

  const handleCopy = (urlToCopy?: string) => {
    navigator.clipboard.writeText(urlToCopy || currentUrl);
    setCopiedLink(true);
    toast.success("Link copiado com sucesso!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handlePrintTableTent = () => {
    setPrintMode("single");
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleGenerateAndPrintBatch = async () => {
    const count = Math.min(Math.max(1, parseInt(batchCount, 10) || 1), 60);
    setIsGeneratingBatch(true);
    toast.info(`Gerando QR Codes para ${count} mesas...`);

    try {
      const items: BatchItem[] = [];
      for (let i = 1; i <= count; i++) {
        const tableUrl = `${baseUrl}?mesa=${i}`;
        const qrUrl = await QRCode.toDataURL(tableUrl, {
          width: 320,
          margin: 1,
          color: {
            dark: qrColor,
            light: "#FFFFFF",
          },
        });
        items.push({
          table: i,
          url: tableUrl,
          qrUrl,
        });
      }

      setBatchItems(items);
      setPrintMode("batch");
      setBatchModalOpen(false);

      toast.success(`${count} displays gerados! Abrindo janela de impressão / PDF...`);
      setTimeout(() => {
        window.print();
      }, 300);
    } catch (err) {
      console.error("Erro ao gerar lote de QR Codes:", err);
      toast.error("Falha ao gerar os QR Codes das mesas.");
    } finally {
      setIsGeneratingBatch(false);
    }
  };

  return (
    <>
      {/* Global Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-area,
          #printable-area * {
            visibility: visible !important;
          }
          #printable-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>

      {/* Screen Dashboard View */}
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 p-6 md:p-8 select-none transition-colors duration-200">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-0 items-start sm:items-end justify-between w-full">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[24px] font-bold leading-[30px] tracking-tight text-[#0F172A] dark:text-[#F8FAFC] m-0">
                QR Codes &amp; Links de Coleta
              </h1>
              <span className="rounded-full bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                {allPoints.length} pontos ativos
              </span>
            </div>
            <p className="text-[13px] leading-4 text-[#64748B] dark:text-[#94A3B8] m-0">
              Gere links e displays para mesas, balcões e comandas para capturar avaliações no momento da experiência.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setBatchModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#111827] px-3.5 py-2 text-[13px] font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-slate-50 dark:hover:bg-[#1F2937] transition-colors cursor-pointer shadow-xs"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500 dark:text-slate-400">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <span>Gerar Lote de Mesas (PDF)</span>
            </button>

            <button
              type="button"
              onClick={handlePrintTableTent}
              className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 px-4 py-2 text-[13px] font-semibold leading-4 text-white shadow-xs transition-colors cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>Imprimir Display de Mesa</span>
            </button>
          </div>
        </div>

        {/* Main 2 Columns Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
          {/* Left Column (5 cols): QR Code Studio & Customizer */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="flex flex-col gap-4 rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-5 shadow-xs transition-colors">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1F2937] pb-3">
                <span className="text-[15px] font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Customizador de QR Code
                </span>
                <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">
                  Ao vivo
                </span>
              </div>

              {/* Destination Type Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                  Ponto de Posicionamento:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: "geral", label: "Link Principal (Padrão)" },
                    { id: "mesa", label: "Mesa do Salão" },
                    { id: "balcao", label: "Balcão / Recepção" },
                    { id: "conta", label: "Comanda / Conta" },
                    { id: "delivery", label: "Delivery / Embalagem" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedType(item.id as any)}
                      className={`rounded-lg border p-2 text-left transition-colors cursor-pointer ${
                        selectedType === item.id
                          ? "border-blue-600 bg-blue-50/70 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300 font-semibold"
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Parameter: Table number if mesa */}
              {selectedType === "mesa" && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                      Número da Mesa (Opcional):
                    </label>
                    <input
                      type="text"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      placeholder="Ex: 1, 2, 14..."
                      className="rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#1F2937] p-2 text-xs text-[#0F172A] dark:text-[#F8FAFC] outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                      Atendente (Opcional):
                    </label>
                    <input
                      type="text"
                      value={attendantName}
                      onChange={(e) => setAttendantName(e.target.value)}
                      placeholder="Ex: Lucas"
                      className="rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#1F2937] p-2 text-xs text-[#0F172A] dark:text-[#F8FAFC] outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              )}

              {/* Dynamic Parameter: Attendant if balcao */}
              {selectedType === "balcao" && (
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                    Identificação ou Atendente (Opcional):
                  </label>
                  <input
                    type="text"
                    value={attendantName}
                    onChange={(e) => setAttendantName(e.target.value)}
                    placeholder="Ex: Balcão Principal ou Nome do Atendente"
                    className="rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#1F2937] p-2 text-xs text-[#0F172A] dark:text-[#F8FAFC] outline-none focus:border-blue-600"
                  />
                </div>
              )}

              {/* Color Selector */}
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Cor do QR Code:</span>
                <div className="flex items-center gap-2">
                  {[
                    { color: "#0F172A", label: "Preto Clássico" },
                    { color: "#2563EB", label: "Azul Review14" },
                    { color: "#D97706", label: "Dourado Café" },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => setQrColor(c.color)}
                      style={{ backgroundColor: c.color }}
                      title={c.label}
                      className={`h-6 w-6 rounded-full border-2 transition-transform cursor-pointer ${
                        qrColor === c.color ? "scale-110 border-white ring-2 ring-blue-500" : "border-transparent"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Live QR Code Box */}
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-100 dark:border-[#1F2937] bg-[#F8FAFC] dark:bg-[#1F2937]/30 p-6 space-y-3">
                {qrDataUrl ? (
                  <div className="relative p-3 bg-white rounded-2xl shadow-md border border-slate-200/80">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrDataUrl}
                      alt={`QR Code ${companyName}`}
                      className="w-48 h-48 rounded-xl object-contain"
                    />
                    {/* Center Star Badge Icon */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="h-9 w-9 rounded-full bg-white shadow-md flex items-center justify-center p-1 border border-slate-100">
                        <div className="h-full w-full rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
                          ★
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-48 h-48 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
                )}

                {/* URL preview */}
                <div className="flex items-center gap-2 w-full max-w-sm rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#334155] p-2 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                  <span className="truncate flex-1">{currentUrl}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy()}
                    className="shrink-0 text-blue-600 dark:text-blue-400 font-sans font-semibold hover:underline"
                  >
                    {copiedLink ? "Copiado!" : "Copiar"}
                  </button>
                </div>
              </div>

              {/* Actions for this QR */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {qrDataUrl && (
                  <a
                    href={qrDataUrl}
                    download={`qrcode-${companySlug || "loja"}-${selectedType}${tableNumber.trim() ? `-mesa${tableNumber.trim()}` : ""}.png`}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#111827] p-2 text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] hover:bg-slate-50 dark:hover:bg-[#1F2937] transition-colors"
                  >
                    <span>📥 Baixar PNG</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => handleCopy()}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] text-white p-2 text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                >
                  <span>{copiedLink ? "✓ Link Copiado" : "🔗 Copiar Link Direto"}</span>
                </button>
              </div>

              {/* Botão de Salvar Ponto nos Cadastrados */}
              <button
                type="button"
                onClick={handleSaveCurrentPoint}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 p-2.5 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors cursor-pointer"
              >
                <span>💾 Salvar este Ponto nos Cadastrados</span>
              </button>
            </div>

            {/* Table Tent Acrilic Display Preview */}
            <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-5 shadow-xs transition-colors">
              <span className="text-[14px] font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Prévia do Display de Mesa (Acrílico)
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 m-0">
                Modelo pronto para colocar nas mesas. Ao apontar o celular, a avaliação é iniciada diretamente.
              </p>

              {/* Display Stand Mockup */}
              <div className="rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1F2937]/40 p-6 flex flex-col items-center text-center space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                    ★
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">{companyName}</span>
                </div>

                <div className="space-y-0.5">
                  <div className="text-xs font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">
                    Sua opinião vale muito
                  </div>
                  <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">
                    Avalie nosso atendimento em 15 segundos
                  </div>
                </div>

                {qrDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt="QR Code Display"
                    className="w-32 h-32 rounded-xl bg-white p-2 shadow-sm border border-slate-200"
                  />
                )}

                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Aponte a câmera do celular para avaliar{selectedType === "mesa" && tableNumber.trim() ? ` • Mesa ${tableNumber.trim()}` : ""}
                </div>

                <div className="pt-1 text-[9px] text-slate-400 font-medium">
                  Powered by Review14
                </div>
              </div>

              <button
                type="button"
                onClick={handlePrintTableTent}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-950/40 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors"
              >
                <span>🖨️ Imprimir Este Display em Folha A4</span>
              </button>
            </div>
          </div>

          {/* Right Column (7 cols): Active Points of Collection & Metrics */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            <div className="flex flex-col gap-4 rounded-xl border border-[#E2E8F0] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-5 shadow-xs transition-colors">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1F2937] pb-3">
                <div>
                  <span className="text-[15px] font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    Pontos de Coleta Cadastrados
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 m-0">
                    Monitore quais QR codes e links geram maior conversão e avaliações.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(baseUrl)}
                  className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                >
                  + Copiar Link Padrão
                </button>
              </div>

              {/* List of Active Points */}
              <div className="space-y-3">
                {allPoints.map((pt) => (
                  <div
                    key={pt.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200/80 dark:border-[#1F2937] bg-slate-50/50 dark:bg-[#1F2937]/30 hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#334155] flex items-center justify-center text-blue-600 font-bold">
                        {pt.type === "mesa"
                          ? "🪑"
                          : pt.type === "balcao"
                          ? "☕"
                          : pt.type === "conta"
                          ? "🧾"
                          : pt.type === "delivery"
                          ? "📦"
                          : "⭐"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {pt.name}
                          </span>
                          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded font-semibold">
                            Ativo
                          </span>
                          {pt.isCustom && (
                            <span className="text-[10px] bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 rounded font-semibold">
                              Personalizado
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          {pt.url}
                        </span>
                      </div>
                    </div>

                    {/* Metrics & Actions */}
                    <div className="flex items-center gap-2 sm:gap-4 self-end sm:self-auto">
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {pt.reviewsCount} avaliações
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {pt.totalScans} scans ({pt.conversionRate})
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopy(pt.url)}
                        className="rounded-lg border border-slate-200 dark:border-[#334155] bg-white dark:bg-[#111827] p-2 hover:bg-slate-50 dark:hover:bg-[#1F2937] text-slate-600 dark:text-slate-300 cursor-pointer"
                        title="Copiar Link"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>

                      {pt.isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomPoint(pt.id)}
                          className="rounded-lg border border-red-200 dark:border-red-900/40 bg-white dark:bg-[#111827] p-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 cursor-pointer"
                          title="Remover ponto salvo"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tips / Strategic Insights Card */}
            <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-5 space-y-2">
              <div className="flex items-center gap-2 font-bold text-blue-900 dark:text-blue-300 text-sm">
                <span>💡 Dica de Reputação: Aumente o Volume de Avaliações</span>
              </div>
              <p className="text-xs leading-5 text-blue-800 dark:text-blue-200/90 m-0">
                Estabelecimentos que colocam o display com QR Code em todas as mesas aumentam o volume de avaliações espontâneas em até <strong>14 vezes</strong> nos primeiros 30 dias. Clientes satisfeitos avaliam no Google Maps e clientes com ressalvas falam diretamente com sua ouvidoria sem manchar sua nota pública.
              </p>
            </div>
          </div>
        </div>

        {/* Batch Generation Modal */}
        {batchModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
              onClick={() => setBatchModalOpen(false)}
            />
            <div className="relative z-50 w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#334155] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#1F2937]">
                <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Gerar Lote de QR Codes para Mesas
                </span>
                <button
                  type="button"
                  onClick={() => setBatchModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gera cartões numerados sequencialmente (ex: Mesa 1 até Mesa {batchCount}) prontos para impressão ou corte em acrílico.
              </p>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Quantidade total de mesas no salão:
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={batchCount}
                  onChange={(e) => setBatchCount(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-[#334155] bg-white dark:bg-[#1F2937] p-2.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isGeneratingBatch}
                  onClick={() => setBatchModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isGeneratingBatch}
                  onClick={handleGenerateAndPrintBatch}
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white shadow-xs"
                >
                  {isGeneratingBatch ? "Gerando..." : "Gerar e Imprimir Lote (PDF)"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Printable Area - Activated only during window.print() via CSS */}
      <div id="printable-area" className="hidden">
        {printMode === "single" ? (
          /* Single Display Stand Print Sheet */
          <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-white text-slate-900 font-sans">
            <div className="w-full max-w-[420px] rounded-3xl border-4 border-slate-900 p-8 text-center flex flex-col items-center space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xl font-bold">
                  ★
                </div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 m-0">
                  {companyName}
                </h1>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-black tracking-widest text-blue-600 uppercase">
                  Sua opinião vale muito
                </p>
                <h2 className="text-lg font-bold text-slate-800">
                  Avalie nosso atendimento em 15 segundos
                </h2>
              </div>

              {qrDataUrl && (
                <div className="p-4 bg-white rounded-2xl border-2 border-slate-300">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="QR Code"
                    className="w-56 h-56 object-contain"
                  />
                </div>
              )}

              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-700">
                  Aponte a câmera do seu celular para o QR Code acima
                </p>
                {selectedType === "mesa" && tableNumber.trim() && (
                  <p className="text-sm font-bold text-blue-600">
                    Mesa {tableNumber.trim()}
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200 w-full text-[11px] text-slate-400 font-medium">
                Avaliações auditadas por Review14 • feedback em tempo real
              </div>
            </div>
          </div>
        ) : (
          /* Batch Grid Cards Print Sheet */
          <div className="p-4 bg-white text-slate-900 font-sans">
            <div className="text-center mb-6">
              <h1 className="text-xl font-black text-slate-900">{companyName}</h1>
              <p className="text-xs text-slate-500">
                Cartões de Mesa para Display / Acrílico • Mesas 1 a {batchItems.length}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {batchItems.map((item) => (
                <div
                  key={item.table}
                  className="rounded-2xl border-2 border-dashed border-slate-400 p-5 flex flex-col items-center text-center space-y-3 break-inside-avoid"
                  style={{ pageBreakInside: "avoid" }}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                      ★
                    </div>
                    <span className="font-bold text-sm text-slate-900">{companyName}</span>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1 text-xs font-black text-blue-700">
                    MESA {item.table}
                  </div>

                  {item.qrUrl && (
                    <div className="p-2 bg-white rounded-xl border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.qrUrl}
                        alt={`QR Code Mesa ${item.table}`}
                        className="w-36 h-36 object-contain"
                      />
                    </div>
                  )}

                  <p className="text-[10px] font-semibold text-slate-600 leading-tight">
                    Aponte a câmera do celular para avaliar nosso atendimento
                  </p>
                  <span className="text-[9px] text-slate-400">Powered by Review14</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
