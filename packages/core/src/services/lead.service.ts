import { supabaseAdmin } from "../db/client";

export class LeadService {
  /**
   * Vincula o cliente avaliador ao CRM da empresa visitada no Supabase
   * Se já existia, atualiza a última visita e incrementa total de reviews
   */
  static async linkCustomerToCompany(
    companyId: string,
    userId: string,
    marketingOptIn = true
  ) {
    const { data: existingLead, error: findError } = await supabaseAdmin
      .from("CustomerLead")
      .select("id, totalReviews, marketingOptIn")
      .eq("companyId", companyId)
      .eq("userId", userId)
      .maybeSingle();

    if (findError) {
      console.warn("Aviso ao buscar CustomerLead existente:", findError.message);
    }

    const now = new Date().toISOString();

    if (existingLead) {
      const currentReviews = typeof existingLead.totalReviews === "number" ? existingLead.totalReviews : 1;
      const { data, error } = await supabaseAdmin
        .from("CustomerLead")
        .update({
          totalReviews: currentReviews + 1,
          lastVisitedAt: now,
          updatedAt: now,
          marketingOptIn: marketingOptIn || existingLead.marketingOptIn,
        })
        .eq("id", existingLead.id)
        .select()
        .single();

      if (error) {
        console.error("Erro ao atualizar CustomerLead:", error.message);
        throw error;
      }
      return data;
    }

    const leadId = crypto.randomUUID();
    const { data, error } = await supabaseAdmin
      .from("CustomerLead")
      .insert({
        id: leadId,
        companyId,
        userId,
        marketingOptIn,
        totalReviews: 1,
        lastVisitedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (error) {
      console.error("Erro ao criar CustomerLead:", error.message);
      throw error;
    }

    return data;
  }

  /**
   * Retorna os leads do lojista com dados dos usuários via Supabase
   */
  static async getCompanyLeads(companyId: string, search?: string) {
    const { data, error } = await supabaseAdmin
      .from("CustomerLead")
      .select(`
        id,
        companyId,
        userId,
        marketingOptIn,
        totalReviews,
        notes,
        lastVisitedAt,
        createdAt,
        updatedAt,
        user:User (
          id,
          name,
          email,
          avatarUrl,
          phone,
          city,
          state,
          createdAt
        )
      `)
      .eq("companyId", companyId)
      .order("lastVisitedAt", { ascending: false });

    if (error) {
      console.error("Erro ao buscar leads da empresa:", error.message);
      throw error;
    }

    if (!data) return [];

    if (search && search.trim()) {
      const term = search.toLowerCase().trim();
      return data.filter((lead: any) => {
        const u = lead.user;
        if (!u) return false;
        return (
          u.name?.toLowerCase().includes(term) ||
          u.email?.toLowerCase().includes(term) ||
          u.phone?.includes(term)
        );
      });
    }

    return data;
  }
}
