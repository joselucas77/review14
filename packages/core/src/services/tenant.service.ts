import { supabase, supabaseAdmin } from "../db/client";
import { CreateCompanyInput, UpdateCompanySettingsInput } from "../schemas/company.schema";

export class TenantService {
  /**
   * Busca a empresa pelo slug para a tela de avaliação do cliente
   * e inclui os campos customizados ativos
   */
  static async getCompanyBySlug(slug: string) {
    const { data, error } = await supabase
      .from("Company")
      .select(`
        *,
        customFields:CustomField (*)
      `)
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar empresa por slug:", error.message);
      throw error;
    }

    if (!data) return null;

    // Filtra e ordena campos customizados ativos caso existam
    if (Array.isArray(data.customFields)) {
      data.customFields = data.customFields
        .filter((field: any) => field.isActive !== false)
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
    }

    return data;
  }

  /**
   * Verifica se a empresa está no plano PRO ativo
   */
  static async isProTier(companyId: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from("Company")
      .select("planTier, subscriptionStatus")
      .eq("id", companyId)
      .maybeSingle();

    if (error || !data) return false;

    return (
      data.planTier === "PRO" &&
      (data.subscriptionStatus === "ACTIVE" ||
        data.subscriptionStatus === "TRIALING")
    );
  }

  /**
   * Criação de nova empresa no onboarding
   */
  static async createCompany(
    ownerId: string,
    data: CreateCompanyInput
  ) {
    const companyId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { data: created, error } = await supabaseAdmin
      .from("Company")
      .insert({
        id: companyId,
        ownerId,
        ...data,
        legalName: data.legalName || data.tradeName,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (error) {
      console.error("Erro ao criar empresa:", error.message);
      throw error;
    }

    return created;
  }

  /**
   * Atualização das configurações pelo lojista
   */
  static async updateSettings(
    companyId: string,
    data: UpdateCompanySettingsInput
  ) {
    const { data: updated, error } = await supabaseAdmin
      .from("Company")
      .update({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", companyId)
      .select()
      .single();

    if (error) {
      console.error("Erro ao atualizar configurações da empresa:", error.message);
      throw error;
    }

    return updated;
  }
}
