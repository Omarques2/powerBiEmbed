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
