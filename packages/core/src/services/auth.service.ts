import { supabaseAdmin } from "../db/client";
import { AuthProvider, Role, User } from "@prisma/client";
import crypto from "crypto";

export interface UpsertGlobalUserInput {
  email: string;
  name: string;
  avatarUrl?: string | null;
  authProvider: AuthProvider;
  providerId?: string | null;
}

export class AuthService {
  /**
   * Garante a criação ou reaproveitamento da Conta Global do usuário no Supabase
   * Sem duplicar o registro entre diferentes estabelecimentos visitados
   */
  static async upsertGlobalUser(data: UpsertGlobalUserInput): Promise<User> {
    const emailNormalized = data.email.toLowerCase().trim();
    const now = new Date().toISOString();

    const { data: existingUser } = await supabaseAdmin
      .from("User")
      .select("*")
      .eq("email", emailNormalized)
      .maybeSingle();

    if (existingUser) {
      const { data: updated, error } = await supabaseAdmin
        .from("User")
        .update({
          name: data.name,
          avatarUrl: data.avatarUrl ?? existingUser.avatarUrl,
          authProvider: data.authProvider,
          providerId: data.providerId ?? existingUser.providerId,
          updatedAt: now,
        })
        .eq("id", existingUser.id)
        .select()
        .single();

      if (error) {
        console.error("Erro ao atualizar usuário global:", error.message);
        throw error;
      }
      return updated as User;
    }

    const userId = crypto.randomUUID();
    const { data: created, error } = await supabaseAdmin
      .from("User")
      .insert({
        id: userId,
        email: emailNormalized,
        name: data.name,
        avatarUrl: data.avatarUrl || null,
        authProvider: data.authProvider,
        providerId: data.providerId || null,
        role: Role.CUSTOMER,
        createdAt: now,
        updatedAt: now,
      })
      .select()
      .single();

    if (error) {
      console.error("Erro ao criar usuário global:", error.message);
      throw error;
    }

    return created as User;
  }

  /**
   * Envia ou gera um código numérico OTP para autenticação via Supabase
   */
  static async generateOtpCode(email: string): Promise<string> {
    const emailNormalized = email.toLowerCase().trim();

    try {
      // Dispara o OTP oficial pelo Supabase Auth
      await supabaseAdmin.auth.signInWithOtp({
        email: emailNormalized,
        options: {
          shouldCreateUser: true,
        },
      });
    } catch (authErr) {
      console.warn("Supabase Auth OTP dispatch warning:", authErr);
    }

    // Gera e salva código local de 6 dígitos para compatibilidade de rotinas
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    try {
      await supabaseAdmin
        .from("VerificationCode")
        .update({ used: true })
        .eq("email", emailNormalized)
        .eq("used", false);

      await supabaseAdmin.from("VerificationCode").insert({
        id: crypto.randomUUID(),
        email: emailNormalized,
        code,
        expiresAt,
        used: false,
        createdAt: now,
      });
    } catch (dbErr) {
      console.warn("VerificationCode table write notice:", dbErr);
    }

    return code;
  }

  /**
   * Valida o código OTP informado pelo cliente
   */
  static async verifyOtpCode(email: string, code: string): Promise<boolean> {
    const emailNormalized = email.toLowerCase().trim();
    const trimmedCode = code.trim();

    // 1. Tenta validar no Supabase Auth nativo
    try {
      const { data, error } = await supabaseAdmin.auth.verifyOtp({
        email: emailNormalized,
        token: trimmedCode,
        type: "email",
      });

      if (!error && data.session) {
        return true;
      }
    } catch {}

    // 2. Fallback na tabela VerificationCode caso o ambiente use OTP interno
    try {
      const { data: record } = await supabaseAdmin
        .from("VerificationCode")
        .select("id, expiresAt, used")
        .eq("email", emailNormalized)
        .eq("code", trimmedCode)
        .eq("used", false)
        .order("createdAt", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (record && new Date(record.expiresAt) > new Date()) {
        await supabaseAdmin
          .from("VerificationCode")
          .update({ used: true })
          .eq("id", record.id);
        return true;
      }
    } catch {}

    return false;
  }
}
