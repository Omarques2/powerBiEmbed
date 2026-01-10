// apps/web/src/features/admin/api/users.ts
import { http } from "@/api/http";
import type { MembershipRole } from "./memberships";
import type { Paged } from "./types";

export type PendingUserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  last_login_at: string | null;
  status: "pending" | "active" | "disabled";
};

export type ActiveUserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  last_login_at: string | null;
  status: "pending" | "active" | "disabled";
};

export type ActivatePayload = {
  customerId: string;
  role: MembershipRole;
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

export async function listActiveUsers(q = "", page = 1, pageSize = 25) {
  const res = await http.get("/admin/users/active", { params: { q, page, pageSize } });
  return res.data as Paged<ActiveUserRow>;
}

export async function getUserById(userId: string) {
  const res = await http.get(`/admin/users/${encodeURIComponent(userId)}`);
  return res.data as ActiveUserRow;
}

export async function activateUser(userId: string, payload: ActivatePayload) {
  const res = await http.post(`/admin/users/${userId}/activate`, payload);
  return res.data as { ok: boolean };
}

export async function disableUser(userId: string) {
  const res = await http.post(`/admin/users/${userId}/disable`);
  return res.data as { ok: boolean };
}
