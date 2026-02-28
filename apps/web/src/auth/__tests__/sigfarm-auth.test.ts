import { describe, expect, it } from "vitest";
import { buildAuthCallbackReturnTo, buildAuthPortalLoginUrl } from "@/auth/sigfarm-auth";

describe("buildAuthCallbackReturnTo", () => {
  it("wraps product route inside /auth/callback", () => {
    const wrapped = buildAuthCallbackReturnTo("/app");
    const parsed = new URL(wrapped);
    const expectedOrigin = window.location.origin;

    expect(parsed.pathname).toBe("/auth/callback");
    expect(parsed.searchParams.get("returnTo")).toBe(`${expectedOrigin}/app`);
  });
});

describe("buildAuthPortalLoginUrl", () => {
  it("preserves callback returnTo", () => {
    const callback = buildAuthCallbackReturnTo("/admin");
    const login = buildAuthPortalLoginUrl(callback);
    const parsed = new URL(login);
    const loginReturnTo = parsed.searchParams.get("returnTo");
    const callbackParsed = new URL(loginReturnTo ?? "");
    const expectedOrigin = window.location.origin;

    expect(parsed.origin).toBe("https://auth.sigfarmintelligence.com");
    expect(parsed.pathname).toBe("/login");
    expect(callbackParsed.pathname).toBe("/auth/callback");
    expect(callbackParsed.searchParams.get("returnTo")).toBe(`${expectedOrigin}/admin`);
  });

  it("falls back to default return when returnTo origin is untrusted", () => {
    const login = buildAuthPortalLoginUrl("https://evil.example.com/phishing");
    const parsed = new URL(login);
    const expectedOrigin = window.location.origin;

    expect(parsed.searchParams.get("returnTo")).toBe(`${expectedOrigin}/`);
  });
});
