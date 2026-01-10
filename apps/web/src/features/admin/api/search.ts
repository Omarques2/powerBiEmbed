// apps/web/src/features/admin/api/search.ts
import { http } from "@/api/http";

export type AdminSearchDTO = {
  q: string;
  users: Array<{ id: string; email: string | null; displayName: string | null; status: string }>;
  customers: Array<{ id: string; code: string; name: string; status: string }>;
  powerbi: {
    workspaces: Array<{
      id: string;
      workspaceId: string;
      name: string;
      customerId: string;
      isActive?: boolean;
    }>;
    reports: Array<{
      id: string;
      reportId: string;
      name: string;
      datasetId: string | null;
      workspaceRefId: string;
      isActive?: boolean;
    }>;
  };
};

export async function globalSearch(q: string, limit = 8) {
  const res = await http.get("/admin/search", { params: { q, limit } });
  return res.data as AdminSearchDTO;
}
