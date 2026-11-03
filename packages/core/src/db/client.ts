import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://tacrpktefuolrgsnbkej.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhY3Jwa3RlZnVvbHJnc25ia2VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzMDMzOTksImV4cCI6MjEwODg3OTM5OX0.NKp80mNetlhuOblqLZh5iNQzOso4mqXftSCGzAF9Kq0";

const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

// Cliente público padrão Supabase
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: typeof window !== "undefined",
    autoRefreshToken: typeof window !== "undefined",
  },
});

// Cliente administrativo Supabase (para webhooks, CRM e rotinas server-side)
export const supabaseAdmin: SupabaseClient = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// Fallback Prisma Client para compatibilidade de tipos e migrações DDL
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Re-exporta enums e tipagens do PostgreSQL
export * from "@prisma/client";
