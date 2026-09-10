"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale } from "@/components/locale-provider";

export default function AdminLoginPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setSubmitting(false);
    if (res?.error) {
      setError(t("admin.login.invalid"));
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#f7f5f1] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <BrandLogo />
        </div>
        <div className="flex justify-end mb-3">
          <LanguageSwitcher />
        </div>
        <div className="bg-white border border-[#eae5dc] rounded-2xl p-[22px]">
          <h1 className="text-lg font-bold text-[#1a1714] mb-1">{t("admin.login.title")}</h1>
          <form onSubmit={handleSubmit} className="space-y-2.5 mt-4">
            <input
              type="text"
              placeholder={t("admin.login.username")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-[#e6e0d6] rounded-xl px-3.5 py-3 bg-[#f7f5f1] placeholder:text-[#a39a8e]"
            />
            <input
              type="password"
              placeholder={t("admin.login.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-[#e6e0d6] rounded-xl px-3.5 py-3 bg-[#f7f5f1] placeholder:text-[#a39a8e]"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#1a1714] text-white rounded-xl px-4 py-[13px] font-semibold disabled:opacity-50 mt-1"
            >
              {submitting ? t("admin.login.signingIn") : t("admin.login.signIn")}
            </button>
            {error && <p className="text-sm text-[#b3402e]">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
