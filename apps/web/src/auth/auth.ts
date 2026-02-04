import {
  PublicClientApplication,
  type AccountInfo,
  type AuthenticationResult,
  InteractionRequiredAuthError,
} from "@azure/msal-browser";

const clientId = import.meta.env.VITE_ENTRA_SPA_CLIENT_ID as string;
const authority = import.meta.env.VITE_ENTRA_AUTHORITY as string;

const envRedirectUri = import.meta.env.VITE_ENTRA_REDIRECT_URI as string | undefined;
const envPostLogoutRedirectUri = import.meta.env.VITE_ENTRA_POST_LOGOUT_REDIRECT_URI as string | undefined;

const apiScope = import.meta.env.VITE_ENTRA_API_SCOPE as string;

// Opcional (somente CIAM/B2C/custom domains)
const knownAuthority = (import.meta.env.VITE_ENTRA_KNOWN_AUTHORITY as string | undefined) ?? undefined;

if (!clientId) throw new Error("Missing VITE_ENTRA_SPA_CLIENT_ID");
if (!authority) throw new Error("Missing VITE_ENTRA_AUTHORITY");
const redirectUri = resolveRedirectUri();
const postLogoutRedirectUri = resolvePostLogoutRedirectUri();

function resolveRedirectUri(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/auth/callback`;
  }
  if (envRedirectUri) return envRedirectUri;
  throw new Error("Missing redirectUri (window origin unavailable)");
}

function resolvePostLogoutRedirectUri(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/`;
  }
  if (envPostLogoutRedirectUri) return envPostLogoutRedirectUri;
  throw new Error("Missing postLogoutRedirectUri (window origin unavailable)");
}
if (!apiScope) throw new Error("Missing VITE_ENTRA_API_SCOPE");

const isCiamLike =
  authority.includes(".ciamlogin.com/") ||
  authority.includes(".b2clogin.com/");

export const msal = new PublicClientApplication({
  auth: {
    clientId,
    authority,
    redirectUri,
    postLogoutRedirectUri,
    navigateToLoginRequestUrl: false,
    ...(isCiamLike && knownAuthority ? { knownAuthorities: [knownAuthority] } : {}),
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
});

let initPromise: Promise<void> | null = null;
let resetInProgress = false;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: number | null = null;
  const timeout = new Promise<T>((_, reject) => {
    timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) window.clearTimeout(timer);
  });
}

/**
 * Inicializa MSAL + processa redirect exatamente 1x (robusto para produção).
 */
export function initAuthOnce(): Promise<void> {
  if (!initPromise) initPromise = initAuth();
  return initPromise;
}

export async function initAuth(): Promise<void> {
  try {
    await msal.initialize();

    const result = await msal.handleRedirectPromise();
    if (result?.account) {
      msal.setActiveAccount(result.account);
      return;
    }

    // Restaura conta se já existir no cache
    const accounts = msal.getAllAccounts();
    msal.setActiveAccount(accounts[0] ?? null);
  } catch (err) {
    await hardResetAuthState();
    throw err;
  }
}

export function getActiveAccount(): AccountInfo | null {
  return msal.getActiveAccount() ?? null;
}

export async function login(): Promise<void> {
  await msal.loginRedirect({
    scopes: ["openid", "profile", "email", apiScope],
    prompt: "select_account",
  });
}

export async function logout(): Promise<void> {
  await msal.logoutRedirect();
}

async function clearIndexedDbSafely(): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  try {
    const dbs = await (indexedDB as any).databases?.();
    if (!Array.isArray(dbs)) return;
    await Promise.all(
      dbs
        .map((db: any) => db?.name)
        .filter(Boolean)
        .map(
          (name: string) =>
            new Promise<void>((resolve) => {
              const req = indexedDB.deleteDatabase(name);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
            }),
        ),
    );
  } catch {
    // best effort only
  }
}

export async function hardResetAuthState(): Promise<void> {
  if (resetInProgress) return;
  resetInProgress = true;
  try {
    const cache = msal.getTokenCache() as unknown as {
      removeAccount?: (account: AccountInfo) => Promise<void> | void;
    };
    const accounts = msal.getAllAccounts();
    await Promise.all(
      accounts.map(async (account) => {
        try {
          await cache.removeAccount?.(account);
        } catch {
          // best effort only
        }
      }),
    );
  } catch {
    // best effort only
  }
  try {
    const anyMsal = msal as unknown as { clearCache?: () => Promise<void> | void };
    await anyMsal.clearCache?.();
  } catch {
    // best effort only
  }
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // best effort only
  }
  await clearIndexedDbSafely();
  initPromise = null;
  resetInProgress = false;
}

export async function initAuthSafe(timeoutMs = 10_000): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await withTimeout(initAuthOnce(), timeoutMs, "MSAL init");
  } catch {
    await hardResetAuthState();
  }
}

export async function acquireApiToken(): Promise<string> {
  await initAuthOnce();

  const account = getActiveAccount();
  if (!account) {
    await login();
    throw new Error("No active account (redirecting to login).");
  }

  try {
    const res: AuthenticationResult = await msal.acquireTokenSilent({
      account,
      scopes: [apiScope],
    });
    return res.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      await msal.acquireTokenRedirect({
        scopes: [apiScope],
        prompt: "select_account",
      });
      throw new Error("Interaction required (redirecting).");
    }
    if (typeof window !== "undefined") {
      await hardResetAuthState();
    }
    throw err;
  }
}
