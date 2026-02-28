import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import CallbackView from "@/views/CallbackView.vue";
import { getMeCached } from "@/auth/me";
import { authClient, buildProductLoginRoute, getRouteReturnTo } from "@/auth/sigfarm-auth";

const replaceMock = vi.fn();
const mountedWrappers: Array<ReturnType<typeof mount>> = [];

vi.mock("vue-router", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
  useRoute: () => ({
    query: {
      returnTo: "/app",
    },
  }),
}));

vi.mock("@/auth/sigfarm-auth", () => ({
  authClient: {
    exchangeSession: vi.fn(),
    clearSession: vi.fn(),
  },
  buildProductLoginRoute: vi.fn((returnTo: string) => `/login?returnTo=${encodeURIComponent(returnTo)}`),
  getRouteReturnTo: vi.fn(() => "http://localhost:5173/app"),
}));

vi.mock("@/auth/me", () => ({
  getMeCached: vi.fn(),
}));

async function flushTick() {
  await flushPromises();
  await flushPromises();
}

function mountView() {
  const wrapper = mount(CallbackView);
  mountedWrappers.push(wrapper);
  return wrapper;
}

describe("CallbackView", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    replaceMock.mockResolvedValue(undefined);
    (authClient.exchangeSession as unknown as ReturnType<typeof vi.fn>).mockReset();
    (authClient.exchangeSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      session: { accessToken: "token" },
    });
    (authClient.clearSession as unknown as ReturnType<typeof vi.fn>).mockReset();
    (getRouteReturnTo as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      "http://localhost:5173/app",
    );
    (buildProductLoginRoute as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (returnTo: string) => `/login?returnTo=${encodeURIComponent(returnTo)}`,
    );
    (getMeCached as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "active" });
  });

  afterEach(() => {
    while (mountedWrappers.length > 0) {
      mountedWrappers.pop()?.unmount();
    }
  });

  it("redirects active users to returnTo path", async () => {
    (getRouteReturnTo as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      `${window.location.origin}/admin`,
    );

    mountView();
    await flushTick();

    expect(replaceMock).toHaveBeenCalledWith("/admin");
  });

  it("redirects pending users to /pending", async () => {
    (getMeCached as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "pending" });

    mountView();
    await flushTick();

    expect(replaceMock).toHaveBeenCalledWith("/pending");
  });

  it("redirects disabled users to /pending", async () => {
    (getMeCached as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "disabled" });

    mountView();
    await flushTick();

    expect(replaceMock).toHaveBeenCalledWith("/pending");
  });

  it("falls back to login route when callback flow fails", async () => {
    (authClient.exchangeSession as unknown as ReturnType<typeof vi.fn>).mockRejectedValue({
      status: 401,
    });
    (getMeCached as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    mountView();
    await flushTick();

    const expectedReturnTo = encodeURIComponent("http://localhost:5173/app");
    expect(authClient.clearSession).toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith(
      `/login?returnTo=${expectedReturnTo}`,
    );
  });
});
