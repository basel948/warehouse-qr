"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale } from "@/components/locale-provider";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";

function ResetPasswordForm() {
  const { t } = useLocale();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t("admin.passwordReset.tooShort", { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setError(t("admin.passwordReset.mismatch"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setDone(true);
      else if (data.error === "password_too_short")
        setError(t("admin.passwordReset.tooShort", { min: MIN_PASSWORD_LENGTH }));
      else if (data.error === "invalid_token") setError(t("admin.passwordReset.invalidLink"));
      else setError(t("admin.passwordReset.genericError"));
    } catch {
      setError(t("admin.passwordReset.genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return <p className="text-sm text-[#b3402e] mt-3">{t("admin.passwordReset.invalidLink")}</p>;
  }

  if (done) {
    return (
      <div className="mt-3 space-y-3">
        <p className="text-sm text-[#2f6b3a] font-semibold">{t("admin.passwordReset.done")}</p>
        <Link
          href="/admin/login"
          className="block text-center w-full bg-[#1a1714] text-white rounded-xl px-4 py-[13px] font-semibold"
        >
          {t("admin.login.signIn")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5 mt-3">
      <input
        type="password"
        autoComplete="new-password"
        placeholder={t("admin.passwordReset.newPassword", { min: MIN_PASSWORD_LENGTH })}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full border border-[#e6e0d6] rounded-xl px-3.5 py-3 bg-[#f7f5f1] placeholder:text-[#a39a8e]"
      />
      <input
        type="password"
        autoComplete="new-password"
        placeholder={t("admin.passwordReset.confirmPassword")}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="w-full border border-[#e6e0d6] rounded-xl px-3.5 py-3 bg-[#f7f5f1] placeholder:text-[#a39a8e]"
      />
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-[#1a1714] text-white rounded-xl px-4 py-[13px] font-semibold disabled:opacity-50 mt-1"
      >
        {submitting ? t("admin.passwordReset.saving") : t("admin.passwordReset.save")}
      </button>
      {error && <p className="text-sm text-[#b3402e]">{error}</p>}
    </form>
  );
}

export default function AdminResetPasswordPage() {
  const { t } = useLocale();
  return (
    <div className="min-h-screen bg-[#f7f5f1] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <BrandLogo />
          <LanguageSwitcher />
        </div>
        <div className="bg-white border border-[#eae5dc] rounded-2xl p-[22px]">
          <h1 className="text-lg font-bold text-[#1a1714] mb-1">{t("admin.passwordReset.resetTitle")}</h1>
          {/* useSearchParams needs a Suspense boundary to build. */}
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
