import { describe, expect, it, vi } from "vitest";
import { createAuthNavigationGuard } from "@/router/auth-guard";

type MockRoute = {
  path: string;
  fullPath?: string;
  meta: {
    requiresAuth?: boolean;
    requiresActive?: boolean;
    requiresAdmin?: boolean;
  };
};

function route(path: string, options?: Partial<MockRoute["meta"]>): MockRoute {
  return {
    path,
    fullPath: path,
    meta: {
      requiresAuth: true,
      requiresActive: true,
      ...options,
    },
  };
}

describe("createAuthNavigationGuard", () => {
  it("redirects protected route to login when no session is available", async () => {
    const ensureSession = vi.fn().mockResolvedValue(null);
    const exchangeSession = vi.fn().mockRejectedValue(new Error("no session"));
    const getMeCached = vi.fn().mockResolvedValue(null);

    const guard = createAuthNavigationGuard({
      ensureSession,
      exchangeSession,
      getMeCached,
      checkAdminAccess: vi.fn().mockResolvedValue("allowed"),
    });

    const result = await guard(route("/app") as any);
    expect(result).toBe("/login?returnTo=%2Fapp");
  });

  it("redirects to pending when authenticated user is not active", async () => {
    const ensureSession = vi.fn().mockResolvedValue({ data: { sessionId: "sid" } });
    const exchangeSession = vi.fn();
    const getMeCached = vi.fn().mockResolvedValue({ status: "pending" });

    const guard = createAuthNavigationGuard({
      ensureSession,
      exchangeSession,
      getMeCached,
      checkAdminAccess: vi.fn().mockResolvedValue("allowed"),
    });

    const result = await guard(route("/app") as any);
    expect(result).toBe("/pending");
  });

  it("allows pending route once session exists", async () => {
    const ensureSession = vi.fn().mockResolvedValue({ data: { sessionId: "sid" } });
    const exchangeSession = vi.fn();
    const getMeCached = vi.fn();

    const guard = createAuthNavigationGuard({
      ensureSession,
      exchangeSession,
      getMeCached,
      checkAdminAccess: vi.fn().mockResolvedValue("allowed"),
    });

    const result = await guard(route("/pending", { requiresActive: false }) as any);
    expect(result).toBe(true);
    expect(getMeCached).not.toHaveBeenCalled();
  });

  it("redirects login to app when active session already exists", async () => {
    const ensureSession = vi.fn().mockResolvedValue({ data: { sessionId: "sid" } });
    const exchangeSession = vi.fn();
    const getMeCached = vi.fn().mockResolvedValue({ status: "active" });

    const guard = createAuthNavigationGuard({
      ensureSession,
      exchangeSession,
      getMeCached,
      checkAdminAccess: vi.fn().mockResolvedValue("allowed"),
    });

    const result = await guard(route("/login", { requiresAuth: false, requiresActive: false }) as any);
    expect(result).toBe("/app");
  });

  it("maps admin forbidden to app fallback", async () => {
    const ensureSession = vi.fn().mockResolvedValue({ data: { sessionId: "sid" } });
    const exchangeSession = vi.fn();
    const getMeCached = vi.fn().mockResolvedValue({ status: "active" });

    const guard = createAuthNavigationGuard({
      ensureSession,
      exchangeSession,
      getMeCached,
      checkAdminAccess: vi.fn().mockResolvedValue("forbidden"),
    });

    const result = await guard(route("/admin", { requiresAdmin: true }) as any);
    expect(result).toBe("/app");
  });
});
