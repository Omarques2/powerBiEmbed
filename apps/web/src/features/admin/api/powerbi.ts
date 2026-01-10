// apps/web/src/features/admin/api/powerbi.ts
import { http } from "@/api/http";

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
  return res.data as RemoteWorkspace[];
}

export async function listRemoteReports(workspaceId: string) {
  const res = await http.get("/admin/powerbi/remote/reports", { params: { workspaceId } });
  return res.data as RemoteReport[];
}

export async function syncPowerBiCatalog(payload: {
  customerId: string;
  workspaceIds?: string[];
  deactivateMissing?: boolean;
}) {
  const res = await http.post("/admin/powerbi/sync", payload);
  return res.data as {
    ok: boolean;
    customerId: string;
    workspacesSeenRemote: number;
    workspacesUpserted: number;
    reportsUpserted: number;
    reportsDeactivated: number;
  };
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
      createdAt: string;
    }>;
  }>;
};

export async function getPowerBiCatalog(customerId: string) {
  const res = await http.get("/admin/powerbi/catalog", { params: { customerId } });
  return res.data as CustomerCatalog;
}

export async function unlinkCustomerWorkspace(customerId: string, workspaceRefId: string) {
  const res = await http.post(`/admin/customers/${customerId}/workspaces/${workspaceRefId}/unlink`);
  return res.data as {
    ok: boolean;
    workspace: { workspaceRefId: string; isActive: boolean };
    reports: { totalFound: number; deactivated: number };
    permissions: { usersConsidered: number; workspacePermsRevoked: number; reportPermsRevoked: number };
  };
}
