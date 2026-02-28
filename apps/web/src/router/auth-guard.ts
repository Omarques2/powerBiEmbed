import type { RouteLocationNormalized } from "vue-router";

type MeProfile = { status?: string } | null;

type AdminAccessResult = "allowed" | "forbidden" | "unauthorized" | "error";

type AuthGuardDeps = {
  ensureSession: () => Promise<unknown | null>;
  exchangeSession: () => Promise<unknown>;
  getMeCached: (force?: boolean) => Promise<MeProfile>;
  checkAdminAccess: () => Promise<AdminAccessResult>;
};

type AuthGuardResult = true | string;

const EXCHANGE_RETRY_ATTEMPTS = 2;
const LOGIN_EXCHANGE_RETRY_ATTEMPTS = 1;

type EnsureSessionOptions = {
  attempts: number;
  allowProfileFallback: boolean;
};

function isUserActive(me: MeProfile): boolean {
  return Boolean(me && me.status === "active");
}

export function createAuthNavigationGuard(deps: AuthGuardDeps) {
  async function ensureSessionSafely(): Promise<unknown | null> {
    try {
      return await deps.ensureSession();
    } catch {
      return null;
    }
  }

  async function hasProfileFallback(): Promise<boolean> {
    try {
      const me = await deps.getMeCached(true);
      return Boolean(me);
    } catch {
      return false;
    }
  }

  async function ensureSessionWithExchange(
    options: EnsureSessionOptions,
  ): Promise<unknown | null> {
    for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
      const session = await ensureSessionSafely();
      if (session) return session;

      try {
        await deps.exchangeSession();
      } catch {
        if (options.allowProfileFallback && (await hasProfileFallback())) {
          return { source: "profile-fallback" };
        }
        if (attempt >= options.attempts) {
          return null;
        }
        continue;
      }

      const refreshedSession = await ensureSessionSafely();
      if (refreshedSession) return refreshedSession;
      if (options.allowProfileFallback && (await hasProfileFallback())) {
        return { source: "profile-fallback" };
      }
    }

    return null;
  }

  return async function authNavigationGuard(
    to: RouteLocationNormalized,
  ): Promise<AuthGuardResult> {
    if (to.path === "/login") {
      const session = await ensureSessionWithExchange({
        attempts: LOGIN_EXCHANGE_RETRY_ATTEMPTS,
        allowProfileFallback: false,
      });
      if (!session) return true;

      const me = await deps.getMeCached(false);
      return isUserActive(me) ? "/app" : "/pending";
    }

    if (!to.meta.requiresAuth) return true;

    const session = await ensureSessionWithExchange({
      attempts: EXCHANGE_RETRY_ATTEMPTS,
      allowProfileFallback: true,
    });

    if (!session) {
      const target = to.fullPath || to.path;
      return `/login?returnTo=${encodeURIComponent(target)}`;
    }

    if (to.path === "/pending") {
      return true;
    }

    if (to.meta.requiresActive) {
      const me = await deps.getMeCached(false);
      if (!isUserActive(me)) return "/pending";
    }

    if (to.meta.requiresAdmin) {
      const adminAccess = await deps.checkAdminAccess();
      if (adminAccess === "allowed") return true;
      if (adminAccess === "unauthorized") {
        const target = to.fullPath || to.path;
        return `/login?returnTo=${encodeURIComponent(target)}`;
      }
      return "/app";
    }

    return true;
  };
}
