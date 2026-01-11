import { http } from "@/api/http";

export type RlsValueType = "text" | "int" | "uuid";
export type RlsDefaultBehavior = "allow" | "deny";
export type RlsTargetStatus = "draft" | "active";
export type RlsRuleOp = "include" | "exclude";

export type RlsTarget = {
  id: string;
  datasetId: string;
  targetKey: string;
  displayName: string;
  factTable: string;
  factColumn: string;
  valueType: RlsValueType;
  defaultBehavior: RlsDefaultBehavior;
  status: RlsTargetStatus;
  createdAt: string;
};

export type RlsRule = {
  id: string;
  targetId: string;
  customerId: string;
  op: RlsRuleOp;
  valueText: string | null;
  valueInt: number | null;
  valueUuid: string | null;
  createdAt: string;
};

export type RlsSnapshotTarget = {
  id: string;
  datasetId: string;
  targetKey: string;
  displayName: string;
  factTable: string;
  factColumn: string;
  valueType: RlsValueType;
  defaultBehavior: RlsDefaultBehavior;
  status: RlsTargetStatus;
  createdAt: string;
};

export type RlsSnapshotRule = {
  id: string;
  targetId: string;
  targetKey: string | null;
  targetDisplayName: string | null;
  customerId: string;
  customerCode: string | null;
  customerName: string | null;
  op: RlsRuleOp;
  valueText: string | null;
  valueInt: number | null;
  valueUuid: string | null;
  createdAt: string;
};

export type RlsSnapshot = {
  datasetId: string;
  generatedAt: string;
  targets: RlsSnapshotTarget[];
  rules: RlsSnapshotRule[];
};


export type CreateTargetPayload = {
  targetKey: string;
  displayName: string;
  factTable: string;
  factColumn: string;
  valueType: RlsValueType;
  defaultBehavior?: RlsDefaultBehavior;
  status?: RlsTargetStatus;
};

export type UpdateTargetPayload = Partial<CreateTargetPayload>;

export type CreateRulePayload = {
  customerId: string;
  op: RlsRuleOp;
  valueText?: string | null;
  valueInt?: number | null;
  valueUuid?: string | null;
};

export async function listRlsTargets(datasetId: string) {
  const res = await http.get(`/admin/rls/datasets/${encodeURIComponent(datasetId)}/targets`);
  return res.data as { items: RlsTarget[] };
}

export async function createRlsTarget(datasetId: string, payload: CreateTargetPayload) {
  const res = await http.post(`/admin/rls/datasets/${encodeURIComponent(datasetId)}/targets`, payload);
  return res.data as RlsTarget;
}

export async function updateRlsTarget(targetId: string, payload: UpdateTargetPayload) {
  const res = await http.patch(`/admin/rls/targets/${encodeURIComponent(targetId)}`, payload);
  return res.data as RlsTarget;
}

export async function deleteRlsTarget(targetId: string) {
  const res = await http.delete(`/admin/rls/targets/${encodeURIComponent(targetId)}`);
  return res.data as { ok: boolean };
}

export async function listRlsRules(targetId: string, customerId?: string) {
  const res = await http.get(`/admin/rls/targets/${encodeURIComponent(targetId)}/rules`, {
    params: { customerId },
  });
  return res.data as { items: RlsRule[] };
}

export async function createRlsRules(targetId: string, items: CreateRulePayload[]) {
  const res = await http.post(`/admin/rls/targets/${encodeURIComponent(targetId)}/rules`, { items });
  return res.data as { created: RlsRule[] };
}

export async function deleteRlsRule(ruleId: string) {
  const res = await http.delete(`/admin/rls/rules/${encodeURIComponent(ruleId)}`);
  return res.data as { ok: boolean };
}

export async function refreshRlsDataset(datasetId: string) {
  const res = await http.post(`/admin/rls/datasets/${encodeURIComponent(datasetId)}/refresh`);
  return res.data as {
    status: "queued" | "scheduled" | "running";
    pending?: boolean;
    scheduledAt?: string;
    scheduledInMs?: number;
    refresh?: unknown;
  };
}

export async function listRlsRefreshes(datasetId: string) {
  const res = await http.get(`/admin/rls/datasets/${encodeURIComponent(datasetId)}/refreshes`);
  return res.data as { items: any[] };
}

export async function getRlsSnapshot(datasetId: string) {
  const res = await http.get(`/admin/rls/datasets/${encodeURIComponent(datasetId)}/snapshot`);
  return res.data as RlsSnapshot;
}

export async function getRlsSnapshotCsv(datasetId: string) {
  const res = await http.get(`/admin/rls/datasets/${encodeURIComponent(datasetId)}/snapshot`, {
    params: { format: "csv" },
  });
  return res.data as { content: string; filename: string; contentType: string; generatedAt?: string };
}
