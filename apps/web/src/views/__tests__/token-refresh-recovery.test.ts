import { describe, expect, it, vi } from "vitest";
import {
  recoverVisualAfterTokenRefresh,
  shouldRecoverVisualAfterTokenRefresh,
} from "@/views/tokenRefreshRecovery";

describe("token refresh recovery", () => {
  it("recovers visual only when reason is token-expired", () => {
    expect(shouldRecoverVisualAfterTokenRefresh("token-expired")).toBe(true);
    expect(shouldRecoverVisualAfterTokenRefresh(" Token-Expired ")).toBe(true);
    expect(shouldRecoverVisualAfterTokenRefresh("auto")).toBe(false);
    expect(shouldRecoverVisualAfterTokenRefresh("manual")).toBe(false);
  });

  it("calls recovery callback only for token-expired", async () => {
    const recoverFn = vi.fn(async () => {});

    await recoverVisualAfterTokenRefresh("auto", recoverFn);
    expect(recoverFn).toHaveBeenCalledTimes(0);

    await recoverVisualAfterTokenRefresh("token-expired", recoverFn);
    expect(recoverFn).toHaveBeenCalledTimes(1);
  });

  it("swallows recovery errors to avoid breaking token flow", async () => {
    const recoverFn = vi.fn(async () => {
      throw new Error("render failed");
    });

    await expect(
      recoverVisualAfterTokenRefresh("token-expired", recoverFn),
    ).resolves.toBeUndefined();
  });
});
