"use client";

import * as React from "react";
import { Card } from "@ui/components/card";
import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { Label } from "@ui/components/label";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@ui/components/sonner";

interface EmailLoginCardProps {
  onBackToOptions: () => void;
  onGoToRegister: () => void;
  onSubmit?: (data: { email: string; password: string }) => void;
}

export function EmailLoginCard({
  onBackToOptions,
  onGoToRegister,
  onSubmit,
}: EmailLoginCardProps) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  // Forgot Password Modal State
  const [forgotModalOpen, setForgotModalOpen] = React.useState(false);
  const [resetEmail, setResetEmail] = React.useState("");
  const [isSendingReset, setIsSendingReset] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    if (onSubmit) {
      onSubmit({ email, password });
    }
  };

  const handleSendResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = resetEmail.trim() || email.trim();
    if (!targetEmail) {
      toast.warning("Por favor, informe seu e-mail para receber o link de recuperação.");
      return;
    }

    setIsSendingReset(true);
    try {
      const supabase = createClient();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${origin}/auth/callback?next=/my-reviews`,
      });

      if (error) {
        toast.error(error.message || "Erro ao solicitar recuperação de senha.");
      } else {
        toast.success("Instruções de redefinição de senha enviadas para seu e-mail!");
        setForgotModalOpen(false);
      }
    } catch (err: any) {
      console.error("Erro na recuperação de senha:", err);
      toast.error("Não foi possível enviar o e-mail de recuperação.");
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Back button */}
      <div>
        <button
          type="button"
          onClick={onBackToOptions}
          className="inline-flex items-center text-[13px] font-semibold text-[#2563EB] hover:underline cursor-pointer"
        >
          ← Voltar para opções
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] shadow-[0_2px_4px_rgba(37,99,235,0.25)]">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>
        <h1 className="text-[20px] font-bold leading-6 text-[#0F172A]">
          Entrar com e-mail
        </h1>
        <p className="text-[13px] text-[#64748B]">
          Informe seus dados de acesso ao Review14
        </p>
      </div>

      {/* Card Form */}
      <Card className="border-[#E2E8F0] bg-white p-5 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.04)]">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Email Field */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email-input">E-mail</Label>
            <Input
              id="email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@exemplo.com"
              required
              className="h-[46px] border-[#CBD5E1]"
            />
          </div>

          {/* Password Field */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password-input">Senha</Label>
              <button
                type="button"
                onClick={() => {
                  setResetEmail(email);
                  setForgotModalOpen(true);
                }}
                className="text-[12px] font-semibold text-[#2563EB] hover:underline cursor-pointer"
              >
                Esqueceu?
              </button>
            </div>
            <div className="relative flex items-center">
              <Input
                id="password-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="h-[46px] border-[#CBD5E1] pr-10 tracking-[0.1em]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-[#64748B] hover:text-[#0F172A]"
                aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
              >
                {showPassword ? (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            size="lg"
            fullWidth
            className="mt-1 shadow-[0_4px_6px_-1px_rgba(37,99,235,0.25)] font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
          >
            {loading ? "Entrando..." : "Entrar na conta"}
          </Button>
        </form>
      </Card>

      {/* Footer link to register */}
      <div className="flex items-center justify-center gap-1 text-center">
        <span className="text-[13px] text-[#475569]">Ainda não tem conta?</span>
        <button
          type="button"
          onClick={onGoToRegister}
          className="text-[13px] font-semibold text-[#2563EB] hover:underline cursor-pointer"
        >
          Criar conta no Review14
        </button>
      </div>

      {/* Modal: Recuperação de Senha */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setForgotModalOpen(false)}
          />
          <div className="relative z-50 w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-900">
                Recuperação de Senha
              </span>
              <button
                type="button"
                onClick={() => setForgotModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Digite seu e-mail cadastrado e enviaremos um link seguro para você criar uma nova senha.
            </p>

            <form onSubmit={handleSendResetPassword} className="space-y-3">
              <div className="space-y-1 text-left">
                <Label htmlFor="reset-email" className="text-xs">E-mail</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  required
                  className="h-10 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForgotModalOpen(false)}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSendingReset}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
                >
                  {isSendingReset ? "Enviando..." : "Enviar Link de Recuperação"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
