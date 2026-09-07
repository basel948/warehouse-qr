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
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between gap-3 mb-6">
          <BrandLogo />
          <LanguageSwitcher />
        </div>
        <div className="bg-white border border-stone-200 rounded-lg p-6">
          <h1 className="text-lg font-bold text-stone-900 mb-4">{t("admin.login.title")}</h1>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              placeholder={t("admin.login.username")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-stone-300 rounded px-3 py-2"
            />
            <input
              type="password"
              placeholder={t("admin.login.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-stone-300 rounded px-3 py-2"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-amber-600 text-white rounded px-4 py-2 font-semibold disabled:opacity-50"
            >
              {submitting ? t("admin.login.signingIn") : t("admin.login.signIn")}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
