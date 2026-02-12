import { http } from "@/api/http";
import { unwrapData, type ApiEnvelope } from "@/api/envelope";

export type AdminMetricWindow = "1h" | "6h" | "24h" | "7d" | "30d";
export type AdminMetricBucket = "hour" | "day";

export type AdminAccessMetricsDTO = {
  range: {
    from: string;
    to: string;
    window: AdminMetricWindow;
    bucket: AdminMetricBucket;
    timezone: string;
  };
  kpis: {
    activeNow: number;
    totalLoginsWindow: number;
    uniqueLoginsWindow: number;
    avgLoginsPerHour: number;
    failedAuthWindow: number;
    reportViewsWindow: number;
    uniqueCustomersWindow: number;
    uniqueReportsWindow: number;
  };
  series: {
    loginsByBucket: Array<{
      bucketStart: string;
      value: number;
    }>;
    reportViewsByBucket: Array<{
      bucketStart: string;
      value: number;
    }>;
  };
  topUsers: Array<{
    userId: string | null;
    email: string | null;
    displayName: string | null;
    loginCount: number;
    lastLoginAt: string | null;
  }>;
  breakdowns: {
    byCustomer: Array<{
      customerId: string | null;
      customerCode: string | null;
      customerName: string | null;
      accessCount: number;
      uniqueUsers: number;
      lastAccessAt: string | null;
    }>;
    byReport: Array<{
      reportRefId: string | null;
      reportId: string | null;
      reportName: string | null;
      workspaceId: string | null;
      workspaceName: string | null;
      accessCount: number;
      uniqueUsers: number;
      uniqueCustomers: number;
      lastAccessAt: string | null;
    }>;
  };
  recentAuthEvents: Array<{
    id: string;
    action: string;
    createdAt: string;
    actorUserId: string | null;
    entityType: string;
    entityId: string | null;
    ip: string | null;
    userAgent: string | null;
    afterData: unknown;
    actor:
      | {
          id: string;
          email: string | null;
          displayName: string | null;
        }
      | null;
  }>;
};

export async function getAdminAccessMetrics(params?: {
  window?: AdminMetricWindow;
  bucket?: AdminMetricBucket;
  from?: string;
  to?: string;
  timezone?: string;
  topLimit?: number;
}) {
  const res = await http.get("/admin/metrics/access", { params });
  return unwrapData(res.data as ApiEnvelope<AdminAccessMetricsDTO>);
}
