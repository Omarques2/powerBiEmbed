// apps/web/src/features/admin/api/powerbi.ts
import { http } from "@/api/http";
import { unwrapData, type ApiEnvelope } from "@/api/envelope";

export type RemoteWorkspace = {
  id: string;
  name: string;
  isReadOnly?: boolean;
  type?: string;
};

export type RemoteReport = {
  workspaceId: string;
  id: string;
  name: string;
  datasetId?: string;
  embedUrl?: string;
};

export async function listRemoteWorkspaces() {
  const res = await http.get("/admin/powerbi/remote/workspaces");
  return unwrapData(res.data as ApiEnvelope<RemoteWorkspace[]>);
}

export async function listRemoteReports(workspaceId: string) {
  const res = await http.get("/admin/powerbi/remote/reports", { params: { workspaceId } });
  return unwrapData(res.data as ApiEnvelope<RemoteReport[]>);
}

export async function syncPowerBiCatalog(payload: {
  customerId: string;
  workspaceIds?: string[];
  deactivateMissing?: boolean;
}) {
  const res = await http.post("/admin/powerbi/sync", payload);
  return unwrapData(
    res.data as ApiEnvelope<{
      ok: boolean;
      customerId: string;
      workspacesSeenRemote: number;
      workspacesUpserted: number;
      reportsUpserted: number;
      reportsDeactivated: number;
    }>,
  );
}

export type CustomerCatalog = {
  customer: { id: string; code: string; name: string; status: string };
  workspaces: Array<{
    workspaceRefId: string;
    workspaceId: string;
    name: string;
    isActive: boolean;
    createdAt: string;
    reports: Array<{
      reportRefId: string;
      reportId: string;
      name: string;
      datasetId: string | null;
      isActive: boolean;
      canView: boolean;
      createdAt: string;
    }>;
  }>;
};

export async function getPowerBiCatalog(customerId: string) {
  const res = await http.get("/admin/powerbi/catalog", { params: { customerId } });
  return unwrapData(res.data as ApiEnvelope<CustomerCatalog>);
}

export type GlobalCatalog = {
  workspaces: Array<{
    workspaceRefId: string;
    workspaceId: string;
    name: string;
    isActive: boolean;
    createdAt: string;
    reports: Array<{
      reportRefId: string;
      reportId: string;
      name: string;
      datasetId: string | null;
      isActive: boolean;
      createdAt: string;
    }>;
  }>;
};

export async function getPowerBiGlobalCatalog() {
  const res = await http.get("/admin/powerbi/catalog/global");
  return unwrapData(res.data as ApiEnvelope<GlobalCatalog>);
}

export async function unlinkCustomerWorkspace(customerId: string, workspaceRefId: string) {
  const res = await http.post(`/admin/customers/${customerId}/workspaces/${workspaceRefId}/unlink`);
  return unwrapData(
    res.data as ApiEnvelope<{
      ok: boolean;
      workspace: { workspaceRefId: string; isActive: boolean };
      reports: { totalFound: number; permissionsRevoked: number };
    }>,
  );
}

export async function setCustomerReportPermission(customerId: string, reportRefId: string, canView: boolean) {
  const res = await http.put(`/admin/customers/${customerId}/reports/${reportRefId}`, { canView });
  return unwrapData(res.data as ApiEnvelope<{ ok: boolean; workspaceActivated?: boolean }>);
}
