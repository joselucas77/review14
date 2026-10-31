"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@ui/components/button";
import { Badge } from "@ui/components/badge";
import { Textarea } from "@ui/components/textarea";
import { createClient } from "@/lib/supabase/client";

interface CompanyData {
  id: string;
  slug: string;
  tradeName: string;
  category: string;
  city?: string;
  state?: string;
  logoUrl?: string;
  planTier: string;
  minRatingForGoogle: number;
  googlePlaceId?: string;
  customRedirectUrl?: string;
}

interface CustomField {
  id: string;
  companyId: string;
  label: string;
  description?: string;
  fieldType: "RATING_5" | "SINGLE_SELECT" | "MULTI_SELECT" | "TEXT";
  options?: string[] | null;
  order: number;
  isActive: boolean;
}

export default function EvaluatePage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params.slug as string) || "estabelecimento";

  const [company, setCompany] = React.useState<CompanyData | null>(null);
  const [customFields, setCustomFields] = React.useState<CustomField[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Core Evaluation States
  const [overallRating, setOverallRating] = React.useState<number>(5);
  const [hoverRating, setHoverRating] = React.useState<number>(0);
  const [comment, setComment] = React.useState<string>("");

  // Dynamic Answers for Custom Fields
  const [fieldRatings, setFieldRatings] = React.useState<Record<string, number>>({});
  const [fieldSingleSelect, setFieldSingleSelect] = React.useState<Record<string, string>>({});
  const [fieldMultiSelect, setFieldMultiSelect] = React.useState<Record<string, string[]>>({});
  const [fieldText, setFieldText] = React.useState<Record<string, string>>({});

  // Photos
  const [photos, setPhotos] = React.useState<string[]>([]);

  // Load Company and Custom Fields from Supabase
  React.useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const supabase = createClient();

        // 1. Fetch Company
        const { data: compData, error: compErr } = await supabase
          .from("Company")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();

        if (compErr || !compData) {
          console.warn("Company not found for slug:", slug);
        } else {
          setCompany(compData);

          // 2. Fetch Active Custom Fields
          const { data: fieldsData, error: fieldsErr } = await supabase
            .from("CustomField")
            .select("*")
            .eq("companyId", compData.id)
            .eq("isActive", true)
            .order("order", { ascending: true });

          if (!fieldsErr && fieldsData) {
            setCustomFields(fieldsData);

            // Initialize default values for rating fields (default 5 stars)
            const initialRatings: Record<string, number> = {};
            fieldsData.forEach((f) => {
              if (f.fieldType === "RATING_5") {
                initialRatings[f.id] = 5;
              }
            });
            setFieldRatings(initialRatings);
          }
        }
      } catch (err) {
        console.error("Error loading evaluation page:", err);
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      loadData();
    }
  }, [slug]);

  // Display name formatting
  const storeDisplayName = React.useMemo(() => {
    if (company?.tradeName) return company.tradeName;
    return slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }, [company?.tradeName, slug]);

  const toggleMultiSelectOption = (fieldId: string, option: string) => {
    setFieldMultiSelect((prev) => {
      const current = prev[fieldId] || [];
      const updated = current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option];
      return { ...prev, [fieldId]: updated };
    });
  };

  const handleAddPhoto = () => {
    const samplePhotos = [
      "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=300&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&auto=format&fit=crop&q=80",
    ];
    if (photos.length < 5) {
      setPhotos([...photos, samplePhotos[photos.length % samplePhotos.length]]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const getRatingLabel = (val: number) => {
    switch (val) {
      case 5:
        return "Excelente experiência!";
      case 4:
        return "Muito bom!";
      case 3:
        return "Experiência razoável";
      case 2:
        return "Abaixo do esperado";
      case 1:
        return "Experiência ruim";
      default:
        return "Selecione uma nota";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (overallRating === 0) {
      alert("Por favor, selecione uma nota de 1 a 5 estrelas.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const reviewId = crypto.randomUUID();

      // Check stored auth or Supabase session
      let authUser: {
        isAnonymous?: boolean;
        name?: string;
        email?: string | null;
        avatarUrl?: string | null;
        userId?: string | null;
      } = {
        isAnonymous: true,
        name: "Cliente Verificado",
      };

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          authUser = {
            isAnonymous: false,
            name:
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              user.email?.split("@")[0] ||
              "Cliente Verificado",
            email: user.email,
            avatarUrl:
              user.user_metadata?.avatar_url ||
              user.user_metadata?.picture ||
              null,
            userId: user.id,
          };
        } else if (typeof window !== "undefined") {
          const storedAuth = sessionStorage.getItem("review_auth");
          if (storedAuth) {
            authUser = JSON.parse(storedAuth);
          }
        }
      } catch (authErr) {
        console.warn("Could not retrieve user info:", authErr);
      }

      const minGoogleRating = company?.minRatingForGoogle ?? 4;
      const isPromoter = overallRating >= minGoogleRating;

      // 1. Insert into Review table (if company exists)
      if (company?.id) {
        const { error: reviewError } = await supabase.from("Review").insert({
          id: reviewId,
          overallRating,
          comment: comment.trim() || null,
          companyId: company.id,
          isAnonymous: authUser.isAnonymous ?? true,
          anonymousName: authUser.name || "Cliente Verificado",
          anonymousAvatar: authUser.avatarUrl || null,
          userId: authUser.userId || null,
          isPublic: true,
          isResolved: isPromoter,
          updatedAt: new Date().toISOString(),
        });

        if (reviewError) {
          console.error("Error inserting review:", reviewError);
        }

        // 2. Insert Custom Answers
        if (customFields.length > 0) {
          const answersToInsert: Array<{
            id: string;
            reviewId: string;
            customFieldId: string;
            ratingValue: number | null;
            textValue: string | null;
            selectedItems: string[] | null;
          }> = [];

          for (const field of customFields) {
            let ratingValue: number | null = null;
            let textValue: string | null = null;
            let selectedItems: string[] | null = null;

            if (field.fieldType === "RATING_5") {
              ratingValue = fieldRatings[field.id] || null;
            } else if (field.fieldType === "TEXT") {
              textValue = fieldText[field.id]?.trim() || null;
            } else if (field.fieldType === "SINGLE_SELECT") {
              const selected = fieldSingleSelect[field.id];
              if (selected) {
                selectedItems = [selected];
              }
            } else if (field.fieldType === "MULTI_SELECT") {
              const selected = fieldMultiSelect[field.id];
              if (selected && selected.length > 0) {
                selectedItems = selected;
              }
            }

            if (ratingValue !== null || textValue !== null || selectedItems !== null) {
              answersToInsert.push({
                id: crypto.randomUUID(),
                reviewId,
                customFieldId: field.id,
                ratingValue,
                textValue,
                selectedItems,
              });
            }
          }

          if (answersToInsert.length > 0) {
            const { error: answersError } = await supabase
              .from("CustomAnswer")
              .insert(answersToInsert);

            if (answersError) {
              console.error("Error inserting answers:", answersError);
            }
          }
        }
      }

      // 3. Save to sessionStorage for Thanks page
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          "review_result",
          JSON.stringify({
            overallRating,
            comment,
            storeName: storeDisplayName,
            isPromoter,
            googlePlaceId: company?.googlePlaceId,
            customRedirectUrl: company?.customRedirectUrl,
          })
        );
      }

      router.push(`/${slug}/thanks`);
    } catch (err) {
      console.error("Unexpected submission error:", err);
      // Still proceed to thanks page gracefully
      router.push(`/${slug}/thanks`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayRating = hoverRating || overallRating;

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F8FAFC] text-[#0F172A] antialiased">
      <div className="mx-auto flex w-full max-w-[390px] flex-col gap-3.5 px-5 py-6">
        {/* Header com Identidade do Estabelecimento */}
        <div className="flex flex-col items-center gap-3.5 pt-2 text-center">
          <div className="flex flex-col items-center gap-2">
            {/* Ícone do Estabelecimento */}
            <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-[18px] border-[1.5px] border-[#E2E8F0] bg-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)] overflow-hidden">
              {company?.logoUrl ? (
                <img
                  src={company.logoUrl}
                  alt={storeDisplayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                >
                  <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                  <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                  <line x1="6" y1="1" x2="6" y2="4" />
                  <line x1="10" y1="1" x2="10" y2="4" />
                  <line x1="14" y1="1" x2="14" y2="4" />
                </svg>
              )}
            </div>

            {/* Nome com Badge de Verificado */}
            <div className="flex items-center gap-1.5">
              <h1 className="text-[22px] font-bold tracking-tight text-[#0F172A]">
                {storeDisplayName}
              </h1>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="#2563EB"
                stroke="#2563EB"
                className="shrink-0"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>

            <div className="text-[13px] text-[#64748B]">
              {company?.category || "Estabelecimento Parceiro"}
              {company?.city ? ` • ${company.city}` : ""}
              {company?.state ? `, ${company.state}` : ""}
            </div>
          </div>

          <div className="flex flex-col gap-1 pt-1">
            <h2 className="text-[18px] font-semibold text-[#0F172A]">
              Como foi sua experiência?
            </h2>
            <p className="max-w-[320px] text-[14px] leading-relaxed text-[#475569]">
              Sua opinião sincera ajuda o {storeDisplayName} a melhorar continuamente.
            </p>
          </div>
        </div>

        {/* Formulário de Avaliação */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 pt-1">
          {/* Cartão de Seleção de Estrelas Geral */}
          <div className="flex flex-col items-center gap-2 rounded-[14px] border border-[#E2E8F0] bg-white px-3 py-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setOverallRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="flex h-12 w-12 shrink-0 items-center justify-center transition-transform hover:scale-110 active:scale-95"
                  aria-label={`${star} estrelas`}
                >
                  <svg
                    width="38"
                    height="38"
                    viewBox="0 0 24 24"
                    fill={star <= displayRating ? "#F59E0B" : "none"}
                    stroke={star <= displayRating ? "#F59E0B" : "#CBD5E1"}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[15px] font-bold text-[#0F172A]">
                {displayRating.toFixed(1)}
              </span>
              <Badge variant="success">{getRatingLabel(displayRating)}</Badge>
            </div>
          </div>

          {/* Campo de Comentário */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="comment-input"
                className="text-[14px] font-semibold text-[#0F172A]"
              >
                Conte como foi sua experiência
              </label>
              <span className="text-[12px] text-[#64748B]">Opcional</span>
            </div>
            <div className="flex min-h-[96px] flex-col justify-between rounded-[10px] border-[1.5px] border-[#CBD5E1] bg-white p-3 shadow-sm transition focus-within:border-[#2563EB] focus-within:ring-1 focus-within:ring-[#2563EB]">
              <Textarea
                id="comment-input"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 500))}
                placeholder="Conte sobre o atendimento, qualidade, ambiente ou tempo de espera..."
                className="min-h-[60px] border-none p-0 text-[15px] shadow-none focus-visible:ring-0 placeholder:text-slate-400"
              />
              <div className="flex justify-end pt-2 text-[11px] text-[#94A3B8]">
                {comment.length} / 500
              </div>
            </div>
          </div>

          {/* Fotos da Visita */}
          <div className="flex flex-col gap-2">
            <span className="text-[14px] font-semibold text-[#0F172A]">
              Fotos da visita
            </span>
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
              {/* Botão de Adicionar */}
              <button
                type="button"
                onClick={handleAddPhoto}
                className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-[10px] border-[1.5px] border-dashed border-[#3B82F6] bg-[#EFF6FF] text-[#2563EB] transition hover:bg-blue-100/70"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span className="text-[11px] font-semibold">Adicionar</span>
              </button>

              {/* Thumbnails Adicionadas */}
              {photos.map((src, idx) => (
                <div
                  key={idx}
                  className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-slate-100 shadow-sm"
                >
                  <img
                    src={src}
                    alt={`Foto ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute right-1 top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#DC2626] text-white shadow-sm hover:scale-105"
                    aria-label="Remover foto"
                  >
                    <svg
                      width="8"
                      height="8"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Seção Dinâmica de Perguntas Personalizadas (PRO) */}
          {customFields.length > 0 && (
            <div className="flex flex-col gap-4 pt-1">
              {/* Divisor com Selo Centralizado */}
              <div className="flex items-center gap-2">
                <div className="h-[1px] flex-1 bg-[#E2E8F0]" />
                <Badge variant="brand" className="gap-1.5 py-1">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="2.5"
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span className="text-[11px] font-bold tracking-wide">
                    PERGUNTAS DO ESTABELECIMENTO
                  </span>
                </Badge>
                <div className="h-[1px] flex-1 bg-[#E2E8F0]" />
              </div>

              {customFields.map((field) => (
                <div
                  key={field.id}
                  className="flex flex-col gap-2.5 rounded-[12px] border border-[#E2E8F0] bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                >
                  <span className="text-[14px] font-semibold text-[#0F172A]">
                    {field.label}
                  </span>
                  {field.description && (
                    <span className="text-[12px] text-[#64748B]">
                      {field.description}
                    </span>
                  )}

                  {/* 1. Tipo RATING_5 */}
                  {field.fieldType === "RATING_5" && (
                    <div className="flex items-center gap-3 pt-1">
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const currentVal = fieldRatings[field.id] || 0;
                          return (
                            <button
                              key={star}
                              type="button"
                              onClick={() =>
                                setFieldRatings((prev) => ({
                                  ...prev,
                                  [field.id]: star,
                                }))
                              }
                              className="flex h-9 w-9 shrink-0 items-center justify-center transition hover:scale-110 active:scale-95"
                            >
                              <svg
                                width="26"
                                height="26"
                                viewBox="0 0 24 24"
                                fill={star <= currentVal ? "#F59E0B" : "none"}
                                stroke={star <= currentVal ? "#F59E0B" : "#CBD5E1"}
                                strokeWidth="2"
                              >
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                            </button>
                          );
                        })}
                      </div>
                      <span className="text-[13px] font-bold text-[#2563EB]">
                        {fieldRatings[field.id] ? `${fieldRatings[field.id]} / 5` : "Não avaliado"}
                      </span>
                    </div>
                  )}

                  {/* 2. Tipo SINGLE_SELECT */}
                  {field.fieldType === "SINGLE_SELECT" && field.options && (
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {field.options.map((option) => {
                        const isSelected = fieldSingleSelect[field.id] === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() =>
                              setFieldSingleSelect((prev) => ({
                                ...prev,
                                [field.id]: option,
                              }))
                            }
                            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] transition ${
                              isSelected
                                ? "border-[1.5px] border-[#2563EB] bg-[#EFF6FF] font-semibold text-[#1D4ED8]"
                                : "border border-[#E2E8F0] bg-[#F8FAFC] font-medium text-[#475569] hover:bg-slate-100"
                            }`}
                          >
                            {isSelected && (
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#2563EB"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 3. Tipo MULTI_SELECT */}
                  {field.fieldType === "MULTI_SELECT" && field.options && (
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {field.options.map((option) => {
                        const selectedList = fieldMultiSelect[field.id] || [];
                        const isSelected = selectedList.includes(option);
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => toggleMultiSelectOption(field.id, option)}
                            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] transition ${
                              isSelected
                                ? "border-[1.5px] border-[#2563EB] bg-[#EFF6FF] font-semibold text-[#1D4ED8]"
                                : "border border-[#E2E8F0] bg-[#F8FAFC] font-medium text-[#475569] hover:bg-slate-100"
                            }`}
                          >
                            {isSelected && (
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#2563EB"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 4. Tipo TEXT */}
                  {field.fieldType === "TEXT" && (
                    <div className="rounded-[8px] border border-[#CBD5E1] bg-[#F8FAFC] p-2.5">
                      <Textarea
                        rows={2}
                        value={fieldText[field.id] || ""}
                        onChange={(e) =>
                          setFieldText((prev) => ({
                            ...prev,
                            [field.id]: e.target.value,
                          }))
                        }
                        placeholder="Digite sua resposta..."
                        className="border-none bg-transparent p-0 text-[14px] shadow-none focus-visible:ring-0 placeholder:text-slate-400"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Botão de Enviar e Proteção Review14 */}
          <div className="flex flex-col gap-2.5 pt-2">
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              fullWidth
              className="gap-2 shadow-[0_4px_6px_-1px_rgba(37,99,235,0.25)] font-semibold text-[16px]"
            >
              <span>{isSubmitting ? "Enviando avaliação..." : "Enviar avaliação"}</span>
              {!isSubmitting && (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
            </Button>

            <div className="flex items-center justify-center gap-1.5 text-center text-[#64748B]">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span className="text-[11px]">
                Sua avaliação é protegida e moderada pela Review14
              </span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
