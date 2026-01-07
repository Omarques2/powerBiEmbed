import { http } from "../api/http";

export type PendingUserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  last_login_at: string | null;
  status: "pending" | "active" | "disabled";
};

export type CustomerRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  createdAt: string;
};

export type ActivatePayload = {
  customerId: string;
  role: "owner" | "admin" | "member" | "viewer";
  grantCustomerWorkspaces?: boolean;
};

export async function adminMe() {
  const res = await http.get("/admin/me");
  return res.data as { ok: boolean };
}

export async function listPendingUsers() {
  const res = await http.get("/admin/users/pending");
  return res.data as PendingUserRow[];
}

export async function listCustomers() {
  const res = await http.get("/admin/customers");
  return res.data as CustomerRow[];
}

export async function activateUser(userId: string, payload: ActivatePayload) {
  const res = await http.post(`/admin/users/${userId}/activate`, payload);
  return res.data as { ok: boolean };
}

export async function disableUser(userId: string) {
  const res = await http.post(`/admin/users/${userId}/disable`);
  return res.data as { ok: boolean };
}

export type ActiveUserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  last_login_at: string | null;
  status: "pending" | "active" | "disabled";
};

export type Paged<T> = {
  page: number;
  pageSize: number;
  total: number;
  rows: T[];
};

export type AuditRow = {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorUserId: string | null;
  actor: { id: string; email: string | null; displayName: string | null } | null;
  ip: string | null;
  userAgent: string | null;
  before: any;
  after: any;
};

export type UserPermissionsResponse = {
  user: { id: string; email: string | null; displayName: string | null; status: string };
  customerId: string | null;
  customer?: { id: string; code: string; name: string; status: string };
  memberships: Array<{
    customerId: string;
    role: string;
    isActive: boolean;
    customer: { id: string; code: string; name: string; status: string };
  }>;
  workspaces: Array<{
    workspaceRefId: string;
    workspaceId: string;
    name: string;
    canView: boolean;
    reports: Array<{
      reportRefId: string;
      reportId: string;
      name: string;
      datasetId: string | null;
      canView: boolean;
    }>;
  }>;
};

export async function listActiveUsers(q = "", page = 1, pageSize = 25) {
  const res = await http.get("/admin/users/active", { params: { q, page, pageSize } });
  return res.data as Paged<ActiveUserRow>;
}

export async function getUserPermissions(userId: string, customerId?: string) {
  const res = await http.get(`/admin/users/${userId}/permissions`, { params: { customerId } });
  return res.data as UserPermissionsResponse;
}

export async function setWorkspacePermission(
  userId: string,
  workspaceRefId: string,
  canView: boolean,
  grantReports = true,
) {
  const res = await http.put(`/admin/users/${userId}/workspaces/${workspaceRefId}`, {
    canView,
    grantReports,
  });
  return res.data as { ok: boolean; reportsAffected?: number };
}

export async function setReportPermission(userId: string, reportRefId: string, canView: boolean) {
  const res = await http.put(`/admin/users/${userId}/reports/${reportRefId}`, { canView });
  return res.data as { ok: boolean };
}

export async function listAuditLogs(params: {
  page?: number;
  pageSize?: number;
  action?: string;
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
}) {
  const res = await http.get("/admin/audit", { params });
  return res.data as Paged<AuditRow>;
}

// -----------------------
// Power BI Admin endpoints
// -----------------------
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

export type CreateCustomerPayload = {
  code: string;
  name: string;
  status?: "active" | "inactive";
};

export type UpdateCustomerPayload = {
  code?: string;
  name?: string;
};

export async function createCustomer(payload: CreateCustomerPayload) {
  const res = await http.post("/admin/customers", payload);
  return res.data as CustomerRow;
}

export async function updateCustomer(customerId: string, payload: UpdateCustomerPayload) {
  const res = await http.put(`/admin/customers/${customerId}`, payload);
  return res.data as { ok: boolean; customer: CustomerRow };
}

export async function setCustomerStatus(customerId: string, status: "active" | "inactive") {
  const res = await http.post(`/admin/customers/${customerId}/status`, { status });
  return res.data as { ok: boolean; status: string; workspacesDeactivated?: number; reportsDeactivated?: number };
}

export type MembershipRole = "owner" | "admin" | "member" | "viewer";

export async function upsertUserMembership(userId: string, payload: {
  customerId: string;
  role: MembershipRole;
  isActive?: boolean;
  grantCustomerWorkspaces?: boolean;
  revokeCustomerPermissions?: boolean;
  ensureUserActive?: boolean;
}) {
  const res = await http.post(`/admin/users/${userId}/memberships`, payload);
  return res.data as {
    ok: boolean;
    membership: { customerId: string; role: MembershipRole; isActive: boolean };
    granted?: { wsGranted: number; rpGranted: number };
    revoked?: { wsRevoked: number; rpRevoked: number };
  };
}

export async function patchUserMembership(userId: string, customerId: string, payload: {
  role?: MembershipRole;
  isActive?: boolean;
  grantCustomerWorkspaces?: boolean;
  revokeCustomerPermissions?: boolean;
}) {
  const res = await http.patch(`/admin/users/${userId}/memberships/${customerId}`, payload);
  return res.data as {
    ok: boolean;
    membership: { customerId: string; role: MembershipRole; isActive: boolean };
    granted?: { wsGranted: number; rpGranted: number };
    revoked?: { wsRevoked: number; rpRevoked: number };
  };
}

export async function removeUserMembership(userId: string, customerId: string, revokeCustomerPermissions = true) {
  const res = await http.delete(`/admin/users/${userId}/memberships/${customerId}`, {
    params: { revokeCustomerPermissions },
  });
  return res.data as { ok: boolean; revoked?: { wsRevoked: number; rpRevoked: number } };
}

export async function transferUserMembership(userId: string, payload: {
  fromCustomerId: string;
  toCustomerId: string;
  toRole: MembershipRole;
  deactivateFrom?: boolean;
  revokeFromCustomerPermissions?: boolean;
  grantToCustomerWorkspaces?: boolean;
  toIsActive?: boolean;
}) {
  const res = await http.post(`/admin/users/${userId}/transfer`, payload);
  return res.data as {
    ok: boolean;
    toMembership: { customerId: string; role: MembershipRole; isActive: boolean };
    revokedFrom?: { wsRevoked: number; rpRevoked: number };
    grantedTo?: { wsGranted: number; rpGranted: number };
  };
}

export type PlatformAdminRow = {
  userId: string;
  email: string | null;
  displayName: string | null;
  status: string;
  grantedAt: string; // ISO
  appKey: string;
  roleKey: string;
};

export async function listPlatformAdmins(appKey = "PBI_EMBED") {
  const res = await http.get("/admin/security/platform-admins", { params: { appKey } });
  return res.data as PlatformAdminRow[];
}

export async function grantPlatformAdmin(input: { appKey?: string; userId?: string; userEmail?: string }) {
  const res = await http.post("/admin/security/platform-admins", {
    appKey: input.appKey ?? "PBI_EMBED",
    roleKey: "platform_admin",
    userId: input.userId,
    userEmail: input.userEmail,
  });
  return res.data;
}

export async function revokePlatformAdmin(userId: string, appKey = "PBI_EMBED") {
  const res = await http.delete(`/admin/security/platform-admins/${encodeURIComponent(userId)}`, {
    params: { appKey, roleKey: "platform_admin" },
  });
  return res.data;
}
