import { supabase, supabaseAdmin } from "../db/client";
import { CreateReviewInput, ReplyReviewInput } from "../schemas/review.schema";
import { LeadService } from "./lead.service";

export interface ReviewTriageResult {
  reviewId: string;
  overallRating: number;
  redirectToGoogle: boolean;
  googleReviewUrl: string | null;
  message: string;
}

export class ReviewService {
  /**
   * Submete a avaliação no Supabase e realiza a triagem inteligente:
   * >= 4 estrelas: direciona para o Google Meu Negócio
   * < 4 estrelas: retém internamente para ouvidoria e contato preventivo
   */
  static async submitReview(input: CreateReviewInput): Promise<ReviewTriageResult> {
    const { data: company, error: companyErr } = await supabaseAdmin
      .from("Company")
      .select("id, googlePlaceId, minRatingForGoogle, tradeName")
      .eq("id", input.companyId)
      .single();

    if (companyErr || !company) {
      throw new Error("Empresa não encontrada");
    }

    const minRating = company.minRatingForGoogle ?? 4;
    const isPromoter = input.overallRating >= minRating;
    const reviewId = crypto.randomUUID();
    const now = new Date().toISOString();

    // 1. Salva a avaliação na tabela Review
    const { error: reviewErr } = await supabaseAdmin
      .from("Review")
      .insert({
        id: reviewId,
        overallRating: input.overallRating,
        comment: input.comment || null,
        isAnonymous: input.isAnonymous,
        anonymousName: input.isAnonymous ? (input.anonymousName || "Cliente Anônimo") : null,
        anonymousAvatar: input.isAnonymous ? (input.anonymousAvatar || null) : null,
        userId: input.userId ?? null,
        companyId: input.companyId,
        isPublic: isPromoter,
        isResolved: isPromoter,
        createdAt: now,
        updatedAt: now,
      });

    if (reviewErr) {
      console.error("Erro ao salvar Review:", reviewErr.message);
      throw new Error(`Falha ao salvar avaliação: ${reviewErr.message}`);
    }

    // 2. Salva mídias enviadas (ReviewMedia)
    if (input.media && input.media.length > 0) {
      const mediaRecords = input.media.map((m) => ({
        id: crypto.randomUUID(),
        reviewId,
        url: m.url,
        fileKey: m.fileKey || m.url,
        type: m.type || "IMAGE",
        sizeBytes: m.sizeBytes ?? null,
        createdAt: now,
      }));

      const { error: mediaErr } = await supabaseAdmin
        .from("ReviewMedia")
        .insert(mediaRecords);

      if (mediaErr) {
        console.error("Erro ao vincular mídia da avaliação:", mediaErr.message);
      }
    }

    // 3. Salva respostas personalizadas aos campos PRO (CustomAnswer)
    if (input.customAnswers && input.customAnswers.length > 0) {
      const answerRecords = input.customAnswers.map((a) => ({
        id: crypto.randomUUID(),
        reviewId,
        customFieldId: a.customFieldId,
        ratingValue: a.ratingValue ?? null,
        textValue: a.textValue ?? null,
        selectedItems: a.selectedItems ?? null,
        createdAt: now,
      }));

      const { error: answersErr } = await supabaseAdmin
        .from("CustomAnswer")
        .insert(answerRecords);

      if (answersErr) {
        console.error("Erro ao salvar respostas customizadas:", answersErr.message);
      }
    }

    // 4. Se o cliente estiver autenticado, alimenta o CRM (CustomerLead) automaticamente
    if (input.userId) {
      try {
        await LeadService.linkCustomerToCompany(input.companyId, input.userId);
      } catch (leadErr) {
        console.warn("Aviso ao vincular Lead:", leadErr);
      }
    }

    // 5. Monta link do Google Meu Negócio se qualificado
    let googleReviewUrl: string | null = null;
    if (isPromoter && company.googlePlaceId) {
      googleReviewUrl = `https://search.google.com/local/writereview?placeid=${company.googlePlaceId}`;
    }

    return {
      reviewId,
      overallRating: input.overallRating,
      redirectToGoogle: isPromoter,
      googleReviewUrl,
      message: isPromoter
        ? "Ficamos muito felizes que sua experiência foi excelente! Que tal compartilhar no Google?"
        : "Agradecemos seu feedback sincero. Nosso time já foi notificado e trabalhará para resolver qualquer ponto pendente.",
    };
  }

  /**
   * Feed social público da loja (estilo Instagram)
   */
  static async getPublicFeed(companyId: string, limit = 20) {
    const { data, error } = await supabase
      .from("Review")
      .select(`
        *,
        media:ReviewMedia (*),
        user:User (name, avatarUrl),
        customAnswers:CustomAnswer (
          *,
          customField:CustomField (*)
        )
      `)
      .eq("companyId", companyId)
      .eq("isPublic", true)
      .order("createdAt", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Erro ao buscar feed público:", error.message);
      throw error;
    }

    return data || [];
  }

  /**
   * Histórico de avaliações do cliente final
   */
  static async getCustomerReviews(userId: string) {
    const { data, error } = await supabase
      .from("Review")
      .select(`
        *,
        company:Company (
          tradeName,
          slug,
          logoUrl,
          city,
          state
        ),
        media:ReviewMedia (*)
      `)
      .eq("userId", userId)
      .order("createdAt", { ascending: false });

    if (error) {
      console.error("Erro ao buscar histórico do cliente:", error.message);
      throw error;
    }

    return data || [];
  }

  /**
   * Resposta do lojista a uma avaliação (ouvidoria)
   */
  static async replyReview(input: ReplyReviewInput) {
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("Review")
      .update({
        merchantReply: input.merchantReply,
        repliedAt: now,
        isResolved: true,
        updatedAt: now,
      })
      .eq("id", input.reviewId)
      .select()
      .single();

    if (error) {
      console.error("Erro ao responder avaliação:", error.message);
      throw error;
    }

    return data;
  }
}
