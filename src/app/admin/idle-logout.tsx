"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

const IDLE_LIMIT_MS = 2 * 60 * 60 * 1000;
const CHECK_EVERY_MS = 60 * 1000;
// Writing on every mousemove would be wasteful; once per 30s is plenty for a 2h limit.
const RECORD_THROTTLE_MS = 30 * 1000;
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart", "wheel"] as const;

// Last activity is kept in localStorage, not component state, so it's shared
// by every open admin tab and survives the phone putting the app to sleep.
export const LAST_ACTIVITY_KEY = "admin:lastActivity";

export function recordAdminActivity() {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  } catch {
    // Storage blocked (private mode): the timer below still runs per tab.
  }
}

function lastActivity(): number | null {
  try {
    const value = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

// Signs the admin out after 2 hours with no taps, clicks, typing or scrolling.
// Rendered on every logged-in admin page (see admin-chrome.tsx).
export function IdleLogout() {
  useEffect(() => {
    let lastWrite = 0;
    let signingOut = false;
    let fallback = Date.now();

    function isIdle() {
      return Date.now() - (lastActivity() ?? fallback) > IDLE_LIMIT_MS;
    }

    function check() {
      if (signingOut || !isIdle()) return;
      signingOut = true;
      signOut({ callbackUrl: "/admin/login?reason=idle" });
    }

    function onActivity() {
      const now = Date.now();
      if (now - lastWrite < RECORD_THROTTLE_MS) return;
      // Activity right as the app wakes up after a long sleep must not count:
      // check first, so a 3-hour-old session is signed out, not extended.
      check();
      if (signingOut) return;
      lastWrite = now;
      fallback = now;
      recordAdminActivity();
    }

    // Opening a page counts as activity, unless the last activity was already
    // more than 2 hours ago (e.g. the admin app reopened the next morning).
    check();
    if (!signingOut) onActivity();

    // Phones pause timers in background tabs, so also check on return.
    function onVisible() {
      if (document.visibilityState === "visible") check();
    }

    const interval = setInterval(check, CHECK_EVERY_MS);
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, onActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(interval);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, onActivity);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, []);

  return null;
}
