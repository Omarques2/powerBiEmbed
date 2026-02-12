import { describe, it, expect, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import AccessMetricsPanel from "@/features/admin/AccessMetricsPanel.vue";
import { getAdminAccessMetrics } from "@/features/admin/api/metrics";

vi.mock("@/features/admin/api/metrics", () => ({
  getAdminAccessMetrics: vi.fn(),
}));

vi.mock("@/ui/toast/useToast", () => ({
  useToast: () => ({
    push: vi.fn(),
  }),
}));

const metricsFixture = {
  range: {
    from: "2026-02-12T10:00:00.000Z",
    to: "2026-02-12T11:00:00.000Z",
    window: "24h" as const,
    bucket: "hour" as const,
    timezone: "America/Sao_Paulo",
  },
  kpis: {
    activeNow: 7,
    totalLoginsWindow: 42,
    uniqueLoginsWindow: 18,
    avgLoginsPerHour: 4.2,
    failedAuthWindow: 3,
    reportViewsWindow: 16,
    uniqueCustomersWindow: 4,
    uniqueReportsWindow: 5,
  },
  series: {
    loginsByBucket: [
      { bucketStart: "2026-02-12T09:00:00.000Z", value: 3 },
      { bucketStart: "2026-02-12T10:00:00.000Z", value: 8 },
      { bucketStart: "2026-02-12T11:00:00.000Z", value: 2 },
    ],
    reportViewsByBucket: [
      { bucketStart: "2026-02-12T09:00:00.000Z", value: 1 },
      { bucketStart: "2026-02-12T10:00:00.000Z", value: 5 },
      { bucketStart: "2026-02-12T11:00:00.000Z", value: 2 },
    ],
  },
  topUsers: [
    {
      userId: "u-1",
      email: "u1@example.com",
      displayName: "User One",
      loginCount: 12,
      lastLoginAt: "2026-02-12T10:59:00.000Z",
    },
  ],
  breakdowns: {
    byCustomer: [
      {
        customerId: "c-1",
        customerCode: "ACME",
        customerName: "Acme LTDA",
        accessCount: 9,
        uniqueUsers: 3,
        lastAccessAt: "2026-02-12T10:59:00.000Z",
      },
    ],
    byReport: [
      {
        reportRefId: "rp-ref-1",
        reportId: "rp-1",
        reportName: "Report KPI",
        workspaceId: "ws-1",
        workspaceName: "Workspace A",
        accessCount: 10,
        uniqueUsers: 3,
        uniqueCustomers: 2,
        lastAccessAt: "2026-02-12T10:58:00.000Z",
      },
    ],
  },
  recentAuthEvents: [
    {
      id: "evt-1",
      action: "AUTH_LOGIN_SUCCEEDED",
      createdAt: "2026-02-12T10:59:30.000Z",
      actorUserId: "u-1",
      entityType: "USER",
      entityId: "u-1",
      ip: "127.0.0.1",
      userAgent: "Vitest",
      afterData: null,
      actor: {
        id: "u-1",
        email: "u1@example.com",
        displayName: "User One",
      },
    },
  ],
};

describe("AccessMetricsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders KPI cards and top users after load", async () => {
    vi.mocked(getAdminAccessMetrics).mockResolvedValue(metricsFixture);
    const wrapper = mount(AccessMetricsPanel);

    await flushPromises();
    await flushPromises();

    expect(getAdminAccessMetrics).toHaveBeenCalledTimes(1);
    expect(wrapper.get("[data-testid='kpi-active-now']").text()).toBe("7");
    expect(wrapper.text()).toContain("Top usuários");
    expect(wrapper.text()).toContain("User One");
    expect(wrapper.text()).toContain("Acessos por customer");
    expect(wrapper.text()).toContain("Acessos por relatório");
  });

  it("reloads metrics when filters change", async () => {
    vi.mocked(getAdminAccessMetrics).mockResolvedValue(metricsFixture);
    const wrapper = mount(AccessMetricsPanel);
    await flushPromises();
    await flushPromises();

    await wrapper.get("[data-testid='metrics-window']").setValue("7d");
    await wrapper.get("[data-testid='metrics-bucket']").setValue("day");
    await wrapper.get("[data-testid='metrics-timezone']").setValue("UTC");
    await wrapper.get("[data-testid='metrics-apply']").trigger("click");
    await flushPromises();

    expect(getAdminAccessMetrics).toHaveBeenLastCalledWith(
      expect.objectContaining({
        window: "7d",
        bucket: "day",
        timezone: "UTC",
      }),
    );
  });

  it("shows empty state when there are no events", async () => {
    vi.mocked(getAdminAccessMetrics).mockResolvedValue({
      ...metricsFixture,
      kpis: {
        ...metricsFixture.kpis,
        totalLoginsWindow: 0,
      },
      series: { loginsByBucket: [], reportViewsByBucket: [] },
      topUsers: [],
      breakdowns: { byCustomer: [], byReport: [] },
      recentAuthEvents: [],
    });

    const wrapper = mount(AccessMetricsPanel);
    await flushPromises();
    await flushPromises();

    expect(wrapper.find("[data-testid='metrics-empty']").exists()).toBe(true);
  });
});
