"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale } from "@/components/locale-provider";

export default function AdminForgotPasswordPage() {
  const { t } = useLocale();
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      if (res.status === 429) setError(t("admin.passwordReset.tooManyRequests"));
      else if (!res.ok) setError(t("admin.passwordReset.genericError"));
      else setSent(true);
    } catch {
      setError(t("admin.passwordReset.genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f5f1] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <BrandLogo />
          <LanguageSwitcher />
        </div>
        <div className="bg-white border border-[#eae5dc] rounded-2xl p-[22px]">
          <h1 className="text-lg font-bold text-[#1a1714] mb-1">{t("admin.passwordReset.forgotTitle")}</h1>
          {sent ? (
            <p className="text-sm text-[#4a443c] mt-3 leading-relaxed">{t("admin.passwordReset.sent")}</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-2.5 mt-3">
              <p className="text-sm text-[#6b6259]">{t("admin.passwordReset.forgotHint")}</p>
              <input
                type="text"
                autoComplete="username"
                placeholder={t("admin.login.username")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-[#e6e0d6] rounded-xl px-3.5 py-3 bg-[#f7f5f1] placeholder:text-[#a39a8e]"
              />
              <button
                type="submit"
                disabled={submitting || !username.trim()}
                className="w-full bg-[#1a1714] text-white rounded-xl px-4 py-[13px] font-semibold disabled:opacity-50 mt-1"
              >
                {submitting ? t("admin.passwordReset.sending") : t("admin.passwordReset.sendLink")}
              </button>
              {error && <p className="text-sm text-[#b3402e]">{error}</p>}
            </form>
          )}
          <Link href="/admin/login" className="block text-sm text-[#6b6259] underline mt-4">
            {t("admin.passwordReset.backToLogin")}
          </Link>
        </div>
      </div>
    </div>
  );
}
